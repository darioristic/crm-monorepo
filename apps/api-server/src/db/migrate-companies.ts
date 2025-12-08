import { logger } from "../lib/logger";
import { sql as db } from "./client";

async function addCompanyColumns() {
  logger.info("🔄 Adding new columns to companies table...\n");

  try {
    // Add new columns to companies table if they don't exist
    const columns = [
      { name: "email", type: "VARCHAR(255)" },
      { name: "phone", type: "VARCHAR(50)" },
      { name: "website", type: "VARCHAR(255)" },
      { name: "contact", type: "VARCHAR(255)" },
      { name: "city", type: "VARCHAR(100)" },
      { name: "zip", type: "VARCHAR(20)" },
      { name: "country", type: "VARCHAR(100)" },
      { name: "country_code", type: "VARCHAR(10)" },
      { name: "vat_number", type: "VARCHAR(50)" },
      { name: "company_number", type: "VARCHAR(50)" },
      { name: "note", type: "TEXT" },
    ];

    for (const col of columns) {
      try {
        await db.unsafe(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
        logger.info(`  ✅ Added column: ${col.name}`);
      } catch (_e: unknown) {
        logger.info(`  ⏭️  Column ${col.name} may already exist`);
      }
    }

    // Add index on country
    try {
      await db.unsafe("CREATE INDEX IF NOT EXISTS idx_companies_country ON companies(country)");
      logger.info(`  ✅ Added index: idx_companies_country`);
    } catch (_e: unknown) {
      logger.info(`  ⏭️  Index already exists`);
    }

    logger.info("\n✅ Migration completed!\n");
  } catch (error) {
    logger.error("Migration failed:", error);
    throw error;
  } finally {
    await db.end();
  }
}

// Run if called directly
if (import.meta.main) {
  addCompanyColumns();
}
