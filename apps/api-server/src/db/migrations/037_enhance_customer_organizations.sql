-- Enhance customer_organizations table to match Midday's customer structure
-- Adds address fields, notes, tags, and full-text search

-- Add address fields
ALTER TABLE customer_organizations
ADD COLUMN IF NOT EXISTS address_line_1 VARCHAR(255),
ADD COLUMN IF NOT EXISTS address_line_2 VARCHAR(255),
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS state VARCHAR(100),
ADD COLUMN IF NOT EXISTS country VARCHAR(100),
ADD COLUMN IF NOT EXISTS country_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS zip VARCHAR(20);

-- Add note field
ALTER TABLE customer_organizations
ADD COLUMN IF NOT EXISTS note TEXT;

-- Add tags as JSONB array for flexibility
ALTER TABLE customer_organizations
ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

-- Add full-text search vector column
ALTER TABLE customer_organizations
ADD COLUMN IF NOT EXISTS fts tsvector;

-- Create function to generate search vector
CREATE OR REPLACE FUNCTION customer_organizations_generate_fts()
RETURNS trigger AS $$
BEGIN
  NEW.fts := to_tsvector('simple',
    COALESCE(NEW.name, '') || ' ' ||
    COALESCE(NEW.email, '') || ' ' ||
    COALESCE(NEW.phone, '') || ' ' ||
    COALESCE(NEW.website, '') || ' ' ||
    COALESCE(NEW.pib, '') || ' ' ||
    COALESCE(NEW.company_number, '') || ' ' ||
    COALESCE(NEW.contact_person, '') || ' ' ||
    COALESCE(NEW.city, '') || ' ' ||
    COALESCE(NEW.country, '') || ' ' ||
    COALESCE(NEW.note, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic FTS update
DROP TRIGGER IF EXISTS customer_organizations_fts_trigger ON customer_organizations;
CREATE TRIGGER customer_organizations_fts_trigger
BEFORE INSERT OR UPDATE ON customer_organizations
FOR EACH ROW EXECUTE FUNCTION customer_organizations_generate_fts();

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_customer_organizations_fts
ON customer_organizations USING gin(fts);

-- Create index on tags for faster tag queries
CREATE INDEX IF NOT EXISTS idx_customer_organizations_tags
ON customer_organizations USING gin(tags);

-- Update existing rows to populate FTS
UPDATE customer_organizations SET updated_at = updated_at;
