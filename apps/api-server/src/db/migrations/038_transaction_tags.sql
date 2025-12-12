-- Transaction Tags System
-- Creates tags table and transaction_tags junction table
-- Similar to Midday's tagging system but adapted for CRM

-- ==============================================
-- TAGS TABLE (General Purpose)
-- ==============================================

CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Tag info
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  color VARCHAR(7) DEFAULT '#6366F1', -- Hex color code

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Unique constraint: name must be unique per tenant
  CONSTRAINT tags_unique_name UNIQUE (tenant_id, name),
  CONSTRAINT tags_unique_slug UNIQUE (tenant_id, slug)
);

-- Indexes for tags
CREATE INDEX IF NOT EXISTS idx_tags_tenant_id ON tags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- ==============================================
-- TRANSACTION TAGS JUNCTION TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS transaction_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Unique constraint: a tag can only be assigned once per transaction
  CONSTRAINT transaction_tags_unique UNIQUE (payment_id, tag_id)
);

-- Indexes for transaction_tags
CREATE INDEX IF NOT EXISTS idx_transaction_tags_tenant_id ON transaction_tags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transaction_tags_payment_id ON transaction_tags(payment_id);
CREATE INDEX IF NOT EXISTS idx_transaction_tags_tag_id ON transaction_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_transaction_tags_composite ON transaction_tags(payment_id, tag_id, tenant_id);

-- ==============================================
-- TRIGGERS
-- ==============================================

-- Update timestamp trigger for tags
CREATE OR REPLACE FUNCTION update_tags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_tags_updated ON tags;
CREATE TRIGGER tr_tags_updated
  BEFORE UPDATE ON tags
  FOR EACH ROW EXECUTE FUNCTION update_tags_updated_at();

-- ==============================================
-- COMMENTS
-- ==============================================

COMMENT ON TABLE tags IS 'General purpose tags for organizing entities (transactions, customers, projects)';
COMMENT ON TABLE transaction_tags IS 'Junction table linking transactions (payments) to tags';
COMMENT ON COLUMN tags.slug IS 'URL-friendly version of tag name for filtering';
COMMENT ON COLUMN tags.color IS 'Hex color code for visual representation';
