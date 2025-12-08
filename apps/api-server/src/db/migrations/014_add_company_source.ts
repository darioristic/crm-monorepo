import { logger } from "../../lib/logger";
import { sql as db } from "../client";

export const name = "014_add_company_source";

export async function up(): Promise<void> {
  logger.info(`Running migration: ${name}`);

  // Add source column to companies table
  // 'manual' = created through /dashboard/companies page
  // 'inline' = created through inline forms (e.g., invoice form)
  await db`
    ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual' NOT NULL
  `;

  // Create index for source filtering
  await db`CREATE INDEX IF NOT EXISTS idx_companies_source ON companies(source)`;

  logger.info(`✅ Migration ${name} completed`);
}

export async function down(): Promise<void> {
  logger.info(`Rolling back migration: ${name}`);

  await db`DROP INDEX IF EXISTS idx_companies_source`;
  await db`ALTER TABLE companies DROP COLUMN IF EXISTS source`;

  logger.info(`✅ Rollback ${name} completed`);
}
