-- Migration: Improved Sales Schema with Multi-Tenancy and Cross-Document Workflows
-- Date: 2025-01-XX
-- Description: Adds comprehensive multi-tenant support, organization roles, and cross-document workflows

BEGIN;

-- ============================================
-- Step 1: Create New Enums
-- ============================================

-- Quote statuses
DO $$ BEGIN
  CREATE TYPE quote_status_new AS ENUM (
    'draft',
    'sent',
    'viewed',
    'accepted',
    'rejected',
    'expired',
    'converted'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Order statuses (enhanced)
DO $$ BEGIN
  CREATE TYPE order_status_new AS ENUM (
    'draft',
    'pending',
    'confirmed',
    'processing',
    'partially_fulfilled',
    'fulfilled',
    'partially_invoiced',
    'invoiced',
    'cancelled',
    'on_hold'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Invoice statuses (enhanced)
DO $$ BEGIN
  CREATE TYPE invoice_status_new AS ENUM (
    'draft',
    'sent',
    'viewed',
    'overdue',
    'partially_paid',
    'paid',
    'cancelled',
    'refunded'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Organization roles
DO $$ BEGIN
  CREATE TYPE organization_role AS ENUM (
    'customer',
    'vendor',
    'supplier',
    'partner',
    'internal'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- Step 2: Create Organization Roles Table
-- ============================================

CREATE TABLE IF NOT EXISTS organization_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role organization_role NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Financial settings per role
  default_payment_terms INTEGER, -- days
  default_currency VARCHAR(3) DEFAULT 'EUR',
  credit_limit NUMERIC(15, 2),

  -- Metadata
  metadata JSONB,

  -- Audit
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: one company can only have each role once per tenant
  UNIQUE(company_id, tenant_id, role)
);

CREATE INDEX IF NOT EXISTS idx_org_roles_company_tenant ON organization_roles(company_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_org_roles_tenant_role ON organization_roles(tenant_id, role);
CREATE INDEX IF NOT EXISTS idx_org_roles_is_active ON organization_roles(is_active);

-- ============================================
-- Step 3: Add tenantId to Existing Tables
-- ============================================

-- Add tenantId to quotes (if not exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE quotes ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add tenantId to orders (if not exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add tenantId to invoices (if not exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE invoices ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- Step 4: Backfill tenantId from companies
-- ============================================

-- Update quotes with tenantId from their companies
UPDATE quotes q
SET tenant_id = c.tenant_id
FROM companies c
WHERE q.company_id = c.id
AND q.tenant_id IS NULL;

-- Update orders with tenantId from their companies
UPDATE orders o
SET tenant_id = c.tenant_id
FROM companies c
WHERE o.company_id = c.id
AND o.tenant_id IS NULL;

-- Update invoices with tenantId from their companies
UPDATE invoices i
SET tenant_id = c.tenant_id
FROM companies c
WHERE i.company_id = c.id
AND i.tenant_id IS NULL;

-- Make tenantId NOT NULL after backfill
ALTER TABLE quotes ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE orders ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE invoices ALTER COLUMN tenant_id SET NOT NULL;

-- ============================================
-- Step 5: Add New Audit Columns
-- ============================================

-- Quotes
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS converted_to_order_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS converted_to_invoice_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS discount NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS customer_details JSONB;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS template_settings JSONB;

-- Orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_date TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS expected_delivery_date TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS actual_delivery_date TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoiced_amount NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS remaining_amount NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS purchase_order_number VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_details JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_details JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS from_details JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2) DEFAULT 0;

-- Invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_date TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_terms INTEGER;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS remaining_amount NUMERIC(15, 2) DEFAULT 0;

-- ============================================
-- Step 6: Add Items Tracking Columns
-- ============================================

-- Quote items
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS sku VARCHAR(100);
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Order items
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS quote_item_id UUID REFERENCES quote_items(id) ON DELETE SET NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sku VARCHAR(100);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS fulfilled_quantity NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS invoiced_quantity NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS invoiced_amount NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit VARCHAR(50) DEFAULT 'pcs';

-- Invoice items
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS quote_item_id UUID REFERENCES quote_items(id) ON DELETE SET NULL;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS sku VARCHAR(100);
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- ============================================
-- Step 7: Create Invoice-Order Bridge Table
-- ============================================

CREATE TABLE IF NOT EXISTS invoice_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  -- Amount allocated from this order to this invoice
  amount_allocated NUMERIC(15, 2) NOT NULL,

  -- Notes
  notes TEXT,

  -- Tracking
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: one order can be linked to same invoice only once
  UNIQUE(invoice_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_invoice_orders_invoice_id ON invoice_orders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_orders_order_id ON invoice_orders(order_id);

-- ============================================
-- Step 8: Migrate Existing order.invoice_id to Bridge Table
-- ============================================

-- Migrate existing order->invoice relationships to bridge table
INSERT INTO invoice_orders (invoice_id, order_id, amount_allocated, created_by, created_at)
SELECT
  o.invoice_id,
  o.id as order_id,
  o.total as amount_allocated,
  o.created_by,
  NOW()
FROM orders o
WHERE o.invoice_id IS NOT NULL
ON CONFLICT (invoice_id, order_id) DO NOTHING;

-- ============================================
-- Step 9: Remove Old invoice_id from Orders
-- ============================================

-- Drop the old invoice_id column from orders (now using bridge table)
-- WARNING: Uncomment only after verifying data migration
-- ALTER TABLE orders DROP COLUMN IF EXISTS invoice_id;

-- ============================================
-- Step 10: Update Indexes for Multi-Tenancy
-- ============================================

-- Quotes indexes
CREATE INDEX IF NOT EXISTS idx_quotes_tenant_company ON quotes(tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_quotes_tenant_status ON quotes(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_quotes_expires_at ON quotes(expires_at) WHERE expires_at IS NOT NULL;

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_orders_tenant_company ON orders(tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_purchase_order ON orders(purchase_order_number) WHERE purchase_order_number IS NOT NULL;

-- Invoices indexes
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_company ON invoices(tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_status ON invoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

-- Items indexes
CREATE INDEX IF NOT EXISTS idx_quote_items_product_id ON quote_items(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quote_items_sort_order ON quote_items(quote_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_order_items_quote_item_id ON order_items(quote_item_id) WHERE quote_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_sort_order ON order_items(order_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_invoice_items_order_item_id ON invoice_items(order_item_id) WHERE order_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoice_items_quote_item_id ON invoice_items(quote_item_id) WHERE quote_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoice_items_product_id ON invoice_items(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoice_items_sort_order ON invoice_items(invoice_id, sort_order);

-- ============================================
-- Step 11: Create Functions for Workflow Management
-- ============================================

-- Function to update order invoiced amount when invoice_orders changes
CREATE OR REPLACE FUNCTION update_order_invoiced_amount()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE orders
    SET
      invoiced_amount = COALESCE((
        SELECT SUM(amount_allocated)
        FROM invoice_orders
        WHERE order_id = NEW.order_id
      ), 0),
      remaining_amount = total - COALESCE((
        SELECT SUM(amount_allocated)
        FROM invoice_orders
        WHERE order_id = NEW.order_id
      ), 0),
      status = CASE
        WHEN COALESCE((
          SELECT SUM(amount_allocated)
          FROM invoice_orders
          WHERE order_id = NEW.order_id
        ), 0) >= total THEN 'invoiced'::order_status
        WHEN COALESCE((
          SELECT SUM(amount_allocated)
          FROM invoice_orders
          WHERE order_id = NEW.order_id
        ), 0) > 0 THEN 'partially_invoiced'::order_status
        ELSE status
      END,
      updated_at = NOW()
    WHERE id = NEW.order_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE orders
    SET
      invoiced_amount = COALESCE((
        SELECT SUM(amount_allocated)
        FROM invoice_orders
        WHERE order_id = OLD.order_id
      ), 0),
      remaining_amount = total - COALESCE((
        SELECT SUM(amount_allocated)
        FROM invoice_orders
        WHERE order_id = OLD.order_id
      ), 0),
      updated_at = NOW()
    WHERE id = OLD.order_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for order invoiced amount updates
DROP TRIGGER IF EXISTS trg_update_order_invoiced_amount ON invoice_orders;
CREATE TRIGGER trg_update_order_invoiced_amount
  AFTER INSERT OR UPDATE OR DELETE ON invoice_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_order_invoiced_amount();

-- Function to update invoice remaining amount
CREATE OR REPLACE FUNCTION update_invoice_remaining_amount()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE invoices
  SET
    remaining_amount = total - paid_amount,
    status = CASE
      WHEN paid_amount >= total THEN 'paid'::invoice_status
      WHEN paid_amount > 0 THEN 'partially_paid'::invoice_status
      WHEN due_date < NOW() AND paid_amount = 0 THEN 'overdue'::invoice_status
      ELSE status
    END,
    updated_at = NOW()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for invoice remaining amount updates
DROP TRIGGER IF EXISTS trg_update_invoice_remaining_amount ON invoices;
CREATE TRIGGER trg_update_invoice_remaining_amount
  AFTER UPDATE OF paid_amount ON invoices
  FOR EACH ROW
  WHEN (OLD.paid_amount IS DISTINCT FROM NEW.paid_amount)
  EXECUTE FUNCTION update_invoice_remaining_amount();

-- ============================================
-- Step 12: Backfill Organization Roles
-- ============================================

-- Create customer role for all companies with invoices/quotes/orders
INSERT INTO organization_roles (company_id, tenant_id, role, is_active, created_by, created_at, updated_at)
SELECT DISTINCT
  c.id as company_id,
  c.tenant_id,
  'customer'::organization_role as role,
  true as is_active,
  (SELECT id FROM users WHERE tenant_id = c.tenant_id ORDER BY created_at LIMIT 1) as created_by,
  NOW() as created_at,
  NOW() as updated_at
FROM companies c
WHERE c.tenant_id IS NOT NULL
AND (
  EXISTS (SELECT 1 FROM quotes WHERE company_id = c.id) OR
  EXISTS (SELECT 1 FROM orders WHERE company_id = c.id) OR
  EXISTS (SELECT 1 FROM invoices WHERE company_id = c.id)
)
ON CONFLICT (company_id, tenant_id, role) DO NOTHING;

-- ============================================
-- Step 13: Add Comments for Documentation
-- ============================================

COMMENT ON TABLE organization_roles IS 'Allows one company to have multiple roles (customer, vendor, supplier, partner)';
COMMENT ON TABLE invoice_orders IS 'Bridge table for multi-order invoicing - tracks which orders are included in each invoice';

COMMENT ON COLUMN orders.invoiced_amount IS 'Total amount invoiced from this order (tracked via invoice_orders)';
COMMENT ON COLUMN orders.remaining_amount IS 'Remaining amount to be invoiced (total - invoiced_amount)';
COMMENT ON COLUMN invoices.remaining_amount IS 'Remaining amount to be paid (total - paid_amount)';

COMMIT;

-- ============================================
-- Verification Queries
-- ============================================

-- Verify tenantId backfill
-- SELECT
--   'quotes' as table_name,
--   COUNT(*) as total,
--   COUNT(tenant_id) as with_tenant_id
-- FROM quotes
-- UNION ALL
-- SELECT
--   'orders',
--   COUNT(*),
--   COUNT(tenant_id)
-- FROM orders
-- UNION ALL
-- SELECT
--   'invoices',
--   COUNT(*),
--   COUNT(tenant_id)
-- FROM invoices;

-- Verify organization roles
-- SELECT
--   c.name as company_name,
--   t.name as tenant_name,
--   array_agg(DISTINCT o.role::text) as roles
-- FROM companies c
-- JOIN tenants t ON c.tenant_id = t.id
-- LEFT JOIN organization_roles o ON o.company_id = c.id
-- GROUP BY c.id, c.name, t.name
-- ORDER BY t.name, c.name;

-- Verify invoice-order relationships
-- SELECT
--   i.invoice_number,
--   COUNT(io.order_id) as order_count,
--   SUM(io.amount_allocated) as total_allocated,
--   i.total as invoice_total
-- FROM invoices i
-- LEFT JOIN invoice_orders io ON io.invoice_id = i.id
-- GROUP BY i.id, i.invoice_number, i.total
-- HAVING COUNT(io.order_id) > 0;
