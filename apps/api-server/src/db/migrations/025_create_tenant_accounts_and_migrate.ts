import { logger } from "../../lib/logger";
import { sql as db } from "../client";

export const name = "025_create_tenant_accounts_and_migrate";

export async function up(): Promise<void> {
  logger.info(`Running migration: ${name}`);

  await db`
    CREATE TABLE IF NOT EXISTS tenant_accounts (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
      name VARCHAR(255) NOT NULL,
      industry VARCHAR(255) NOT NULL,
      address TEXT NOT NULL,
      email VARCHAR(255),
      phone VARCHAR(50),
      website VARCHAR(255),
      contact VARCHAR(255),
      city VARCHAR(100),
      zip VARCHAR(20),
      country VARCHAR(100),
      country_code VARCHAR(10),
      vat_number VARCHAR(50),
      company_number VARCHAR(50),
      logo_url TEXT,
      note TEXT,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await db`CREATE INDEX IF NOT EXISTS idx_tenant_accounts_tenant_id ON tenant_accounts(tenant_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_tenant_accounts_name ON tenant_accounts(name)`;
  await db`CREATE INDEX IF NOT EXISTS idx_tenant_accounts_industry ON tenant_accounts(industry)`;

  await db`
    INSERT INTO tenant_accounts (
      id,
      tenant_id,
      location_id,
      name,
      industry,
      address,
      email,
      phone,
      website,
      contact,
      city,
      zip,
      country,
      country_code,
      vat_number,
      company_number,
      logo_url,
      note,
      metadata,
      created_at,
      updated_at
    )
    SELECT 
      c.id,
      c.tenant_id,
      c.location_id,
      c.name,
      c.industry,
      c.address,
      c.email,
      c.phone,
      c.website,
      c.contact,
      c.city,
      c.zip,
      c.country,
      c.country_code,
      c.vat_number,
      c.company_number,
      c.logo_url,
      c.note,
      c.metadata,
      c.created_at,
      c.updated_at
    FROM companies c
    WHERE c.source = 'account'
    ON CONFLICT (id) DO NOTHING
  `;

  logger.info(`✅ Migration ${name} completed`);
}

export async function down(): Promise<void> {
  logger.info(`Rolling back migration: ${name}`);

  await db`DROP INDEX IF EXISTS idx_tenant_accounts_industry`;
  await db`DROP INDEX IF EXISTS idx_tenant_accounts_name`;
  await db`DROP INDEX IF EXISTS idx_tenant_accounts_tenant_id`;
  await db`DROP TABLE IF EXISTS tenant_accounts`;

  logger.info(`✅ Rollback ${name} completed`);
}
