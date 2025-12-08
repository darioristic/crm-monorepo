import { logger } from "../../lib/logger";
import { sql as db } from "../client";

export const name = "021_add_accounts_fields";

export async function up(): Promise<void> {
  logger.info(`Running migration: ${name}`);

  // Add JMBG and favorite flag to contacts
  await db`
    ALTER TABLE contacts
    ADD COLUMN IF NOT EXISTS jmbg VARCHAR(20);
  `;

  await db`
    ALTER TABLE contacts
    ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false;
  `;

  // Add favorite flag to companies
  await db`
    ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false;
  `;

  // Indexes for faster filtering
  await db`CREATE INDEX IF NOT EXISTS idx_contacts_is_favorite ON contacts(is_favorite)`;
  await db`CREATE INDEX IF NOT EXISTS idx_companies_is_favorite ON companies(is_favorite)`;

  logger.info(`✅ Migration ${name} completed`);
}

export async function down(): Promise<void> {
  logger.info(`Rolling back migration: ${name}`);
  await db`ALTER TABLE contacts DROP COLUMN IF EXISTS jmbg`;
  await db`ALTER TABLE contacts DROP COLUMN IF EXISTS is_favorite`;
  await db`ALTER TABLE companies DROP COLUMN IF EXISTS is_favorite`;
  await db`DROP INDEX IF EXISTS idx_contacts_is_favorite`;
  await db`DROP INDEX IF EXISTS idx_companies_is_favorite`;
  logger.info(`✅ Rollback ${name} completed`);
}
