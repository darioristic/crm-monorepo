-- Add website column to customer_organizations table
-- This is used to fetch company logos via logo.dev API

ALTER TABLE customer_organizations
ADD COLUMN IF NOT EXISTS website VARCHAR(255);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customer_organizations_website
ON customer_organizations(website)
WHERE website IS NOT NULL;
