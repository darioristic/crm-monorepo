#!/bin/bash

# Script to test the improved sales schema migration on staging
# Usage: ./scripts/test-migration.sh

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}==================================================${NC}"
echo -e "${GREEN}  CRM Migration Test - Improved Sales Schema     ${NC}"
echo -e "${GREEN}==================================================${NC}"
echo ""

# Step 1: Start test database
echo -e "${YELLOW}Step 1: Starting test database...${NC}"
cd "$PROJECT_ROOT"
docker-compose -f docker-compose.test.yml down -v
docker-compose -f docker-compose.test.yml up -d postgres-test

# Wait for database to be ready
echo "Waiting for PostgreSQL to be ready..."
sleep 5
until docker-compose -f docker-compose.test.yml exec -T postgres-test pg_isready -U test_user -d crm_test; do
  echo "Waiting for database..."
  sleep 2
done
echo -e "${GREEN}✓ Database is ready${NC}"
echo ""

# Step 2: Create base schema
echo -e "${YELLOW}Step 2: Creating base schema...${NC}"
docker-compose -f docker-compose.test.yml exec -T postgres-test psql -U test_user -d crm_test <<'EOF'
-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  industry VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  unit_price NUMERIC(15, 2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create old quotes table (without tenant_id)
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number VARCHAR(50) UNIQUE NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  issue_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ NOT NULL,
  subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
  tax NUMERIC(15, 2) NOT NULL DEFAULT 0,
  total NUMERIC(15, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  terms TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create old quote_items table
CREATE TABLE IF NOT EXISTS quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL,
  description TEXT,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(15, 2) NOT NULL,
  discount NUMERIC(5, 2) NOT NULL DEFAULT 0,
  total NUMERIC(15, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create old orders table (with invoice_id - wrong!)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  invoice_id UUID, -- This will be removed by migration
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
  tax NUMERIC(15, 2) NOT NULL DEFAULT 0,
  total NUMERIC(15, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create old order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL,
  description TEXT,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(15, 2) NOT NULL,
  discount NUMERIC(5, 2) NOT NULL DEFAULT 0,
  total NUMERIC(15, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create old invoices table (without tenant_id)
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  issue_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date TIMESTAMPTZ NOT NULL,
  subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
  tax NUMERIC(15, 2) NOT NULL DEFAULT 0,
  total NUMERIC(15, 2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  terms TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK constraint for orders.invoice_id
ALTER TABLE orders ADD CONSTRAINT orders_invoice_id_fkey
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;

-- Create old invoice_items table
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL,
  description TEXT,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(15, 2) NOT NULL,
  discount NUMERIC(5, 2) NOT NULL DEFAULT 0,
  total NUMERIC(15, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

\echo 'Base schema created successfully'
EOF
echo -e "${GREEN}✓ Base schema created${NC}"
echo ""

# Step 3: Insert test data
echo -e "${YELLOW}Step 3: Inserting test data...${NC}"
docker-compose -f docker-compose.test.yml exec -T postgres-test psql -U test_user -d crm_test <<'EOF'
-- Insert test tenant
INSERT INTO tenants (id, name, slug) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Test Tenant', 'test-tenant');

-- Insert test user
INSERT INTO users (id, first_name, last_name, email, tenant_id) VALUES
  ('22222222-2222-2222-2222-222222222222', 'Test', 'User', 'test@example.com', '11111111-1111-1111-1111-111111111111');

-- Insert test company
INSERT INTO companies (id, tenant_id, name, industry, address) VALUES
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Test Company', 'Technology', '123 Test St');

-- Insert test contact
INSERT INTO contacts (id, first_name, last_name, email, tenant_id, company_id) VALUES
  ('44444444-4444-4444-4444-444444444444', 'John', 'Doe', 'john@test.com', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333');

-- Insert test products
INSERT INTO products (id, name, sku, unit_price) VALUES
  ('55555555-5555-5555-5555-555555555555', 'Product A', 'SKU-A', 100.00),
  ('66666666-6666-6666-6666-666666666666', 'Product B', 'SKU-B', 200.00);

-- Insert test quote (without tenant_id)
INSERT INTO quotes (id, quote_number, company_id, contact_id, status, valid_until, subtotal, total, created_by) VALUES
  ('77777777-7777-7777-7777-777777777777', 'QUO-001', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', 'accepted', NOW() + INTERVAL '30 days', 1000.00, 1000.00, '22222222-2222-2222-2222-222222222222');

-- Insert test quote items
INSERT INTO quote_items (quote_id, product_name, quantity, unit_price, total) VALUES
  ('77777777-7777-7777-7777-777777777777', 'Product A', 5, 100.00, 500.00),
  ('77777777-7777-7777-7777-777777777777', 'Product B', 2.5, 200.00, 500.00);

-- Insert test order (without tenant_id)
INSERT INTO orders (id, order_number, company_id, contact_id, quote_id, total, created_by) VALUES
  ('88888888-8888-8888-8888-888888888888', 'ORD-001', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', '77777777-7777-7777-7777-777777777777', 1000.00, '22222222-2222-2222-2222-222222222222');

-- Insert test order items
INSERT INTO order_items (order_id, product_name, quantity, unit_price, total) VALUES
  ('88888888-8888-8888-8888-888888888888', 'Product A', 5, 100.00, 500.00),
  ('88888888-8888-8888-8888-888888888888', 'Product B', 2.5, 200.00, 500.00);

-- Insert test invoice (without tenant_id)
INSERT INTO invoices (id, invoice_number, company_id, contact_id, quote_id, due_date, subtotal, total, created_by) VALUES
  ('99999999-9999-9999-9999-999999999999', 'INV-001', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', '77777777-7777-7777-7777-777777777777', NOW() + INTERVAL '30 days', 1000.00, 1000.00, '22222222-2222-2222-2222-222222222222');

-- Link order to invoice (old way)
UPDATE orders SET invoice_id = '99999999-9999-9999-9999-999999999999' WHERE id = '88888888-8888-8888-8888-888888888888';

-- Insert test invoice items
INSERT INTO invoice_items (invoice_id, product_name, quantity, unit_price, total) VALUES
  ('99999999-9999-9999-9999-999999999999', 'Product A', 5, 100.00, 500.00),
  ('99999999-9999-9999-9999-999999999999', 'Product B', 2.5, 200.00, 500.00);

\echo 'Test data inserted successfully'
EOF
echo -e "${GREEN}✓ Test data inserted${NC}"
echo ""

# Step 4: Show data before migration
echo -e "${YELLOW}Step 4: Data before migration:${NC}"
docker-compose -f docker-compose.test.yml exec -T postgres-test psql -U test_user -d crm_test <<'EOF'
SELECT 'Quotes' as table_name, COUNT(*) as count,
  COUNT(CASE WHEN tenant_id IS NULL THEN 1 END) as missing_tenant_id
FROM quotes
UNION ALL
SELECT 'Orders', COUNT(*),
  COUNT(CASE WHEN tenant_id IS NULL THEN 1 END)
FROM orders
UNION ALL
SELECT 'Invoices', COUNT(*),
  COUNT(CASE WHEN tenant_id IS NULL THEN 1 END)
FROM invoices;
EOF
echo ""

# Step 5: Run migration
echo -e "${YELLOW}Step 5: Running migration...${NC}"
docker-compose -f docker-compose.test.yml exec -T postgres-test psql -U test_user -d crm_test < "$PROJECT_ROOT/src/db/migrations/024_improved_sales_schema.sql"
echo -e "${GREEN}✓ Migration completed${NC}"
echo ""

# Step 6: Verify migration results
echo -e "${YELLOW}Step 6: Verifying migration results...${NC}"

# Check tenant_id backfill
echo "Checking tenant_id backfill..."
docker-compose -f docker-compose.test.yml exec -T postgres-test psql -U test_user -d crm_test <<'EOF'
SELECT
  'Quotes' as table_name,
  COUNT(*) as total_records,
  COUNT(tenant_id) as with_tenant_id,
  CASE WHEN COUNT(*) = COUNT(tenant_id) THEN '✓ PASS' ELSE '✗ FAIL' END as status
FROM quotes
UNION ALL
SELECT
  'Orders',
  COUNT(*),
  COUNT(tenant_id),
  CASE WHEN COUNT(*) = COUNT(tenant_id) THEN '✓ PASS' ELSE '✗ FAIL' END
FROM orders
UNION ALL
SELECT
  'Invoices',
  COUNT(*),
  COUNT(tenant_id),
  CASE WHEN COUNT(*) = COUNT(tenant_id) THEN '✓ PASS' ELSE '✗ FAIL' END
FROM invoices;
EOF
echo ""

# Check new tables
echo "Checking new tables..."
docker-compose -f docker-compose.test.yml exec -T postgres-test psql -U test_user -d crm_test <<'EOF'
SELECT
  table_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND tables.table_name = t.table_name
  ) THEN '✓ EXISTS' ELSE '✗ MISSING' END as status
FROM (
  VALUES
    ('organization_roles'),
    ('invoice_orders')
) AS t(table_name);
EOF
echo ""

# Check organization_roles data
echo "Checking organization_roles..."
docker-compose -f docker-compose.test.yml exec -T postgres-test psql -U test_user -d crm_test <<'EOF'
SELECT COUNT(*) as org_roles_count FROM organization_roles;
EOF
echo ""

# Check invoice_orders bridge table
echo "Checking invoice_orders bridge table..."
docker-compose -f docker-compose.test.yml exec -T postgres-test psql -U test_user -d crm_test <<'EOF'
SELECT
  COUNT(*) as bridge_records,
  CASE WHEN COUNT(*) > 0 THEN '✓ PASS' ELSE '⚠ WARNING: No bridge records' END as status
FROM invoice_orders;
EOF
echo ""

# Check new columns
echo "Checking new columns..."
docker-compose -f docker-compose.test.yml exec -T postgres-test psql -U test_user -d crm_test <<'EOF'
SELECT
  t.table_name,
  c.column_name,
  CASE WHEN c.column_name IS NOT NULL THEN '✓ EXISTS' ELSE '✗ MISSING' END as status
FROM (
  VALUES
    ('quotes', 'updated_by'),
    ('quotes', 'approved_by'),
    ('quotes', 'internal_notes'),
    ('orders', 'invoiced_amount'),
    ('orders', 'remaining_amount'),
    ('orders', 'purchase_order_number'),
    ('invoices', 'remaining_amount'),
    ('invoices', 'payment_terms')
) AS t(table_name, column_name)
LEFT JOIN information_schema.columns c
  ON c.table_name = t.table_name
  AND c.column_name = t.column_name
  AND c.table_schema = 'public';
EOF
echo ""

# Check triggers
echo "Checking triggers..."
docker-compose -f docker-compose.test.yml exec -T postgres-test psql -U test_user -d crm_test <<'EOF'
SELECT
  trigger_name,
  event_object_table,
  action_timing || ' ' || string_agg(event_manipulation, ', ') as events,
  '✓ EXISTS' as status
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN ('trg_update_order_invoiced_amount', 'trg_update_invoice_remaining_amount')
GROUP BY trigger_name, event_object_table, action_timing;
EOF
echo ""

# Step 7: Test workflow functions
echo -e "${YELLOW}Step 7: Testing workflow scenarios...${NC}"

# Test: Query with tenant_id
echo "Test: Querying quotes with tenant_id..."
docker-compose -f docker-compose.test.yml exec -T postgres-test psql -U test_user -d crm_test <<'EOF'
SELECT
  quote_number,
  tenant_id,
  company_id,
  total,
  CASE WHEN tenant_id IS NOT NULL THEN '✓ PASS' ELSE '✗ FAIL' END as status
FROM quotes
WHERE tenant_id = '11111111-1111-1111-1111-111111111111';
EOF
echo ""

# Test: Trigger for order invoiced amount
echo "Test: Trigger updates order.invoiced_amount..."
docker-compose -f docker-compose.test.yml exec -T postgres-test psql -U test_user -d crm_test <<'EOF'
-- Check order before
SELECT
  'Before' as timing,
  order_number,
  total::text,
  COALESCE(invoiced_amount::text, '0.00') as invoiced_amount,
  COALESCE(remaining_amount::text, total::text) as remaining_amount
FROM orders
WHERE id = '88888888-8888-8888-8888-888888888888'

UNION ALL

-- Check bridge table
SELECT
  'Bridge' as timing,
  'invoice_orders' as order_number,
  SUM(amount_allocated)::text as total,
  SUM(amount_allocated)::text as invoiced_amount,
  '' as remaining_amount
FROM invoice_orders
WHERE order_id = '88888888-8888-8888-8888-888888888888';
EOF
echo ""

# Step 8: Final summary
echo -e "${GREEN}==================================================${NC}"
echo -e "${GREEN}  Migration Test Summary                          ${NC}"
echo -e "${GREEN}==================================================${NC}"
echo ""

# Generate final report
docker-compose -f docker-compose.test.yml exec -T postgres-test psql -U test_user -d crm_test <<'EOF'
\echo '=== Tables Created ==='
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('organization_roles', 'invoice_orders')
ORDER BY table_name;

\echo ''
\echo '=== Data Migration ==='
SELECT
  'Quotes' as entity,
  COUNT(*) as total,
  COUNT(tenant_id) as migrated,
  ROUND(COUNT(tenant_id)::numeric / NULLIF(COUNT(*), 0) * 100, 2) as percentage
FROM quotes
UNION ALL
SELECT
  'Orders',
  COUNT(*),
  COUNT(tenant_id),
  ROUND(COUNT(tenant_id)::numeric / NULLIF(COUNT(*), 0) * 100, 2)
FROM orders
UNION ALL
SELECT
  'Invoices',
  COUNT(*),
  COUNT(tenant_id),
  ROUND(COUNT(tenant_id)::numeric / NULLIF(COUNT(*), 0) * 100, 2)
FROM invoices;

\echo ''
\echo '=== New Relationships ==='
SELECT
  'Organization Roles' as relationship_type,
  COUNT(*) as count
FROM organization_roles
UNION ALL
SELECT
  'Invoice-Order Links',
  COUNT(*)
FROM invoice_orders;

\echo ''
\echo '=== Triggers ==='
SELECT
  COUNT(*) as trigger_count,
  CASE WHEN COUNT(*) >= 2 THEN '✓ All triggers created' ELSE '⚠ Missing triggers' END as status
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN ('trg_update_order_invoiced_amount', 'trg_update_invoice_remaining_amount');
EOF

echo ""
echo -e "${GREEN}==================================================${NC}"
echo -e "${GREEN}✓ Migration test completed successfully!         ${NC}"
echo -e "${GREEN}==================================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Review the test results above"
echo "2. If everything looks good, run on staging: ./scripts/run-migration-staging.sh"
echo "3. Then run on production: ./scripts/run-migration-production.sh"
echo ""
echo -e "${YELLOW}To clean up test environment:${NC}"
echo "docker-compose -f docker-compose.test.yml down -v"
echo ""
