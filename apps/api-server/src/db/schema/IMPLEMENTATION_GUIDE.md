# Implementation Guide - Improved CRM + ERP Schema

## Overview

This guide provides step-by-step instructions for implementing the improved data model for business documents (Quotes, Orders, Invoices) with comprehensive multi-tenancy, flexible organization roles, and cross-document workflows.

## What's New

### 1. Multi-Tenancy Everywhere
- All sales documents now include `tenantId` for proper data isolation
- Tenant-scoped queries prevent data leakage
- Consistent pattern across all entities

### 2. Flexible Organization Roles
- Organizations (companies) can have multiple roles simultaneously:
  - Customer
  - Vendor
  - Supplier
  - Partner
  - Internal
- Supports B2B scenarios where one company is both customer and supplier
- Per-role financial settings (credit limits, payment terms, etc.)

### 3. Cross-Document Workflows
```
Quote → Order → Invoice (standard flow)
Quote → Invoice (direct flow, bypassing order)
Order₁ + Order₂ + Order₃ → Invoice (consolidated invoicing)
Order → Invoice₁ + Invoice₂ (partial invoicing)
```

### 4. Improved Audit Trail
- `createdBy`, `updatedBy`, `approvedBy`, `cancelledBy` on all documents
- Timestamp tracking: `viewedAt`, `sentAt`, `paidAt`, etc.
- Full lifecycle visibility

## Files Created

### 1. Schema Documentation
- **`improved-schema.md`** - Complete schema overview with examples

### 2. Drizzle Schema
- **`improved-sales.ts`** - Drizzle ORM schema definitions
  - Organization roles table
  - Enhanced Quotes, Orders, Invoices tables
  - Invoice-Order bridge table
  - TypeScript types

### 3. Migration
- **`024_improved_sales_schema.sql`** - Production-ready migration script
  - Creates new tables and enums
  - Adds columns to existing tables
  - Backfills data safely
  - Creates triggers for automatic updates

### 4. Services
- **`document-workflow.service.ts`** - Business logic for workflows
  - Quote to Order conversion
  - Quote to Invoice conversion
  - Order to Invoice conversion
  - Consolidated multi-order invoicing
  - Partial order invoicing
  - Document chain retrieval

### 5. API Examples
- **`document-workflows.example.ts`** - REST API endpoints
  - Complete CRUD for document conversions
  - Input validation with Zod
  - Error handling
  - Usage examples

## Implementation Steps

### Step 1: Review Current Schema

Before starting, review your current schema:

```bash
cd /Users/darioristic/Projects/web-project-development/Unpacked/crm-monorepo/apps/api-server

# Check current schema
psql -d your_database -f src/db/schema.ts
```

### Step 2: Backup Database

**CRITICAL: Always backup before running migrations!**

```bash
# Backup production database
pg_dump -h localhost -U username -d crm_database > backup_$(date +%Y%m%d_%H%M%S).sql

# Or use your cloud provider's backup tool
```

### Step 3: Test Migration on Staging

```bash
# Create test database
createdb crm_staging

# Restore production data to staging
psql -d crm_staging < backup_XXXXXXXX_XXXXXX.sql

# Run migration on staging
psql -d crm_staging -f src/db/migrations/024_improved_sales_schema.sql

# Verify migration
psql -d crm_staging -c "
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_name IN ('quotes', 'orders', 'invoices')
  AND column_name = 'tenant_id';
"
```

### Step 4: Run Migration on Production

```bash
# Set maintenance mode (optional but recommended)
# ... your maintenance mode script ...

# Run migration
psql -d crm_database -f src/db/migrations/024_improved_sales_schema.sql

# Verify
psql -d crm_database -c "
  SELECT COUNT(*) FROM organization_roles;
  SELECT COUNT(*) FROM invoice_orders;
"

# Exit maintenance mode
```

### Step 5: Update Application Code

#### A. Import New Schema

```typescript
// In your db/schema/index.ts
export * from "./improved-sales";

// In your routes/queries
import {
  quotesImproved,
  ordersImproved,
  invoicesImproved,
  invoiceOrders,
  organizationRoles,
} from "../db/schema/improved-sales";
```

#### B. Update Existing Queries

**Before:**
```typescript
// Old query without tenantId
const quotes = await db
  .select()
  .from(quotes)
  .where(eq(quotes.companyId, companyId));
```

**After:**
```typescript
// New query with tenantId
const quotes = await db
  .select()
  .from(quotesImproved)
  .where(
    and(
      eq(quotesImproved.companyId, companyId),
      eq(quotesImproved.tenantId, tenantId)
    )
  );
```

#### C. Use Workflow Services

```typescript
import {
  convertQuoteToOrder,
  convertOrderToInvoice,
  createConsolidatedInvoice,
} from "../services/document-workflow.service";

// Convert quote to order
const order = await convertQuoteToOrder({
  quoteId: "...",
  userId: user.id,
  tenantId: tenant.id,
});

// Create invoice from order
const invoiceId = await convertOrderToInvoice({
  orderId: order.id,
  userId: user.id,
  tenantId: tenant.id,
});
```

### Step 6: Add Organization Roles

```typescript
// When creating a new customer company
import { organizationRoles } from "../db/schema/improved-sales";

await db.insert(organizationRoles).values({
  companyId: company.id,
  tenantId: tenant.id,
  role: "customer",
  isActive: true,
  defaultPaymentTerms: 30,
  defaultCurrency: "EUR",
  createdBy: user.id,
});

// A company can have multiple roles
await db.insert(organizationRoles).values([
  {
    companyId: company.id,
    tenantId: tenant.id,
    role: "customer",
    // ...
  },
  {
    companyId: company.id,
    tenantId: tenant.id,
    role: "vendor",
    // ...
  },
]);
```

### Step 7: Update Frontend

#### A. Add Workflow UI

```tsx
// QuoteDetailPage.tsx
import { useWorkflows } from "@/hooks/use-workflows";

function QuoteActions({ quote }) {
  const { convertToOrder, convertToInvoice } = useWorkflows();

  return (
    <>
      <Button
        onClick={() => convertToOrder(quote.id)}
        disabled={quote.status === "converted"}
      >
        Convert to Order
      </Button>

      <Button
        onClick={() => convertToInvoice(quote.id)}
        disabled={quote.status === "converted"}
      >
        Convert to Invoice
      </Button>
    </>
  );
}
```

#### B. Show Document Chain

```tsx
// DocumentChainView.tsx
function DocumentChainView({ quoteId }) {
  const { data: chain } = useQuery({
    queryKey: ["document-chain", quoteId],
    queryFn: () => getDocumentChain(quoteId),
  });

  return (
    <Timeline>
      <TimelineItem>
        <Quote data={chain.quote} />
      </TimelineItem>

      {chain.orders.map((order) => (
        <TimelineItem key={order.id}>
          <Order data={order} />
        </TimelineItem>
      ))}

      {chain.invoices.map((invoice) => (
        <TimelineItem key={invoice.id}>
          <Invoice data={invoice} />
        </TimelineItem>
      ))}
    </Timeline>
  );
}
```

### Step 8: Test Workflows

#### Test Case 1: Simple Quote → Order → Invoice

```typescript
// Test: Convert quote to order to invoice
describe("Document Workflows", () => {
  it("should convert quote to order to invoice", async () => {
    // 1. Create quote
    const quote = await createQuote({
      tenantId: testTenant.id,
      companyId: testCustomer.id,
      items: [
        {
          productName: "Product A",
          quantity: "10",
          unitPrice: "100",
          total: "1000",
        },
      ],
      total: "1000",
    });

    // 2. Convert to order
    const order = await convertQuoteToOrder({
      quoteId: quote.id,
      userId: testUser.id,
      tenantId: testTenant.id,
    });

    expect(order.quoteId).toBe(quote.id);
    expect(order.total).toBe(quote.total);

    // 3. Convert to invoice
    const invoiceId = await convertOrderToInvoice({
      orderId: order.id,
      userId: testUser.id,
      tenantId: testTenant.id,
    });

    expect(invoiceId).toBeDefined();

    // Verify invoice-order link
    const links = await db
      .select()
      .from(invoiceOrders)
      .where(eq(invoiceOrders.invoiceId, invoiceId));

    expect(links).toHaveLength(1);
    expect(links[0].orderId).toBe(order.id);
  });
});
```

#### Test Case 2: Partial Invoicing

```typescript
it("should support partial order invoicing", async () => {
  // Create order with total 1000
  const order = await createOrder({
    tenantId: testTenant.id,
    total: "1000",
  });

  // Invoice 40%
  const invoice1Id = await convertOrderToInvoice({
    orderId: order.id,
    userId: testUser.id,
    tenantId: testTenant.id,
    customizations: {
      partial: { percentage: 40 },
    },
  });

  // Check order status
  let updatedOrder = await db
    .select()
    .from(ordersImproved)
    .where(eq(ordersImproved.id, order.id));

  expect(updatedOrder[0].status).toBe("partially_invoiced");
  expect(updatedOrder[0].invoicedAmount).toBe("400.00");
  expect(updatedOrder[0].remainingAmount).toBe("600.00");

  // Invoice remaining 60%
  const invoice2Id = await convertOrderToInvoice({
    orderId: order.id,
    userId: testUser.id,
    tenantId: testTenant.id,
    customizations: {
      partial: { percentage: 60 },
    },
  });

  // Check order status
  updatedOrder = await db
    .select()
    .from(ordersImproved)
    .where(eq(ordersImproved.id, order.id));

  expect(updatedOrder[0].status).toBe("invoiced");
  expect(updatedOrder[0].invoicedAmount).toBe("1000.00");
  expect(updatedOrder[0].remainingAmount).toBe("0.00");
});
```

#### Test Case 3: Consolidated Invoice

```typescript
it("should create consolidated invoice from multiple orders", async () => {
  // Create 3 orders
  const order1 = await createOrder({ total: "1000" });
  const order2 = await createOrder({ total: "2000" });
  const order3 = await createOrder({ total: "1500" });

  // Create consolidated invoice
  const invoiceId = await createConsolidatedInvoice({
    tenantId: testTenant.id,
    userId: testUser.id,
    orders: [
      { orderId: order1.id },
      { orderId: order2.id },
      { orderId: order3.id },
    ],
  });

  // Verify invoice total
  const [invoice] = await db
    .select()
    .from(invoicesImproved)
    .where(eq(invoicesImproved.id, invoiceId));

  expect(invoice.total).toBe("4500.00");

  // Verify all orders are linked
  const links = await db
    .select()
    .from(invoiceOrders)
    .where(eq(invoiceOrders.invoiceId, invoiceId));

  expect(links).toHaveLength(3);
});
```

## Rollback Plan

If something goes wrong, rollback using:

```sql
BEGIN;

-- 1. Remove new columns
ALTER TABLE quotes DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE orders DROP COLUMN IF EXISTS tenant_id CASCADE;
ALTER TABLE invoices DROP COLUMN IF EXISTS tenant_id CASCADE;

-- 2. Drop new tables
DROP TABLE IF EXISTS invoice_orders CASCADE;
DROP TABLE IF EXISTS organization_roles CASCADE;

-- 3. Drop new enums
DROP TYPE IF EXISTS quote_status_new CASCADE;
DROP TYPE IF EXISTS order_status_new CASCADE;
DROP TYPE IF EXISTS invoice_status_new CASCADE;
DROP TYPE IF EXISTS organization_role CASCADE;

-- 4. Restore from backup if needed
-- \i backup_XXXXXXXX_XXXXXX.sql

COMMIT;
```

## Performance Considerations

### 1. Indexes

The migration creates comprehensive indexes for multi-tenant queries:

```sql
-- Essential for tenant isolation
idx_quotes_tenant_company (tenant_id, company_id)
idx_orders_tenant_company (tenant_id, company_id)
idx_invoices_tenant_company (tenant_id, company_id)

-- Essential for status filtering
idx_quotes_tenant_status (tenant_id, status)
idx_orders_tenant_status (tenant_id, status)
idx_invoices_tenant_status (tenant_id, status)

-- Essential for bridge table queries
idx_invoice_orders_invoice_id (invoice_id)
idx_invoice_orders_order_id (order_id)
```

### 2. Query Optimization

Always include `tenantId` in WHERE clauses:

```typescript
// Good - uses composite index
const quotes = await db
  .select()
  .from(quotesImproved)
  .where(
    and(
      eq(quotesImproved.tenantId, tenantId),
      eq(quotesImproved.status, "draft")
    )
  );

// Bad - index not fully utilized
const quotes = await db
  .select()
  .from(quotesImproved)
  .where(eq(quotesImproved.status, "draft"));
```

### 3. Database Triggers

The migration includes triggers for automatic calculations:

- `update_order_invoiced_amount()` - Updates order amounts when invoices change
- `update_invoice_remaining_amount()` - Updates invoice remaining amount when paid

These run automatically, no manual updates needed!

## Monitoring

### Key Metrics to Track

1. **Conversion Rates**
```sql
-- Quote to Order conversion rate
SELECT
  COUNT(CASE WHEN status = 'converted' THEN 1 END)::float /
  NULLIF(COUNT(*), 0) * 100 as conversion_rate
FROM quotes
WHERE tenant_id = 'your-tenant-id';
```

2. **Order Invoicing Status**
```sql
-- Orders by invoicing status
SELECT
  status,
  COUNT(*) as count,
  SUM(CAST(total AS NUMERIC)) as total_value
FROM orders
WHERE tenant_id = 'your-tenant-id'
GROUP BY status;
```

3. **Multi-Order Invoices**
```sql
-- Invoices with multiple orders
SELECT
  i.invoice_number,
  COUNT(io.order_id) as order_count,
  SUM(CAST(io.amount_allocated AS NUMERIC)) as total_allocated
FROM invoices i
JOIN invoice_orders io ON io.invoice_id = i.id
WHERE i.tenant_id = 'your-tenant-id'
GROUP BY i.id, i.invoice_number
HAVING COUNT(io.order_id) > 1;
```

## Security Considerations

### 1. Tenant Isolation

Always verify `tenantId` in authorization middleware:

```typescript
// auth.middleware.ts
export async function requireTenantAccess(c: Context, next: Next) {
  const user = c.get("user");
  const resourceTenantId = c.req.param("tenantId");

  if (user.tenantId !== resourceTenantId) {
    return c.json({ error: "Forbidden" }, 403);
  }

  await next();
}
```

### 2. Document Access Control

Check both `tenantId` and `companyId`:

```typescript
async function canAccessInvoice(
  invoiceId: string,
  userId: string,
  tenantId: string
): Promise<boolean> {
  const [invoice] = await db
    .select()
    .from(invoicesImproved)
    .where(
      and(
        eq(invoicesImproved.id, invoiceId),
        eq(invoicesImproved.tenantId, tenantId)
      )
    );

  if (!invoice) return false;

  // Additional checks based on user role
  const userCompanies = await getUserCompanies(userId);
  return userCompanies.includes(invoice.companyId);
}
```

## Troubleshooting

### Problem: tenantId is NULL after migration

**Solution:**
```sql
-- Check if companies have tenantId
SELECT COUNT(*) FROM companies WHERE tenant_id IS NULL;

-- If found, assign them to a tenant
UPDATE companies
SET tenant_id = (SELECT id FROM tenants LIMIT 1)
WHERE tenant_id IS NULL;

-- Re-run backfill
UPDATE quotes q
SET tenant_id = c.tenant_id
FROM companies c
WHERE q.company_id = c.id
AND q.tenant_id IS NULL;
```

### Problem: Trigger not firing

**Solution:**
```sql
-- Check trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'trg_update_order_invoiced_amount';

-- Recreate trigger if missing
DROP TRIGGER IF EXISTS trg_update_order_invoiced_amount ON invoice_orders;
CREATE TRIGGER trg_update_order_invoiced_amount
  AFTER INSERT OR UPDATE OR DELETE ON invoice_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_order_invoiced_amount();
```

### Problem: Duplicate organization roles

**Solution:**
```sql
-- Find duplicates
SELECT company_id, tenant_id, role, COUNT(*)
FROM organization_roles
GROUP BY company_id, tenant_id, role
HAVING COUNT(*) > 1;

-- Remove duplicates (keep the oldest)
DELETE FROM organization_roles
WHERE id NOT IN (
  SELECT MIN(id)
  FROM organization_roles
  GROUP BY company_id, tenant_id, role
);
```

## Next Steps

1. **Phase 1: Deploy Schema** (Week 1)
   - Run migration on staging
   - Test all workflows
   - Deploy to production

2. **Phase 2: Update Application** (Week 2)
   - Update all queries to use new schema
   - Add workflow UI components
   - Update documentation

3. **Phase 3: Migrate Data** (Week 3)
   - Backfill organization roles
   - Convert existing invoice-order relationships
   - Verify data integrity

4. **Phase 4: Remove Old Schema** (Week 4)
   - Deprecated old tables (if created new ones)
   - Update indexes
   - Optimize performance

## Support

For questions or issues:
1. Check this guide first
2. Review the code examples
3. Test on staging environment
4. Check database logs for errors

## Summary

This implementation provides a production-ready, scalable solution for managing business documents with:

- ✅ Complete multi-tenancy support
- ✅ Flexible organization roles
- ✅ Cross-document workflows
- ✅ Comprehensive audit trails
- ✅ Automatic calculations via triggers
- ✅ Partial and consolidated invoicing
- ✅ Full TypeScript type safety

The schema is designed for long-term growth and can handle complex B2B scenarios while maintaining data integrity and security.
