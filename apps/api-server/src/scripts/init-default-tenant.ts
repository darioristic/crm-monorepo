import { db } from "../db/client";
import { tenants, companies, users } from "../db/schema/index";
import { eq, isNull } from "drizzle-orm";
import { logger } from "../lib/logger";

async function initDefaultTenant() {
  try {
    logger.info("Starting init-default-tenant script");

    const existing = await db.select().from(tenants).limit(1);
    if (existing.length > 0) {
      logger.info({ tenantId: existing[0].id }, "Tenant already exists");
      return { tenantId: existing[0].id, created: false };
    }

    const [createdTenant] = await db
      .insert(tenants)
      .values({
        name: "Default Tenant",
        slug: "default",
        status: "active",
        metadata: { initializedBy: "script", timestamp: new Date().toISOString() },
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const defaultTenantId = createdTenant.id;
    logger.info({ tenantId: defaultTenantId }, "Created default tenant");

    const companiesUpdated = await db
      .update(companies)
      .set({ tenantId: defaultTenantId, updatedAt: new Date() })
      .where(isNull(companies.tenantId))
      .returning({ id: companies.id });

    const usersUpdated = await db
      .update(users)
      .set({ tenantId: defaultTenantId, updatedAt: new Date() })
      .where(isNull(users.tenantId))
      .returning({ id: users.id });

    logger.info({ companiesUpdated: companiesUpdated.length, usersUpdated: usersUpdated.length }, "Backfill complete");

    return {
      tenantId: defaultTenantId,
      created: true,
      companiesUpdated: companiesUpdated.length,
      usersUpdated: usersUpdated.length,
    };
  } catch (error) {
    logger.error({ error }, "init-default-tenant script failed");
    throw error;
  }
}

if (import.meta.main) {
  initDefaultTenant()
    .then((result) => {
      logger.info({ result }, "Script finished successfully");
      process.exit(0);
    })
    .catch((error) => {
      logger.error({ error }, "Script failed");
      process.exit(1);
    });
}

export { initDefaultTenant };
