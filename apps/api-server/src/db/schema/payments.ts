import { index, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { invoices } from "./sales";
import { users } from "./users";

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "credit_card",
  "debit_card",
  "bank_transfer",
  "check",
  "paypal",
  "stripe",
  "other",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "completed",
  "failed",
  "refunded",
  "cancelled",
]);

// Payments table
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    amount: text("amount").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
    paymentMethod: paymentMethodEnum("payment_method").notNull().default("bank_transfer"),
    status: paymentStatusEnum("status").notNull().default("completed"),
    paymentDate: timestamp("payment_date", { withTimezone: true }).notNull().defaultNow(),
    reference: varchar("reference", { length: 255 }),
    transactionId: varchar("transaction_id", { length: 255 }),
    notes: text("notes"),
    metadata: text("metadata"), // JSON stored as text
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_payments_invoice_id").on(table.invoiceId),
    index("idx_payments_status").on(table.status),
    index("idx_payments_payment_date").on(table.paymentDate),
    index("idx_payments_recorded_by").on(table.recordedBy),
    index("idx_payments_reference").on(table.reference),
  ]
);

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
