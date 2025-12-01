import { pgTable, uuid, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { users, contacts } from "./users";

// Quotes (Ponude) table
export const quotes = pgTable(
	"quotes",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		quoteNumber: varchar("quote_number", { length: 50 }).notNull().unique(),
		companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
		contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
		status: varchar("status", { length: 50 }).notNull().default("draft"),
		issueDate: timestamp("issue_date", { withTimezone: true }).notNull().defaultNow(),
		validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
		subtotal: text("subtotal").notNull().default("0"),
		taxRate: text("tax_rate").notNull().default("0"),
		tax: text("tax").notNull().default("0"),
		total: text("total").notNull().default("0"),
		notes: text("notes"),
		terms: text("terms"),
		createdBy: uuid("created_by").notNull().references(() => users.id),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("idx_quotes_company_id").on(table.companyId),
		index("idx_quotes_status").on(table.status),
		index("idx_quotes_created_by").on(table.createdBy),
	]
);

// Quote Items table
export const quoteItems = pgTable(
	"quote_items",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		quoteId: uuid("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
		productName: varchar("product_name", { length: 255 }).notNull(),
		description: text("description"),
		quantity: text("quantity").notNull().default("1"),
		unitPrice: text("unit_price").notNull(),
		discount: text("discount").notNull().default("0"),
		total: text("total").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("idx_quote_items_quote_id").on(table.quoteId),
	]
);

// Invoices (Fakture) table
export const invoices = pgTable(
	"invoices",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		invoiceNumber: varchar("invoice_number", { length: 50 }).notNull().unique(),
		quoteId: uuid("quote_id").references(() => quotes.id, { onDelete: "set null" }),
		companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
		contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
		status: varchar("status", { length: 50 }).notNull().default("draft"),
		issueDate: timestamp("issue_date", { withTimezone: true }).notNull().defaultNow(),
		dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
		// grossTotal = sum of all line items (before discount)
		grossTotal: text("gross_total").notNull().default("0"),
		// subtotal = grossTotal - discount (after discount)
		subtotal: text("subtotal").notNull().default("0"),
		// discount = amount deducted from gross total
		discount: text("discount").notNull().default("0"),
		taxRate: text("tax_rate").notNull().default("0"),
		tax: text("tax").notNull().default("0"),
		total: text("total").notNull().default("0"),
		paidAmount: text("paid_amount").notNull().default("0"),
		notes: text("notes"),
		terms: text("terms"),
		createdBy: uuid("created_by").notNull().references(() => users.id),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("idx_invoices_company_id").on(table.companyId),
		index("idx_invoices_quote_id").on(table.quoteId),
		index("idx_invoices_status").on(table.status),
		index("idx_invoices_created_by").on(table.createdBy),
	]
);

// Invoice Items table
export const invoiceItems = pgTable(
	"invoice_items",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
		productName: varchar("product_name", { length: 255 }).notNull(),
		description: text("description"),
		quantity: text("quantity").notNull().default("1"),
		unitPrice: text("unit_price").notNull(),
		discount: text("discount").notNull().default("0"),
		total: text("total").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("idx_invoice_items_invoice_id").on(table.invoiceId),
	]
);

// Delivery Notes (Otpremnice) table
export const deliveryNotes = pgTable(
	"delivery_notes",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		deliveryNumber: varchar("delivery_number", { length: 50 }).notNull().unique(),
		invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
		companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
		contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
		status: varchar("status", { length: 50 }).notNull().default("pending"),
		shipDate: timestamp("ship_date", { withTimezone: true }),
		deliveryDate: timestamp("delivery_date", { withTimezone: true }),
		shippingAddress: text("shipping_address").notNull(),
		trackingNumber: varchar("tracking_number", { length: 100 }),
		carrier: varchar("carrier", { length: 100 }),
		notes: text("notes"),
		createdBy: uuid("created_by").notNull().references(() => users.id),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("idx_delivery_notes_company_id").on(table.companyId),
		index("idx_delivery_notes_invoice_id").on(table.invoiceId),
		index("idx_delivery_notes_status").on(table.status),
		index("idx_delivery_notes_created_by").on(table.createdBy),
	]
);

// Delivery Note Items table
export const deliveryNoteItems = pgTable(
	"delivery_note_items",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		deliveryNoteId: uuid("delivery_note_id").notNull().references(() => deliveryNotes.id, { onDelete: "cascade" }),
		productName: varchar("product_name", { length: 255 }).notNull(),
		description: text("description"),
		quantity: text("quantity").notNull().default("1"),
		unit: varchar("unit", { length: 50 }).notNull().default("pcs"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("idx_delivery_note_items_delivery_note_id").on(table.deliveryNoteId),
	]
);

export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;
export type QuoteItem = typeof quoteItems.$inferSelect;
export type NewQuoteItem = typeof quoteItems.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type NewInvoiceItem = typeof invoiceItems.$inferInsert;
export type DeliveryNote = typeof deliveryNotes.$inferSelect;
export type NewDeliveryNote = typeof deliveryNotes.$inferInsert;
export type DeliveryNoteItem = typeof deliveryNoteItems.$inferSelect;
export type NewDeliveryNoteItem = typeof deliveryNoteItems.$inferInsert;

