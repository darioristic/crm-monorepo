# Improved CRM + ERP Data Model

## Overview

This document outlines the improved data model for business documents (Quotes, Orders, Invoices) with proper multi-tenancy, flexible organization roles, and cross-document workflows.

## Key Improvements

### 1. Multi-Tenancy
- All sales documents now include `tenantId` for proper data isolation
- Consistent tenant-scoping across all entities

### 2. Organizations (Companies)
- Organizations can have multiple roles: customer, vendor, supplier, partner
- Tracked via `organization_roles` table
- Supports B2B scenarios where one company can be both customer and supplier

### 3. Document Relationships
```
Quote (1) → (N) Orders → (N) Invoices
Quote (1) → (N) Invoices (direct flow)
Orders (N) → (M) Invoices (via invoice_orders bridge)
```

### 4. Audit Trail
- All documents track: `createdBy`, `updatedBy`, `createdAt`, `updatedAt`
- Lifecycle tracking: `approvedBy`, `approvedAt`, `cancelledBy`, `cancelledAt`

### 5. Flexible Invoicing
- Single order → single invoice
- Multiple orders → consolidated invoice (via bridge table)
- Partial order invoicing
- Amount allocation tracking

## Schema Definitions

### Document Status Enums

```typescript
// Quote statuses
export const quoteStatus = pgEnum("quote_status", [
  "draft",
  "sent",
  "viewed",
  "accepted",
  "rejected",
  "expired",
  "converted", // converted to order/invoice
]);

// Order statuses
export const orderStatus = pgEnum("order_status", [
  "draft",
  "pending",
  "confirmed",
  "processing",
  "partially_fulfilled",
  "fulfilled",
  "partially_invoiced",
  "invoiced",
  "cancelled",
  "on_hold",
]);

// Invoice statuses
export const invoiceStatus = pgEnum("invoice_status", [
  "draft",
  "sent",
  "viewed",
  "overdue",
  "partially_paid",
  "paid",
  "cancelled",
  "refunded",
]);

// Organization roles
export const organizationRole = pgEnum("organization_role", [
  "customer",
  "vendor",
  "supplier",
  "partner",
  "internal",
]);
```

### Organizations & Roles

```typescript
// Organization roles - allows one company to have multiple roles
export const organizationRoles = pgTable(
  "organization_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    role: organizationRole("role").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    // Financial settings per role
    defaultPaymentTerms: integer("default_payment_terms"), // days
    defaultCurrency: varchar("default_currency", { length: 3 }).default("EUR"),
    creditLimit: numeric("credit_limit", { precision: 15, scale: 2 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    // Audit
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_org_roles_company_tenant").on(table.companyId, table.tenantId),
    index("idx_org_roles_tenant_role").on(table.tenantId, table.role),
    // Unique constraint: one company can only have each role once per tenant
    index("idx_org_roles_unique").on(table.companyId, table.tenantId, table.role).unique(),
  ]
);
```

### Improved Quotes

```typescript
export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteNumber: varchar("quote_number", { length: 50 }).notNull().unique(),

    // Multi-tenancy
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // Organization relationship
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .references(() => contacts.id, { onDelete: "set null" }),

    // Status
    status: quoteStatus("status").notNull().default("draft"),

    // Dates
    issueDate: timestamp("issue_date", { withTimezone: true }).notNull().defaultNow(),
    validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    // Financial
    subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull().default("0"),
    taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    tax: numeric("tax", { precision: 15, scale: 2 }).notNull().default("0"),
    discount: numeric("discount", { precision: 15, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 15, scale: 2 }).notNull().default("0"),
    currency: varchar("currency", { length: 3 }).notNull().default("EUR"),

    // Content
    notes: text("notes"),
    terms: text("terms"),
    internalNotes: text("internal_notes"), // Not visible to customer

    // Template data (JSON)
    fromDetails: jsonb("from_details"),
    customerDetails: jsonb("customer_details"),
    templateSettings: jsonb("template_settings"),

    // Tracking
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    convertedToOrderAt: timestamp("converted_to_order_at", { withTimezone: true }),
    convertedToInvoiceAt: timestamp("converted_to_invoice_at", { withTimezone: true }),

    // Audit
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    updatedBy: uuid("updated_by")
      .references(() => users.id),
    approvedBy: uuid("approved_by")
      .references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_quotes_tenant_company").on(table.tenantId, table.companyId),
    index("idx_quotes_tenant_status").on(table.tenantId, table.status),
    index("idx_quotes_created_at").on(table.createdAt.desc()),
    index("idx_quotes_expires_at").on(table.expiresAt),
    index("idx_quotes_quote_number").on(table.quoteNumber),
  ]
);

export const quoteItems = pgTable(
  "quote_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),

    // Product info
    productId: uuid("product_id")
      .references(() => products.id, { onDelete: "set null" }),
    productName: varchar("product_name", { length: 255 }).notNull(),
    description: text("description"),
    sku: varchar("sku", { length: 100 }),

    // Quantities
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
    unit: varchar("unit", { length: 50 }).notNull().default("pcs"),

    // Pricing
    unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
    discount: numeric("discount", { precision: 5, scale: 2 }).notNull().default("0"),
    taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 15, scale: 2 }).notNull(),

    // Ordering
    sortOrder: integer("sort_order").notNull().default(0),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_quote_items_quote_id").on(table.quoteId),
    index("idx_quote_items_product_id").on(table.productId),
    index("idx_quote_items_sort_order").on(table.quoteId, table.sortOrder),
  ]
);
```

### Improved Orders

```typescript
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderNumber: varchar("order_number", { length: 50 }).notNull().unique(),

    // Multi-tenancy
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // Organization relationship
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .references(() => contacts.id, { onDelete: "set null" }),

    // Source quote (optional)
    quoteId: uuid("quote_id")
      .references(() => quotes.id, { onDelete: "set null" }),

    // Status
    status: orderStatus("status").notNull().default("draft"),

    // Dates
    orderDate: timestamp("order_date", { withTimezone: true }).notNull().defaultNow(),
    expectedDeliveryDate: timestamp("expected_delivery_date", { withTimezone: true }),
    actualDeliveryDate: timestamp("actual_delivery_date", { withTimezone: true }),

    // Financial
    subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull().default("0"),
    taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    tax: numeric("tax", { precision: 15, scale: 2 }).notNull().default("0"),
    discount: numeric("discount", { precision: 15, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 15, scale: 2 }).notNull().default("0"),
    currency: varchar("currency", { length: 3 }).notNull().default("EUR"),

    // Invoicing tracking
    invoicedAmount: numeric("invoiced_amount", { precision: 15, scale: 2 }).notNull().default("0"),
    remainingAmount: numeric("remaining_amount", { precision: 15, scale: 2 }).notNull().default("0"),

    // Content
    notes: text("notes"),
    terms: text("terms"),
    internalNotes: text("internal_notes"),
    purchaseOrderNumber: varchar("purchase_order_number", { length: 100 }),

    // Template data (JSON)
    fromDetails: jsonb("from_details"),
    customerDetails: jsonb("customer_details"),
    shippingDetails: jsonb("shipping_details"),

    // Audit
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    updatedBy: uuid("updated_by")
      .references(() => users.id),
    confirmedBy: uuid("confirmed_by")
      .references(() => users.id),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    cancelledBy: uuid("cancelled_by")
      .references(() => users.id),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_orders_tenant_company").on(table.tenantId, table.companyId),
    index("idx_orders_tenant_status").on(table.tenantId, table.status),
    index("idx_orders_quote_id").on(table.quoteId),
    index("idx_orders_created_at").on(table.createdAt.desc()),
    index("idx_orders_order_number").on(table.orderNumber),
    index("idx_orders_purchase_order").on(table.purchaseOrderNumber),
  ]
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),

    // Link to quote item if this order came from a quote
    quoteItemId: uuid("quote_item_id")
      .references(() => quoteItems.id, { onDelete: "set null" }),

    // Product info
    productId: uuid("product_id")
      .references(() => products.id, { onDelete: "set null" }),
    productName: varchar("product_name", { length: 255 }).notNull(),
    description: text("description"),
    sku: varchar("sku", { length: 100 }),

    // Quantities
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
    fulfilledQuantity: numeric("fulfilled_quantity", { precision: 10, scale: 2 }).notNull().default("0"),
    invoicedQuantity: numeric("invoiced_quantity", { precision: 10, scale: 2 }).notNull().default("0"),
    unit: varchar("unit", { length: 50 }).notNull().default("pcs"),

    // Pricing
    unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
    discount: numeric("discount", { precision: 5, scale: 2 }).notNull().default("0"),
    taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 15, scale: 2 }).notNull(),

    // Invoicing tracking
    invoicedAmount: numeric("invoiced_amount", { precision: 15, scale: 2 }).notNull().default("0"),

    // Ordering
    sortOrder: integer("sort_order").notNull().default(0),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_order_items_order_id").on(table.orderId),
    index("idx_order_items_quote_item_id").on(table.quoteItemId),
    index("idx_order_items_product_id").on(table.productId),
    index("idx_order_items_sort_order").on(table.orderId, table.sortOrder),
  ]
);
```

### Improved Invoices with Multi-Order Support

```typescript
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceNumber: varchar("invoice_number", { length: 50 }).notNull().unique(),

    // Multi-tenancy
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    // Organization relationship
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .references(() => contacts.id, { onDelete: "set null" }),

    // Source documents (optional)
    // Direct quote-to-invoice flow
    quoteId: uuid("quote_id")
      .references(() => quotes.id, { onDelete: "set null" }),
    // Note: Multiple orders linked via invoice_orders bridge table

    // Status
    status: invoiceStatus("status").notNull().default("draft"),

    // Dates
    issueDate: timestamp("issue_date", { withTimezone: true }).notNull().defaultNow(),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    paymentDate: timestamp("payment_date", { withTimezone: true }),

    // Financial
    grossTotal: numeric("gross_total", { precision: 15, scale: 2 }).notNull().default("0"),
    subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull().default("0"),
    discount: numeric("discount", { precision: 15, scale: 2 }).notNull().default("0"),
    taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).notNull().default("20"),
    tax: numeric("tax", { precision: 15, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 15, scale: 2 }).notNull().default("0"),
    paidAmount: numeric("paid_amount", { precision: 15, scale: 2 }).notNull().default("0"),
    remainingAmount: numeric("remaining_amount", { precision: 15, scale: 2 }).notNull().default("0"),
    currency: varchar("currency", { length: 10 }).notNull().default("EUR"),

    // Payment terms
    paymentTerms: integer("payment_terms"), // days
    paymentMethod: varchar("payment_method", { length: 50 }),

    // Content
    notes: text("notes"),
    terms: text("terms"),
    internalNotes: text("internal_notes"),

    // Template data (JSON)
    fromDetails: jsonb("from_details"),
    customerDetails: jsonb("customer_details"),
    logoUrl: text("logo_url"),
    templateSettings: jsonb("template_settings"),

    // Public access
    token: varchar("token", { length: 100 }).unique(),

    // Tracking
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),

    // Audit
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    updatedBy: uuid("updated_by")
      .references(() => users.id),
    approvedBy: uuid("approved_by")
      .references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    cancelledBy: uuid("cancelled_by")
      .references(() => users.id),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_invoices_tenant_company").on(table.tenantId, table.companyId),
    index("idx_invoices_tenant_status").on(table.tenantId, table.status),
    index("idx_invoices_quote_id").on(table.quoteId),
    index("idx_invoices_created_at").on(table.createdAt.desc()),
    index("idx_invoices_due_date").on(table.dueDate),
    index("idx_invoices_token").on(table.token),
    index("idx_invoices_invoice_number").on(table.invoiceNumber),
  ]
);

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),

    // Link to order item if this invoice came from orders
    orderItemId: uuid("order_item_id")
      .references(() => orderItems.id, { onDelete: "set null" }),

    // Link to quote item if direct quote-to-invoice
    quoteItemId: uuid("quote_item_id")
      .references(() => quoteItems.id, { onDelete: "set null" }),

    // Product info
    productId: uuid("product_id")
      .references(() => products.id, { onDelete: "set null" }),
    productName: varchar("product_name", { length: 255 }).notNull(),
    description: text("description"),
    sku: varchar("sku", { length: 100 }),

    // Quantities
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
    unit: varchar("unit", { length: 50 }).notNull().default("pcs"),

    // Pricing
    unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
    discount: numeric("discount", { precision: 5, scale: 2 }).notNull().default("0"),
    vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).notNull().default("20"),
    total: numeric("total", { precision: 15, scale: 2 }).notNull(),

    // Ordering
    sortOrder: integer("sort_order").notNull().default(0),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_invoice_items_invoice_id").on(table.invoiceId),
    index("idx_invoice_items_order_item_id").on(table.orderItemId),
    index("idx_invoice_items_quote_item_id").on(table.quoteItemId),
    index("idx_invoice_items_product_id").on(table.productId),
    index("idx_invoice_items_sort_order").on(table.invoiceId, table.sortOrder),
  ]
);

// Bridge table for multi-order invoicing
export const invoiceOrders = pgTable(
  "invoice_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),

    // Amount allocated from this order to this invoice
    amountAllocated: numeric("amount_allocated", { precision: 15, scale: 2 }).notNull(),

    // Tracking
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_invoice_orders_invoice_id").on(table.invoiceId),
    index("idx_invoice_orders_order_id").on(table.orderId),
    // Unique constraint: one order can be linked to same invoice only once
    index("idx_invoice_orders_unique").on(table.invoiceId, table.orderId).unique(),
  ]
);
```

## Document Workflow Examples

### 1. Simple Quote → Order → Invoice Flow

```typescript
// 1. Create Quote
const quote = await createQuote({
  tenantId: "...",
  companyId: "...", // customer
  items: [...]
});

// 2. Customer accepts quote → Create Order
const order = await createOrderFromQuote({
  quoteId: quote.id,
  // Inherits all quote details
});

// Update quote status
await updateQuoteStatus(quote.id, "converted");

// 3. Order is confirmed → Create Invoice
const invoice = await createInvoiceFromOrder({
  orderId: order.id,
});

// Link order to invoice
await linkOrderToInvoice({
  invoiceId: invoice.id,
  orderId: order.id,
  amountAllocated: order.total,
});
```

### 2. Consolidated Multi-Order Invoice

```typescript
// Multiple orders from same customer
const order1 = await createOrder({ ... });
const order2 = await createOrder({ ... });
const order3 = await createOrder({ ... });

// Create single consolidated invoice
const invoice = await createConsolidatedInvoice({
  tenantId: "...",
  companyId: "...",
  orders: [
    { orderId: order1.id, amountAllocated: order1.total },
    { orderId: order2.id, amountAllocated: order2.total },
    { orderId: order3.id, amountAllocated: order3.remainingAmount }, // partial
  ],
});

// Invoice items are aggregated from all orders
// invoice_orders bridge table tracks the relationships
```

### 3. Direct Quote → Invoice Flow

```typescript
// Quick invoice without order
const quote = await createQuote({ ... });

// Customer accepts quote → Create Invoice directly
const invoice = await createInvoiceFromQuote({
  quoteId: quote.id,
});

// No order involved, quoteId is tracked
await updateQuoteStatus(quote.id, "converted");
```

### 4. Partial Order Invoicing

```typescript
const order = await createOrder({
  total: 10000,
  items: [...]
});

// Invoice 40% upfront
const invoice1 = await createPartialInvoice({
  orderId: order.id,
  percentage: 0.4, // 40%
});

await linkOrderToInvoice({
  invoiceId: invoice1.id,
  orderId: order.id,
  amountAllocated: 4000,
});

// Update order
await updateOrder(order.id, {
  status: "partially_invoiced",
  invoicedAmount: 4000,
  remainingAmount: 6000,
});

// Later, invoice remaining 60%
const invoice2 = await createPartialInvoice({
  orderId: order.id,
  amountAllocated: 6000,
});

await linkOrderToInvoice({
  invoiceId: invoice2.id,
  orderId: order.id,
  amountAllocated: 6000,
});

// Update order
await updateOrder(order.id, {
  status: "invoiced",
  invoicedAmount: 10000,
  remainingAmount: 0,
});
```

## Migration Strategy

See [improved-schema-migration.sql](./improved-schema-migration.sql) for SQL migration script.

Key migration steps:
1. Add new enums
2. Add tenantId columns to existing tables
3. Create organization_roles table
4. Create invoice_orders bridge table
5. Remove orders.invoice_id column
6. Add new audit columns
7. Update indexes
8. Backfill data

## Type Safety

All types will be auto-generated from Drizzle schema:

```typescript
export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;
export type QuoteWithItems = Quote & { items: QuoteItem[] };

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderWithItems = Order & { items: OrderItem[] };

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceWithItems = Invoice & {
  items: InvoiceItem[];
  orders?: Order[];
};
```
