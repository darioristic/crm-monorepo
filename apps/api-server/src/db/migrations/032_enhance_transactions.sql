-- Enhanced Transactions System
-- Adds categories, attachments, and additional transaction fields
-- Adapted from Midday's transaction system

-- ==============================================
-- ENUM TYPES
-- ==============================================

-- Transaction methods (with IF NOT EXISTS check)
DO $$ BEGIN
  CREATE TYPE transaction_method AS ENUM (
    'payment',
    'card_purchase',
    'transfer',
    'deposit',
    'withdrawal',
    'fee',
    'interest',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Transaction frequency for recurring (with IF NOT EXISTS check)
DO $$ BEGIN
  CREATE TYPE transaction_frequency AS ENUM (
    'weekly',
    'biweekly',
    'monthly',
    'annually',
    'unknown'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ==============================================
-- TRANSACTION CATEGORIES TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS transaction_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Category info
  slug VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(7), -- Hex color code
  icon VARCHAR(50),

  -- Hierarchy
  parent_slug VARCHAR(100),

  -- VAT settings
  vat_rate DECIMAL(5, 2) DEFAULT 0,

  -- Embedding for AI categorization
  embedding_text TEXT,

  -- System category (cannot be deleted)
  is_system BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Unique slug per tenant
  CONSTRAINT transaction_categories_unique UNIQUE (tenant_id, slug)
);

CREATE INDEX idx_transaction_categories_tenant ON transaction_categories(tenant_id);
CREATE INDEX idx_transaction_categories_slug ON transaction_categories(slug);
CREATE INDEX idx_transaction_categories_parent ON transaction_categories(parent_slug);

-- ==============================================
-- TRANSACTION ATTACHMENTS TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS transaction_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,

  -- File info
  name VARCHAR(500) NOT NULL,
  file_path TEXT[] NOT NULL,
  content_type VARCHAR(100),
  size BIGINT,

  -- Metadata
  description TEXT,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_transaction_attachments_tenant ON transaction_attachments(tenant_id);
CREATE INDEX idx_transaction_attachments_payment ON transaction_attachments(payment_id);

-- ==============================================
-- ENHANCE PAYMENTS TABLE
-- ==============================================

-- Add new columns to payments table
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS method transaction_method DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS category_slug VARCHAR(100),
  ADD COLUMN IF NOT EXISTS merchant_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS vendor_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS base_amount DECIMAL(15, 4),
  ADD COLUMN IF NOT EXISTS base_currency VARCHAR(3),
  ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(15, 4),
  ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS tax_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS frequency transaction_frequency,
  ADD COLUMN IF NOT EXISTS counterparty_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS internal_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS bank_account_id UUID,
  ADD COLUMN IF NOT EXISTS enrichment_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual BOOLEAN DEFAULT false;

-- Add full-text search vector
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS fts_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', COALESCE(description, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(vendor_name, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(merchant_name, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(notes, '')), 'C')
  ) STORED;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_payments_category ON payments(category_slug);
CREATE INDEX IF NOT EXISTS idx_payments_merchant ON payments(merchant_name);
CREATE INDEX IF NOT EXISTS idx_payments_vendor ON payments(vendor_name);
CREATE INDEX IF NOT EXISTS idx_payments_recurring ON payments(is_recurring) WHERE is_recurring = true;
CREATE INDEX IF NOT EXISTS idx_payments_fts ON payments USING gin(fts_vector);

-- ==============================================
-- SEED DEFAULT CATEGORIES
-- ==============================================

-- Function to seed default categories for a tenant
CREATE OR REPLACE FUNCTION seed_default_transaction_categories(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO transaction_categories (tenant_id, slug, name, description, color, icon, is_system)
  VALUES
    -- Income categories
    (p_tenant_id, 'income', 'Income', 'All income and revenue', '#22C55E', 'trending-up', true),
    (p_tenant_id, 'sales', 'Sales', 'Product and service sales', '#22C55E', 'shopping-cart', true),
    (p_tenant_id, 'refunds-received', 'Refunds Received', 'Refunds from vendors', '#22C55E', 'refresh-cw', true),

    -- Expense categories
    (p_tenant_id, 'expenses', 'Expenses', 'All expenses', '#EF4444', 'trending-down', true),
    (p_tenant_id, 'office-supplies', 'Office Supplies', 'Office equipment and supplies', '#3B82F6', 'briefcase', true),
    (p_tenant_id, 'software', 'Software & Subscriptions', 'Software licenses and subscriptions', '#8B5CF6', 'monitor', true),
    (p_tenant_id, 'travel', 'Travel', 'Business travel expenses', '#F59E0B', 'plane', true),
    (p_tenant_id, 'meals', 'Meals & Entertainment', 'Business meals and entertainment', '#EC4899', 'utensils', true),
    (p_tenant_id, 'utilities', 'Utilities', 'Electricity, water, internet', '#14B8A6', 'zap', true),
    (p_tenant_id, 'rent', 'Rent', 'Office and facility rent', '#6366F1', 'home', true),
    (p_tenant_id, 'salaries', 'Salaries & Wages', 'Employee compensation', '#F97316', 'users', true),
    (p_tenant_id, 'marketing', 'Marketing', 'Advertising and marketing', '#06B6D4', 'megaphone', true),
    (p_tenant_id, 'professional-services', 'Professional Services', 'Legal, accounting, consulting', '#84CC16', 'briefcase', true),
    (p_tenant_id, 'taxes', 'Taxes', 'Tax payments', '#DC2626', 'file-text', true),
    (p_tenant_id, 'bank-fees', 'Bank Fees', 'Bank charges and fees', '#64748B', 'credit-card', true),
    (p_tenant_id, 'insurance', 'Insurance', 'Business insurance', '#0EA5E9', 'shield', true),
    (p_tenant_id, 'other', 'Other', 'Uncategorized transactions', '#94A3B8', 'more-horizontal', true)
  ON CONFLICT (tenant_id, slug) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- TRIGGERS
-- ==============================================

-- Update timestamp trigger for categories
CREATE OR REPLACE FUNCTION update_category_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_transaction_categories_updated ON transaction_categories;
CREATE TRIGGER tr_transaction_categories_updated
  BEFORE UPDATE ON transaction_categories
  FOR EACH ROW EXECUTE FUNCTION update_category_updated_at();

-- ==============================================
-- COMMENTS
-- ==============================================

COMMENT ON TABLE transaction_categories IS 'Categories for organizing transactions with AI-assisted categorization';
COMMENT ON TABLE transaction_attachments IS 'File attachments linked to transactions (receipts, invoices)';
COMMENT ON COLUMN payments.method IS 'Transaction method: payment, card_purchase, transfer, etc.';
COMMENT ON COLUMN payments.category_slug IS 'Reference to transaction category';
COMMENT ON COLUMN payments.base_amount IS 'Amount converted to base currency for multi-currency support';
COMMENT ON COLUMN payments.is_recurring IS 'Flag for recurring transactions';
COMMENT ON COLUMN payments.enrichment_completed IS 'Flag indicating AI enrichment has been applied';
