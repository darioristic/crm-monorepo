-- Migration 028: Simplify Tenant/Seller Architecture
-- Remove duplicate seller concepts: tenant IS the seller, companies are ONLY customers

-- Step 1: Remove seller_company_id from sales documents
-- These documents already have tenant_id which identifies the seller

ALTER TABLE quotes
DROP COLUMN IF EXISTS seller_company_id;

ALTER TABLE invoices
DROP COLUMN IF EXISTS seller_company_id;

ALTER TABLE orders
DROP COLUMN IF EXISTS seller_company_id;

ALTER TABLE delivery_notes
DROP COLUMN IF EXISTS seller_company_id;

-- Step 2: Ensure all companies with company_type='seller' are migrated to separate handling
-- First, let's mark them or handle them appropriately

-- Convert any seller companies to customer type (tenants are the sellers now)
UPDATE companies
SET company_type = 'customer'
WHERE company_type = 'seller';

-- Step 3: Remove company_type enum since all companies are customers
-- First, set all to customer explicitly
UPDATE companies
SET company_type = 'customer'
WHERE company_type IS NULL;

-- Now we can safely drop the company_type column
-- (We keep it for now but enforce it's always 'customer' via application logic)
-- Alternatively, we can just add a check constraint

COMMENT ON COLUMN companies.company_type IS 'Deprecated: All companies are customers. Tenants represent sellers.';

-- Step 4: Add check constraint to ensure companies are only customers
ALTER TABLE companies
DROP CONSTRAINT IF EXISTS check_company_type_customer_only;

ALTER TABLE companies
ADD CONSTRAINT check_company_type_customer_only
CHECK (company_type = 'customer' OR company_type IS NULL);

-- Step 5: Add helpful comments to clarify the architecture
COMMENT ON TABLE tenants IS 'Seller companies/organizations that use the CRM system. Each tenant can have multiple users and customer companies.';
COMMENT ON TABLE companies IS 'Customer companies that belong to a tenant. These are the clients/customers of the tenant (seller).';
COMMENT ON COLUMN invoices.tenant_id IS 'The seller (tenant company) that created this invoice';
COMMENT ON COLUMN invoices.company_id IS 'The customer company this invoice is for';
COMMENT ON COLUMN quotes.tenant_id IS 'The seller (tenant company) that created this quote';
COMMENT ON COLUMN quotes.company_id IS 'The customer company this quote is for';
COMMENT ON COLUMN orders.tenant_id IS 'The seller (tenant company) that created this order';
COMMENT ON COLUMN orders.company_id IS 'The customer company this order is for';
COMMENT ON COLUMN delivery_notes.tenant_id IS 'The seller (tenant company) that created this delivery note';
COMMENT ON COLUMN delivery_notes.company_id IS 'The customer company this delivery note is for';
