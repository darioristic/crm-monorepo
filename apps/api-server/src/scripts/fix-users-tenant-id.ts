/**
 * Script to fix users without tenantId
 * Assigns tenantId to users based on their company's tenantId, or creates a default tenant
 */

import { db } from "../db/client";
import { users, companies, tenants } from "../db/schema/index";
import { eq, isNull, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

async function fixUsersTenantId() {
	try {
		logger.info("Starting fix-users-tenant-id script");

		// Find all users without tenantId
		const usersWithoutTenant = await db
			.select()
			.from(users)
			.where(isNull(users.tenantId));

		logger.info(`Found ${usersWithoutTenant.length} users without tenantId`);

		if (usersWithoutTenant.length === 0) {
			logger.info("All users already have tenantId");
			return;
		}

		// Get all tenants to find default tenant
		const allTenants = await db.select().from(tenants).limit(1);
		
		if (allTenants.length === 0) {
			logger.error("No tenants found in database. Please create a tenant first.");
			return;
		}

		const defaultTenantId = allTenants[0].id;
		logger.info(`Using default tenant: ${defaultTenantId}`);

		let fixedCount = 0;
		let skippedCount = 0;

		for (const user of usersWithoutTenant) {
			// Skip superadmin users (they don't need tenantId)
			if (user.role === "superadmin") {
				logger.info(`Skipping superadmin user: ${user.email}`);
				skippedCount++;
				continue;
			}

			// Assign default tenantId
			const tenantIdToAssign: string | null = defaultTenantId;
			logger.info(`User ${user.email} will get tenantId: ${tenantIdToAssign}`);

			// Update user with tenantId
			await db
				.update(users)
				.set({
					tenantId: tenantIdToAssign,
					updatedAt: new Date(),
				})
				.where(eq(users.id, user.id));

			logger.info(`Updated user ${user.email} with tenantId: ${tenantIdToAssign}`);
			fixedCount++;
		}

		logger.info(
			`Script completed. Fixed: ${fixedCount}, Skipped: ${skippedCount}`,
		);
	} catch (error) {
		logger.error({ error }, "Error in fix-users-tenant-id script");
		throw error;
	}
}

// Run the script
if (import.meta.main) {
	fixUsersTenantId()
		.then(() => {
			logger.info("Script finished successfully");
			process.exit(0);
		})
		.catch((error) => {
			logger.error({ error }, "Script failed");
			process.exit(1);
		});
}

export { fixUsersTenantId };
