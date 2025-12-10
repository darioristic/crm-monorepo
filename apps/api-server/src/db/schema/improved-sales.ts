/**
 * Improved Sales Module Schema - CRM + ERP
 *
 * Features:
 * - Multi-tenancy support (tenantId on all tables)
 * - Flexible organization roles (customer, vendor, supplier, partner)
 * - Cross-document workflows (Quote → Order → Invoice)
 * - Multi-order invoicing support (invoice_orders bridge table)
 * - Comprehensive audit trail
 * - Partial invoicing support
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { products } from "./products";
import { tenants } from "./tenants";
import { contacts, users } from "./users";

// ============================================
// Enums
// ============================================

export const quoteStatus = pgEnum("quote_status", [
  "draft",
  "sent",
  "viewed",
  "accepted",
  "rejected",
  "expired",
  "converted", // converted to order/invoice
]);

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

export const organizationRole = pgEnum("organization_role", [
  "customer",
  "vendor",
  "supplier",
  "partner",
  "internal",
]);

// ============================================
// Organization Roles
// ============================================

/**
 * Allows one company to have multiple roles (customer + vendor + supplier, etc.)
 * This enables B2B scenarios where relationships are bidirectional
 */
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

    // Additional metadata per role
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
    index("idx_org_roles_is_active").on(table.isActive),
    // Unique constraint: one company can only have each role once per tenant
    uniqueIndex("uix_org_roles_company_tenant_role").on(
      table.companyId,
      table.tenantId,
      table.role
    ),
  ]
);

// ============================================
// Quotes
// ============================================

export const quotesImproved = pgTable(
  "quotes_improved",
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
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),

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
    fromDetails: jsonb("from_details").$type<Record<string, unknown>>(),
    customerDetails: jsonb("customer_details").$type<Record<string, unknown>>(),
    templateSettings: jsonb("template_settings").$type<Record<string, unknown>>(),

    // Tracking
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    convertedToOrderAt: timestamp("converted_to_order_at", {
      withTimezone: true,
    }),
    convertedToInvoiceAt: timestamp("converted_to_invoice_at", {
      withTimezone: true,
    }),

    // Audit
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_quotes_imp_tenant_company").on(table.tenantId, table.companyId),
    index("idx_quotes_imp_tenant_status").on(table.tenantId, table.status),
    index("idx_quotes_imp_created_at").on(table.createdAt.desc()),
    index("idx_quotes_imp_expires_at").on(table.expiresAt),
    index("idx_quotes_imp_quote_number").on(table.quoteNumber),
    index("idx_quotes_imp_contact_id").on(table.contactId),
  ]
);

export const quoteItemsImproved = pgTable(
  "quote_items_improved",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotesImproved.id, { onDelete: "cascade" }),

    // Product info
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
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
    index("idx_quote_items_imp_quote_id").on(table.quoteId),
    index("idx_quote_items_imp_product_id").on(table.productId),
    index("idx_quote_items_imp_sort_order").on(table.quoteId, table.sortOrder),
  ]
);

// ============================================
// Orders
// ============================================

export const ordersImproved = pgTable(
  "orders_improved",
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
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),

    // Source quote (optional)
    quoteId: uuid("quote_id").references(() => quotesImproved.id, {
      onDelete: "set null",
    }),

    // Status
    status: orderStatus("status").notNull().default("draft"),

    // Dates
    orderDate: timestamp("order_date", { withTimezone: true }).notNull().defaultNow(),
    expectedDeliveryDate: timestamp("expected_delivery_date", {
      withTimezone: true,
    }),
    actualDeliveryDate: timestamp("actual_delivery_date", {
      withTimezone: true,
    }),

    // Financial
    subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull().default("0"),
    taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    tax: numeric("tax", { precision: 15, scale: 2 }).notNull().default("0"),
    discount: numeric("discount", { precision: 15, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 15, scale: 2 }).notNull().default("0"),
    currency: varchar("currency", { length: 3 }).notNull().default("EUR"),

    // Invoicing tracking
    invoicedAmount: numeric("invoiced_amount", { precision: 15, scale: 2 }).notNull().default("0"),
    remainingAmount: numeric("remaining_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),

    // Content
    notes: text("notes"),
    terms: text("terms"),
    internalNotes: text("internal_notes"),
    purchaseOrderNumber: varchar("purchase_order_number", { length: 100 }),

    // Template data (JSON)
    fromDetails: jsonb("from_details").$type<Record<string, unknown>>(),
    customerDetails: jsonb("customer_details").$type<Record<string, unknown>>(),
    shippingDetails: jsonb("shipping_details").$type<Record<string, unknown>>(),

    // Audit
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    confirmedBy: uuid("confirmed_by").references(() => users.id),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    cancelledBy: uuid("cancelled_by").references(() => users.id),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_orders_imp_tenant_company").on(table.tenantId, table.companyId),
    index("idx_orders_imp_tenant_status").on(table.tenantId, table.status),
    index("idx_orders_imp_quote_id").on(table.quoteId),
    index("idx_orders_imp_created_at").on(table.createdAt.desc()),
    index("idx_orders_imp_order_number").on(table.orderNumber),
    index("idx_orders_imp_purchase_order").on(table.purchaseOrderNumber),
    index("idx_orders_imp_contact_id").on(table.contactId),
  ]
);

export const orderItemsImproved = pgTable(
  "order_items_improved",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => ordersImproved.id, { onDelete: "cascade" }),

    // Link to quote item if this order came from a quote
    quoteItemId: uuid("quote_item_id").references(() => quoteItemsImproved.id, {
      onDelete: "set null",
    }),

    // Product info
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    productName: varchar("product_name", { length: 255 }).notNull(),
    description: text("description"),
    sku: varchar("sku", { length: 100 }),

    // Quantities
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
    fulfilledQuantity: numeric("fulfilled_quantity", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    invoicedQuantity: numeric("invoiced_quantity", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
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
    index("idx_order_items_imp_order_id").on(table.orderId),
    index("idx_order_items_imp_quote_item_id").on(table.quoteItemId),
    index("idx_order_items_imp_product_id").on(table.productId),
    index("idx_order_items_imp_sort_order").on(table.orderId, table.sortOrder),
  ]
);

// ============================================
// Invoices
// ============================================

export const invoicesImproved = pgTable(
  "invoices_improved",
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
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),

    // Source documents (optional)
    // Direct quote-to-invoice flow
    quoteId: uuid("quote_id").references(() => quotesImproved.id, {
      onDelete: "set null",
    }),
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
    remainingAmount: numeric("remaining_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    currency: varchar("currency", { length: 10 }).notNull().default("EUR"),

    // Payment terms
    paymentTerms: integer("payment_terms"), // days
    paymentMethod: varchar("payment_method", { length: 50 }),

    // Content
    notes: text("notes"),
    terms: text("terms"),
    internalNotes: text("internal_notes"),

    // Template data (JSON)
    fromDetails: jsonb("from_details").$type<Record<string, unknown>>(),
    customerDetails: jsonb("customer_details").$type<Record<string, unknown>>(),
    logoUrl: text("logo_url"),
    templateSettings: jsonb("template_settings").$type<Record<string, unknown>>(),

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
    updatedBy: uuid("updated_by").references(() => users.id),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    cancelledBy: uuid("cancelled_by").references(() => users.id),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_invoices_imp_tenant_company").on(table.tenantId, table.companyId),
    index("idx_invoices_imp_tenant_status").on(table.tenantId, table.status),
    index("idx_invoices_imp_quote_id").on(table.quoteId),
    index("idx_invoices_imp_created_at").on(table.createdAt.desc()),
    index("idx_invoices_imp_due_date").on(table.dueDate),
    index("idx_invoices_imp_token").on(table.token),
    index("idx_invoices_imp_invoice_number").on(table.invoiceNumber),
    index("idx_invoices_imp_contact_id").on(table.contactId),
  ]
);

export const invoiceItemsImproved = pgTable(
  "invoice_items_improved",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoicesImproved.id, { onDelete: "cascade" }),

    // Link to order item if this invoice came from orders
    orderItemId: uuid("order_item_id").references(() => orderItemsImproved.id, {
      onDelete: "set null",
    }),

    // Link to quote item if direct quote-to-invoice
    quoteItemId: uuid("quote_item_id").references(() => quoteItemsImproved.id, {
      onDelete: "set null",
    }),

    // Product info
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
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
    index("idx_invoice_items_imp_invoice_id").on(table.invoiceId),
    index("idx_invoice_items_imp_order_item_id").on(table.orderItemId),
    index("idx_invoice_items_imp_quote_item_id").on(table.quoteItemId),
    index("idx_invoice_items_imp_product_id").on(table.productId),
    index("idx_invoice_items_imp_sort_order").on(table.invoiceId, table.sortOrder),
  ]
);

// ============================================
// Invoice-Order Bridge (Multi-Order Invoicing)
// ============================================

/**
 * Bridge table for multi-order invoicing
 * Allows one invoice to consolidate multiple orders
 * Tracks amount allocated from each order to the invoice
 */
export const invoiceOrders = pgTable(
  "invoice_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoicesImproved.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => ordersImproved.id, { onDelete: "cascade" }),

    // Amount allocated from this order to this invoice
    amountAllocated: numeric("amount_allocated", { precision: 15, scale: 2 }).notNull(),

    // Notes about this specific order-invoice relationship
    notes: text("notes"),

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
    uniqueIndex("uix_invoice_orders_invoice_order").on(table.invoiceId, table.orderId),
  ]
);

// ============================================
// TypeScript Types
// ============================================

// Organization Roles
export type OrganizationRole = typeof organizationRoles.$inferSelect;
export type NewOrganizationRole = typeof organizationRoles.$inferInsert;

// Quotes
export type QuoteImproved = typeof quotesImproved.$inferSelect;
export type NewQuoteImproved = typeof quotesImproved.$inferInsert;
export type QuoteItemImproved = typeof quoteItemsImproved.$inferSelect;
export type NewQuoteItemImproved = typeof quoteItemsImproved.$inferInsert;
export type QuoteWithItems = QuoteImproved & { items: QuoteItemImproved[] };

// Orders
export type OrderImproved = typeof ordersImproved.$inferSelect;
export type NewOrderImproved = typeof ordersImproved.$inferInsert;
export type OrderItemImproved = typeof orderItemsImproved.$inferSelect;
export type NewOrderItemImproved = typeof orderItemsImproved.$inferInsert;
export type OrderWithItems = OrderImproved & { items: OrderItemImproved[] };

// Invoices
export type InvoiceImproved = typeof invoicesImproved.$inferSelect;
export type NewInvoiceImproved = typeof invoicesImproved.$inferInsert;
export type InvoiceItemImproved = typeof invoiceItemsImproved.$inferSelect;
export type NewInvoiceItemImproved = typeof invoiceItemsImproved.$inferInsert;
export type InvoiceOrder = typeof invoiceOrders.$inferSelect;
export type NewInvoiceOrder = typeof invoiceOrders.$inferInsert;
export type InvoiceWithItems = InvoiceImproved & {
  items: InvoiceItemImproved[];
  orders?: OrderImproved[];
};
