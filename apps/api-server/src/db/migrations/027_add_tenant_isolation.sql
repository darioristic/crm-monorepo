-- Migration 027: Add Tenant Isolation
-- Purpose: Add tenantId columns to all tables that need strict tenant isolation
-- This enables multi-tenant architecture where users can belong to multiple tenants

-- ============================================
-- Step 1: Add tenantId to sales documents
-- ============================================

-- Add tenantId to quotes (currently relies on companies.tenantId)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- Add tenantId to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- Add tenantId to orders (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS tenant_id UUID;
    END IF;
END $$;

-- Add tenantId to delivery_notes (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'delivery_notes') THEN
        ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS tenant_id UUID;
    END IF;
END $$;

-- ============================================
-- Step 2: Backfill tenantId from companies
-- ============================================

-- Backfill quotes.tenant_id
UPDATE quotes
SET tenant_id = companies.tenant_id
FROM companies
WHERE quotes.company_id = companies.id
AND quotes.tenant_id IS NULL;

-- Backfill invoices.tenant_id
UPDATE invoices
SET tenant_id = companies.tenant_id
FROM companies
WHERE invoices.company_id = companies.id
AND invoices.tenant_id IS NULL;

-- Backfill orders.tenant_id (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
        UPDATE orders
        SET tenant_id = companies.tenant_id
        FROM companies
        WHERE orders.company_id = companies.id
        AND orders.tenant_id IS NULL;
    END IF;
END $$;

-- Backfill delivery_notes.tenant_id (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'delivery_notes') THEN
        UPDATE delivery_notes
        SET tenant_id = companies.tenant_id
        FROM companies
        WHERE delivery_notes.company_id = companies.id
        AND delivery_notes.tenant_id IS NULL;
    END IF;
END $$;

-- ============================================
-- Step 3: Add NOT NULL constraints and foreign keys
-- ============================================

-- Add constraints to quotes
ALTER TABLE quotes
    ALTER COLUMN tenant_id SET NOT NULL,
    ADD CONSTRAINT fk_quotes_tenant_id
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Add constraints to invoices
ALTER TABLE invoices
    ALTER COLUMN tenant_id SET NOT NULL,
    ADD CONSTRAINT fk_invoices_tenant_id
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Add constraints to orders (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
        ALTER TABLE orders
            ALTER COLUMN tenant_id SET NOT NULL,
            ADD CONSTRAINT fk_orders_tenant_id
                FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add constraints to delivery_notes (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'delivery_notes') THEN
        ALTER TABLE delivery_notes
            ALTER COLUMN tenant_id SET NOT NULL,
            ADD CONSTRAINT fk_delivery_notes_tenant_id
                FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================
-- Step 4: Add products tenantId (if table exists)
-- ============================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
        -- Add column
        ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id UUID;

        -- For now, products without a clear tenant will need manual assignment
        -- or they can be assigned to a default tenant
        -- We'll leave as NULL for now and handle in application code

        -- Add foreign key constraint (nullable for now)
        ALTER TABLE products
            ADD CONSTRAINT fk_products_tenant_id
                FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================
-- Step 5: Add indexes for performance
-- ============================================

-- Quotes indexes
CREATE INDEX IF NOT EXISTS idx_quotes_tenant_id ON quotes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotes_tenant_company ON quotes(tenant_id, company_id);

-- Invoices indexes
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_company ON invoices(tenant_id, company_id);

-- Orders indexes (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
        CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_orders_tenant_company ON orders(tenant_id, company_id);
    END IF;
END $$;

-- Delivery notes indexes (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'delivery_notes') THEN
        CREATE INDEX IF NOT EXISTS idx_delivery_notes_tenant_id ON delivery_notes(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_delivery_notes_tenant_company ON delivery_notes(tenant_id, company_id);
    END IF;
END $$;

-- Products indexes (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
        CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);
    END IF;
END $$;

-- ============================================
-- Step 6: Create user_active_tenant table
-- ============================================

CREATE TABLE IF NOT EXISTS user_active_tenant (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    active_tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_active_tenant_tenant_id ON user_active_tenant(active_tenant_id);

-- ============================================
-- Validation queries (commented out)
-- ============================================

-- Verify all sales documents have tenantId:
-- SELECT 'quotes' as table_name, COUNT(*) as null_count FROM quotes WHERE tenant_id IS NULL
-- UNION ALL
-- SELECT 'invoices', COUNT(*) FROM invoices WHERE tenant_id IS NULL
-- UNION ALL
-- SELECT 'orders', COUNT(*) FROM orders WHERE tenant_id IS NULL
-- UNION ALL
-- SELECT 'delivery_notes', COUNT(*) FROM delivery_notes WHERE tenant_id IS NULL;

-- Verify no cross-tenant data leakage:
-- SELECT
--   i.id as invoice_id,
--   i.tenant_id as invoice_tenant,
--   c.tenant_id as company_tenant
-- FROM invoices i
-- JOIN companies c ON i.company_id = c.id
-- WHERE i.tenant_id != c.tenant_id;
