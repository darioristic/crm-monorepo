import { sql as db } from "../client";

// Migration to enhance companies table with fields from midday-main
export async function enhanceCompaniesTable(): Promise<void> {
  console.log("Enhancing companies table...");

  // Add new columns to companies table
  await db`
    ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS website VARCHAR(255),
    ADD COLUMN IF NOT EXISTS contact VARCHAR(255),
    ADD COLUMN IF NOT EXISTS address_line_1 VARCHAR(255),
    ADD COLUMN IF NOT EXISTS address_line_2 VARCHAR(255),
    ADD COLUMN IF NOT EXISTS city VARCHAR(100),
    ADD COLUMN IF NOT EXISTS state VARCHAR(100),
    ADD COLUMN IF NOT EXISTS zip VARCHAR(20),
    ADD COLUMN IF NOT EXISTS country VARCHAR(100),
    ADD COLUMN IF NOT EXISTS country_code VARCHAR(10),
    ADD COLUMN IF NOT EXISTS vat_number VARCHAR(50),
    ADD COLUMN IF NOT EXISTS note TEXT,
    ADD COLUMN IF NOT EXISTS token VARCHAR(255) DEFAULT ''
  `;

  // Create full-text search index for companies
  await db`
    ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS fts tsvector
    GENERATED ALWAYS AS (
      to_tsvector(
        'english',
        COALESCE(name, '') || ' ' ||
        COALESCE(contact, '') || ' ' ||
        COALESCE(phone, '') || ' ' ||
        COALESCE(email, '') || ' ' ||
        COALESCE(address_line_1, '') || ' ' ||
        COALESCE(address_line_2, '') || ' ' ||
        COALESCE(city, '') || ' ' ||
        COALESCE(state, '') || ' ' ||
        COALESCE(zip, '') || ' ' ||
        COALESCE(country, '')
      )
    ) STORED
  `;

  // Create GIN index for full-text search
  await db`
    CREATE INDEX IF NOT EXISTS companies_fts_idx 
    ON companies USING gin(fts)
  `;

  // Create company_tags junction table
  await db`
    CREATE TABLE IF NOT EXISTS company_tags (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(company_id, tag_id)
    )
  `;

  // Create tags table if not exists
  await db`
    CREATE TABLE IF NOT EXISTS tags (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      color VARCHAR(50),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Create indexes
  await db`CREATE INDEX IF NOT EXISTS idx_company_tags_company_id ON company_tags(company_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_company_tags_tag_id ON company_tags(tag_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name)`;
  await db`CREATE INDEX IF NOT EXISTS idx_companies_email ON companies(email)`;
  await db`CREATE INDEX IF NOT EXISTS idx_companies_vat_number ON companies(vat_number)`;

  console.log("✅ Companies table enhanced successfully");
}

export async function rollbackEnhanceCompaniesTable(): Promise<void> {
  console.log("Rolling back companies enhancement...");

  await db`DROP TABLE IF EXISTS company_tags CASCADE`;
  await db`DROP TABLE IF EXISTS tags CASCADE`;
  
  await db`DROP INDEX IF EXISTS companies_fts_idx`;
  
  await db`
    ALTER TABLE companies
    DROP COLUMN IF EXISTS fts,
    DROP COLUMN IF EXISTS email,
    DROP COLUMN IF EXISTS billing_email,
    DROP COLUMN IF EXISTS phone,
    DROP COLUMN IF EXISTS website,
    DROP COLUMN IF EXISTS contact,
    DROP COLUMN IF EXISTS address_line_1,
    DROP COLUMN IF EXISTS address_line_2,
    DROP COLUMN IF EXISTS city,
    DROP COLUMN IF EXISTS state,
    DROP COLUMN IF EXISTS zip,
    DROP COLUMN IF EXISTS country,
    DROP COLUMN IF EXISTS country_code,
    DROP COLUMN IF EXISTS vat_number,
    DROP COLUMN IF EXISTS note,
    DROP COLUMN IF EXISTS token
  `;

  console.log("✅ Companies enhancement rolled back");
}

if (import.meta.main) {
  await enhanceCompaniesTable();
  process.exit(0);
}

