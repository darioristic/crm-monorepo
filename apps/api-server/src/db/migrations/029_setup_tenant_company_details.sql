-- Migration: Setup tenant company details and populate from_details
-- This migration is IDEMPOTENT - safe to run multiple times

-- ============================================================================
-- STEP 1: Update tenant metadata with company information
-- ============================================================================

-- Softergee d.o.o. company details
UPDATE tenants
SET metadata = jsonb_build_object(
  'companyName', 'Softergee d.o.o.',
  'address', 'Bulevar Kralja Aleksandra 73',
  'city', 'Beograd',
  'postalCode', '11000',
  'country', 'Srbija',
  'vatNumber', 'RS123456789',
  'registrationNumber', '12345678',
  'bankName', 'Raiffeisen Banka',
  'bankAccount', '265-1234567890123-45',
  'email', 'office@softergee.com',
  'phone', '+381 11 123 4567',
  'website', 'https://softergee.com',
  'logoUrl', null
)
WHERE slug = 'softergee'
  AND (metadata IS NULL OR metadata = '{}' OR metadata->>'companyName' IS NULL);

-- Cloud Native d.o.o. company details
UPDATE tenants
SET metadata = jsonb_build_object(
  'companyName', 'Cloud Native d.o.o.',
  'address', 'Kneza Miloša 10',
  'city', 'Beograd',
  'postalCode', '11000',
  'country', 'Srbija',
  'vatNumber', 'RS987654321',
  'registrationNumber', '87654321',
  'bankName', 'Unicredit Banka',
  'bankAccount', '170-9876543210987-65',
  'email', 'info@cloudnative.rs',
  'phone', '+381 11 987 6543',
  'website', 'https://cloudnative.rs',
  'logoUrl', null
)
WHERE slug = 'cloudnative'
  AND (metadata IS NULL OR metadata = '{}' OR metadata->>'companyName' IS NULL);

-- ============================================================================
-- STEP 2: Populate from_details for invoices (only if empty)
-- ============================================================================

UPDATE invoices i
SET from_details = jsonb_build_object(
  'name', t.metadata->>'companyName',
  'address', CONCAT(
    t.metadata->>'address', E'\n',
    t.metadata->>'postalCode', ' ', t.metadata->>'city', E'\n',
    t.metadata->>'country'
  ),
  'vatNumber', t.metadata->>'vatNumber',
  'registrationNumber', t.metadata->>'registrationNumber',
  'bankName', t.metadata->>'bankName',
  'bankAccount', t.metadata->>'bankAccount',
  'email', t.metadata->>'email',
  'phone', t.metadata->>'phone',
  'website', t.metadata->>'website'
)::text
FROM tenants t
WHERE i.tenant_id = t.id
  AND t.metadata IS NOT NULL
  AND t.metadata != '{}'
  AND (i.from_details IS NULL OR i.from_details = '' OR i.from_details = '{}');

-- ============================================================================
-- STEP 3: Populate from_details for quotes (only if empty)
-- ============================================================================

UPDATE quotes q
SET from_details = jsonb_build_object(
  'name', t.metadata->>'companyName',
  'address', CONCAT(
    t.metadata->>'address', E'\n',
    t.metadata->>'postalCode', ' ', t.metadata->>'city', E'\n',
    t.metadata->>'country'
  ),
  'vatNumber', t.metadata->>'vatNumber',
  'registrationNumber', t.metadata->>'registrationNumber',
  'bankName', t.metadata->>'bankName',
  'bankAccount', t.metadata->>'bankAccount',
  'email', t.metadata->>'email',
  'phone', t.metadata->>'phone',
  'website', t.metadata->>'website'
)::text
FROM tenants t
WHERE q.tenant_id = t.id
  AND t.metadata IS NOT NULL
  AND t.metadata != '{}'
  AND (q.from_details IS NULL OR q.from_details = '' OR q.from_details = '{}');

-- ============================================================================
-- STEP 4: Populate from_details for orders (only if empty)
-- ============================================================================

UPDATE orders o
SET from_details = jsonb_build_object(
  'name', t.metadata->>'companyName',
  'address', CONCAT(
    t.metadata->>'address', E'\n',
    t.metadata->>'postalCode', ' ', t.metadata->>'city', E'\n',
    t.metadata->>'country'
  ),
  'vatNumber', t.metadata->>'vatNumber',
  'registrationNumber', t.metadata->>'registrationNumber',
  'bankName', t.metadata->>'bankName',
  'bankAccount', t.metadata->>'bankAccount',
  'email', t.metadata->>'email',
  'phone', t.metadata->>'phone',
  'website', t.metadata->>'website'
)::text
FROM tenants t
WHERE o.tenant_id = t.id
  AND t.metadata IS NOT NULL
  AND t.metadata != '{}'
  AND (o.from_details IS NULL OR o.from_details = '' OR o.from_details = '{}');

-- ============================================================================
-- STEP 5: Populate from_details for delivery_notes (only if empty)
-- ============================================================================

UPDATE delivery_notes dn
SET from_details = jsonb_build_object(
  'name', t.metadata->>'companyName',
  'address', CONCAT(
    t.metadata->>'address', E'\n',
    t.metadata->>'postalCode', ' ', t.metadata->>'city', E'\n',
    t.metadata->>'country'
  ),
  'vatNumber', t.metadata->>'vatNumber',
  'registrationNumber', t.metadata->>'registrationNumber',
  'email', t.metadata->>'email',
  'phone', t.metadata->>'phone'
)::text
FROM tenants t
WHERE dn.tenant_id = t.id
  AND t.metadata IS NOT NULL
  AND t.metadata != '{}'
  AND (dn.from_details IS NULL OR dn.from_details = '' OR dn.from_details = '{}');

-- ============================================================================
-- STEP 6: Move users from Default/Test tenants to active tenants
-- ============================================================================

-- Move users from Default Tenant to Softergee (if they have no other tenant)
INSERT INTO user_tenant_roles (user_id, tenant_id, role, created_at, updated_at)
SELECT utr.user_id,
       (SELECT id FROM tenants WHERE slug = 'softergee' LIMIT 1),
       utr.role,
       NOW(),
       NOW()
FROM user_tenant_roles utr
JOIN tenants t ON utr.tenant_id = t.id
WHERE t.slug IN ('default', 'test-tenant')
  AND NOT EXISTS (
    SELECT 1 FROM user_tenant_roles utr2
    JOIN tenants t2 ON utr2.tenant_id = t2.id
    WHERE utr2.user_id = utr.user_id
      AND t2.slug NOT IN ('default', 'test-tenant')
  )
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- Update active tenant for users who were on Default/Test
UPDATE user_active_tenant uat
SET active_tenant_id = (SELECT id FROM tenants WHERE slug = 'softergee' LIMIT 1),
    updated_at = NOW()
WHERE uat.active_tenant_id IN (SELECT id FROM tenants WHERE slug IN ('default', 'test-tenant'));

-- ============================================================================
-- STEP 7: Delete Default Tenant and Test Tenant (cleanup)
-- ============================================================================

-- First remove user_tenant_roles for these tenants
DELETE FROM user_tenant_roles
WHERE tenant_id IN (SELECT id FROM tenants WHERE slug IN ('default', 'test-tenant'));

-- Then soft-delete the tenants (or hard delete if no references)
UPDATE tenants
SET status = 'deleted',
    deleted_at = NOW()
WHERE slug IN ('default', 'test-tenant')
  AND NOT EXISTS (SELECT 1 FROM invoices WHERE tenant_id = tenants.id)
  AND NOT EXISTS (SELECT 1 FROM quotes WHERE tenant_id = tenants.id)
  AND NOT EXISTS (SELECT 1 FROM orders WHERE tenant_id = tenants.id);

-- ============================================================================
-- VERIFICATION QUERIES (run manually to verify)
-- ============================================================================

-- Check tenant metadata:
-- SELECT name, slug, metadata->>'companyName' as company FROM tenants WHERE status = 'active';

-- Check from_details populated:
-- SELECT tenant_id, COUNT(*), COUNT(NULLIF(from_details, '')) as with_from
-- FROM invoices GROUP BY tenant_id;

-- Check deleted tenants:
-- SELECT name, status FROM tenants WHERE slug IN ('default', 'test-tenant');
