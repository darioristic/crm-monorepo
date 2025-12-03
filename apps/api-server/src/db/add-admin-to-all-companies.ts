import { sql as db } from "./client";
import { now } from "@crm/utils";

/**
 * Script to add admin users to 3 account companies for multi-tenant testing.
 * 
 * This script:
 * - Finds all admin users
 * - Finds the first 3 account companies (tenant companies)
 * - Removes admin users from all other account companies
 * - Adds admin users to these 3 companies only
 * 
 * Note: Only ACCOUNT companies (source = 'account' or NULL) are used, not CUSTOMER companies.
 * Customer companies are clients and don't use the app directly.
 * 
 * Usage: Run this script to ensure admin users have access to exactly 3 companies for testing.
 */
export async function addAdminToAllCompanies(): Promise<void> {
  console.log("🔍 Finding all admin users...");

  // Find ALL admin users (not just one)
  const adminUsers = await db`
    SELECT id, first_name, last_name, email FROM users WHERE role = 'admin' ORDER BY created_at ASC
  `;

  if (adminUsers.length === 0) {
    console.log("⚠️  No admin users found. Create an admin user first.");
    return;
  }

  console.log(`✅ Found ${adminUsers.length} admin user(s):`);
  adminUsers.forEach((admin: any) => {
    console.log(`   - ${admin.email} (${admin.id})`);
  });

  // Get only 3 account companies (for multi-tenant testing)
  // Admin should be able to switch between only 3 companies, not all of them
  console.log("🔍 Finding 3 account companies for admin access...");
  const accountCompanies = await db`
    SELECT id, name, source 
    FROM companies 
    WHERE (source IS NULL OR source != 'customer')
    ORDER BY created_at ASC
    LIMIT 3
  `;

  if (accountCompanies.length === 0) {
    console.log("⚠️  No account companies found in database.");
    return;
  }

  if (accountCompanies.length < 3) {
    console.log(`⚠️  Only ${accountCompanies.length} account companies found. Need at least 3 companies for multi-tenant testing.`);
    return;
  }
  
  console.log(`✅ Found ${accountCompanies.length} account companies for admin access:`);
  accountCompanies.forEach((c: any) => {
    console.log(`   - ${c.name} (${c.source || 'legacy'})`);
  });
  
  // Remove admin users from all other companies first
  console.log("\n🧹 Removing admin users from all other companies (keeping only these 3)...");
  const companyIds = accountCompanies.map((c: any) => c.id);
  
  for (const admin of adminUsers) {
    const companiesToRemove = await db`
      SELECT c.id, c.name
      FROM users_on_company uoc
      INNER JOIN companies c ON uoc.company_id = c.id
      WHERE uoc.user_id = ${admin.id}
        AND (c.source IS NULL OR c.source != 'customer')
    `;
    
    // Filter out the 3 companies we want to keep
    const toRemove = companiesToRemove.filter((c: any) => !companyIds.includes(c.id));
    
    if (toRemove.length > 0) {
      console.log(`  Removing ${admin.email} from ${toRemove.length} companies...`);
      for (const company of toRemove) {
        await db`
          DELETE FROM users_on_company
          WHERE user_id = ${admin.id} AND company_id = ${company.id}
        `;
      }
    }
  }
  
  console.log("✅ Cleanup completed!");

  // Add ALL admin users to all ACCOUNT companies
  let totalAddedCount = 0;
  let totalSkippedCount = 0;

  for (const admin of adminUsers) {
    console.log(`\n👤 Processing admin: ${admin.email}...`);
    let addedCount = 0;
    let skippedCount = 0;

    for (const company of accountCompanies) {
      // Check if already a member
      const existing = await db`
        SELECT id FROM users_on_company 
        WHERE user_id = ${admin.id} AND company_id = ${company.id}
      `;

      if (existing.length === 0) {
        await db`
          INSERT INTO users_on_company (user_id, company_id, role, created_at)
          VALUES (${admin.id}, ${company.id}, 'admin', ${now()})
          ON CONFLICT (user_id, company_id) DO NOTHING
        `;
        console.log(`  ✓ Added ${admin.email} to ${company.name} (${company.source || 'legacy'})`);
        addedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log(`  ✅ ${admin.email}: Added to ${addedCount} new companies, already member of ${skippedCount}`);
    totalAddedCount += addedCount;
    totalSkippedCount += skippedCount;
  }

  console.log("\n✅ Completed!");
  console.log(`   - Total added: ${totalAddedCount} new memberships`);
  console.log(`   - Total already members: ${totalSkippedCount}`);
  console.log(`   - Account companies: ${accountCompanies.length}`);
  console.log(`   - Admin users processed: ${adminUsers.length}`);
}

// Run if executed directly
if (import.meta.main) {
  addAdminToAllCompanies()
    .then(async () => {
      console.log("\n✨ Script completed successfully!");
      await db.end();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error("\n❌ Script failed:", error);
      await db.end();
      process.exit(1);
    });
}

