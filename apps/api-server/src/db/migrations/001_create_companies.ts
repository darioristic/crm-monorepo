import { sql as db } from "../client";

export const name = "001_create_companies";

export async function up(): Promise<void> {
  console.log(`Running migration: ${name}`);

  await db`
    CREATE TABLE IF NOT EXISTS companies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      industry VARCHAR(255) NOT NULL,
      address TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Create index for company name search
  await db`CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name)`;
  await db`CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry)`;

  console.log(`✅ Migration ${name} completed`);
}

export async function down(): Promise<void> {
  console.log(`Rolling back migration: ${name}`);

  await db`DROP INDEX IF EXISTS idx_companies_industry`;
  await db`DROP INDEX IF EXISTS idx_companies_name`;
  await db`DROP TABLE IF EXISTS companies CASCADE`;

  console.log(`✅ Rollback ${name} completed`);
}
