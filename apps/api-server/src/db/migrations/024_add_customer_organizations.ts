import { logger } from "../../lib/logger";
import { sql as db } from "../client";

export const name = "024_add_customer_organizations";

export async function up(): Promise<void> {
  logger.info(`Running migration: ${name}`);
  await db`
    CREATE TABLE IF NOT EXISTS customer_organizations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      phone VARCHAR(50),
      pib VARCHAR(50),
      company_number VARCHAR(50),
      contact_person VARCHAR(255),
      is_favorite BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await db`CREATE INDEX IF NOT EXISTS idx_customer_orgs_name ON customer_organizations(name)`;
  await db`CREATE INDEX IF NOT EXISTS idx_customer_orgs_pib ON customer_organizations(pib)`;
  await db`CREATE INDEX IF NOT EXISTS idx_customer_orgs_company_number ON customer_organizations(company_number)`;
  await db`CREATE INDEX IF NOT EXISTS idx_customer_orgs_is_favorite ON customer_organizations(is_favorite)`;
  logger.info(`✅ Migration ${name} completed`);
}

export async function down(): Promise<void> {
  logger.info(`Rolling back migration: ${name}`);
  await db`DROP TABLE IF EXISTS customer_organizations`;
  logger.info(`✅ Rollback ${name} completed`);
}
