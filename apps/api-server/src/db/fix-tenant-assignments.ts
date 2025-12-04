import { sql as db } from "./client";
import { getOrCreateDefaultTenant } from "./queries/tenants";

/**
 * Script to fix tenant assignments for existing users and companies.
 * 
 * This script:
 * 1. Creates default tenant if it doesn't exist
 * 2. Assigns tenantId to all admin users (tenant_admin, superadmin) who don't have one
 * 3. Updates all account companies (source = 'account' or NULL) to have tenantId
 * 4. Updates customer companies to have tenantId from their owner/creator
 * 
 * Usage: Run this script to ensure all users and companies have proper tenant assignments.
 */
export async function fixTenantAssignments(): Promise<void> {
	console.log("🔧 Starting tenant assignments fix...\n");

	// Step 1: Get or create default tenant
	console.log("📋 Step 1: Ensuring default tenant exists...");
	const defaultTenantId = await getOrCreateDefaultTenant();
	console.log(`✅ Default tenant ID: ${defaultTenantId}\n`);

	// Step 2: Assign tenantId to admin users who don't have one
	console.log("👤 Step 2: Assigning tenantId to admin users...");
	const adminUsersWithoutTenant = await db`
		SELECT id, email, role FROM users 
		WHERE (role = 'tenant_admin' OR role = 'superadmin' OR role = 'admin')
		  AND (tenant_id IS NULL)
	`;

	if (adminUsersWithoutTenant.length > 0) {
		console.log(`   Found ${adminUsersWithoutTenant.length} admin user(s) without tenantId:`);
		for (const user of adminUsersWithoutTenant) {
			const u = user as { id: string; email: string; role: string };
			console.log(`   - ${u.email} (${u.role})`);
		}

		// For superadmin, we don't assign tenantId (they can access all tenants)
		// For tenant_admin and admin, assign default tenant
		const tenantAdminUsers = adminUsersWithoutTenant.filter(
			(u) => (u as { role: string }).role !== "superadmin"
		);

		if (tenantAdminUsers.length > 0) {
			const userIds = tenantAdminUsers.map((u) => (u as { id: string }).id);
			await db`
				UPDATE users 
				SET tenant_id = ${defaultTenantId}, updated_at = NOW()
				WHERE id = ANY(${userIds})
			`;
			console.log(`   ✅ Assigned tenantId to ${tenantAdminUsers.length} admin user(s)\n`);
		} else {
			console.log("   ℹ️  All admin users are superadmin (no tenantId needed)\n");
		}
	} else {
		console.log("   ✅ All admin users already have tenantId\n");
	}

	// Step 3: Update account companies to have tenantId
	console.log("🏢 Step 3: Updating account companies with tenantId...");
	const accountCompaniesWithoutTenant = await db`
		SELECT id, name FROM companies 
		WHERE (source IS NULL OR source = 'account')
		  AND tenant_id IS NULL
	`;

	if (accountCompaniesWithoutTenant.length > 0) {
		console.log(`   Found ${accountCompaniesWithoutTenant.length} account company/companies without tenantId:`);
		for (const company of accountCompaniesWithoutTenant) {
			const c = company as { id: string; name: string };
			console.log(`   - ${c.name}`);
		}

		// Try to get tenantId from company owners, otherwise use default tenant
		for (const company of accountCompaniesWithoutTenant) {
			const c = company as { id: string; name: string };
			
			// Find owner of the company
			const owner = await db`
				SELECT u.tenant_id FROM users_on_company uoc
				INNER JOIN users u ON uoc.user_id = u.id
				WHERE uoc.company_id = ${c.id}
				  AND uoc.role = 'owner'
				  AND u.tenant_id IS NOT NULL
				LIMIT 1
			`;

			const tenantId = owner.length > 0 
				? (owner[0].tenant_id as string)
				: defaultTenantId;

			await db`
				UPDATE companies 
				SET tenant_id = ${tenantId}, updated_at = NOW()
				WHERE id = ${c.id}
			`;
			console.log(`   ✅ Updated ${c.name} with tenantId`);
		}
		console.log();
	} else {
		console.log("   ✅ All account companies already have tenantId\n");
	}

	// Step 4: Update customer companies to have tenantId from their owner/creator
	console.log("👥 Step 4: Updating customer companies with tenantId...");
	const customerCompaniesWithoutTenant = await db`
		SELECT id, name FROM companies 
		WHERE source = 'customer'
		  AND tenant_id IS NULL
	`;

	if (customerCompaniesWithoutTenant.length > 0) {
		console.log(`   Found ${customerCompaniesWithoutTenant.length} customer company/companies without tenantId`);

		// For customer companies, try to get tenantId from:
		// 1. Company owner (users_on_company with role = 'owner')
		// 2. Any company member
		// 3. Default tenant as fallback
		for (const company of customerCompaniesWithoutTenant) {
			const c = company as { id: string; name: string };
			
			// Try to find tenantId from company members
			const member = await db`
				SELECT u.tenant_id FROM users_on_company uoc
				INNER JOIN users u ON uoc.user_id = u.id
				WHERE uoc.company_id = ${c.id}
				  AND u.tenant_id IS NOT NULL
				LIMIT 1
			`;

			const tenantId = member.length > 0 
				? (member[0].tenant_id as string)
				: defaultTenantId;

			await db`
				UPDATE companies 
				SET tenant_id = ${tenantId}, updated_at = NOW()
				WHERE id = ${c.id}
			`;
		}
		console.log(`   ✅ Updated ${customerCompaniesWithoutTenant.length} customer company/companies with tenantId\n`);
	} else {
		console.log("   ✅ All customer companies already have tenantId\n");
	}

	// Summary
	console.log("📊 Summary:");
	const stats = await db`
		SELECT 
			(SELECT COUNT(*) FROM users WHERE tenant_id IS NULL AND (role = 'tenant_admin' OR role = 'admin')) as users_without_tenant,
			(SELECT COUNT(*) FROM companies WHERE tenant_id IS NULL AND (source IS NULL OR source = 'account')) as account_companies_without_tenant,
			(SELECT COUNT(*) FROM companies WHERE tenant_id IS NULL AND source = 'customer') as customer_companies_without_tenant
	`;

	const s = stats[0] as {
		users_without_tenant: string;
		account_companies_without_tenant: string;
		customer_companies_without_tenant: string;
	};

	console.log(`   - Users without tenantId: ${s.users_without_tenant}`);
	console.log(`   - Account companies without tenantId: ${s.account_companies_without_tenant}`);
	console.log(`   - Customer companies without tenantId: ${s.customer_companies_without_tenant}`);
	console.log("\n✨ Tenant assignments fix completed!");
}

// Run if executed directly
if (import.meta.main) {
	fixTenantAssignments()
		.then(async () => {
			console.log("\n✅ Script completed successfully!");
			await db.end();
			process.exit(0);
		})
		.catch(async (error) => {
			console.error("\n❌ Script failed:", error);
			await db.end();
			process.exit(1);
		});
}

