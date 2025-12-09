-- Migration: Add company_type column to companies table
-- Date: 2025-12-09
-- Description: Adds company_type column to distinguish between seller and customer companies

BEGIN;

-- Add company_type column to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS company_type VARCHAR(50);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_companies_company_type ON companies(company_type);

-- Backfill company_type based on source field
-- Default: if source is 'account' then set company_type to 'seller', otherwise 'customer'
UPDATE companies
SET company_type = CASE
  WHEN source = 'account' THEN 'seller'::company_type
  WHEN source = 'customer' THEN 'customer'::company_type
  ELSE 'customer'::company_type
END
WHERE company_type IS NULL;

COMMIT;

-- Verification
-- SELECT company_type, COUNT(*) as count FROM companies GROUP BY company_type;
