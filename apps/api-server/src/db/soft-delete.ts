import { sql } from "./client";

// ============================================
// Soft Delete Utility Functions
// ============================================

export type SoftDeletableTable = "invoices" | "quotes" | "delivery_notes" | "payments";

/**
 * Soft delete a record by setting deleted_at timestamp
 * @param table Table name
 * @param id Record ID
 * @param deletedBy User ID who deleted the record
 */
export async function softDelete(
  table: SoftDeletableTable,
  id: string,
  deletedBy?: string
): Promise<boolean> {
  const now = new Date().toISOString();
  
  const result = await sql`
    UPDATE ${sql(table)}
    SET deleted_at = ${now}, deleted_by = ${deletedBy || null}
    WHERE id = ${id} AND deleted_at IS NULL
  `;
  
  return result.count > 0;
}

/**
 * Restore a soft-deleted record
 * @param table Table name
 * @param id Record ID
 */
export async function restore(
  table: SoftDeletableTable,
  id: string
): Promise<boolean> {
  const result = await sql`
    UPDATE ${sql(table)}
    SET deleted_at = NULL, deleted_by = NULL
    WHERE id = ${id} AND deleted_at IS NOT NULL
  `;
  
  return result.count > 0;
}

/**
 * Permanently delete a record (use with caution)
 * Only works on already soft-deleted records
 * @param table Table name
 * @param id Record ID
 */
export async function permanentDelete(
  table: SoftDeletableTable,
  id: string
): Promise<boolean> {
  const result = await sql`
    DELETE FROM ${sql(table)}
    WHERE id = ${id} AND deleted_at IS NOT NULL
  `;
  
  return result.count > 0;
}

/**
 * Check if a record is soft-deleted
 * @param table Table name
 * @param id Record ID
 */
export async function isDeleted(
  table: SoftDeletableTable,
  id: string
): Promise<boolean> {
  const result = await sql`
    SELECT deleted_at FROM ${sql(table)}
    WHERE id = ${id}
  `;
  
  if (result.length === 0) return false;
  return result[0].deleted_at !== null;
}

/**
 * Get all soft-deleted records for a table
 * @param table Table name
 * @param limit Maximum records to return
 */
export async function getDeletedRecords<T>(
  table: SoftDeletableTable,
  limit: number = 100
): Promise<T[]> {
  const rows = await sql`
    SELECT * FROM ${sql(table)}
    WHERE deleted_at IS NOT NULL
    ORDER BY deleted_at DESC
    LIMIT ${limit}
  `;
  return rows as unknown as T[];
}

/**
 * Clean up old soft-deleted records (records deleted more than X days ago)
 * @param table Table name
 * @param daysOld Number of days after which to permanently delete
 */
export async function cleanupOldDeletedRecords(
  table: SoftDeletableTable,
  daysOld: number = 90
): Promise<number> {
  const result = await sql`
    DELETE FROM ${sql(table)}
    WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '${sql.unsafe(daysOld.toString())} days'
  `;
  
  return result.count;
}

// ============================================
// Query Helpers for Soft Delete
// ============================================

/**
 * WHERE clause fragment to exclude soft-deleted records
 */
export const notDeleted = sql`deleted_at IS NULL`;

/**
 * WHERE clause fragment to include only soft-deleted records
 */
export const onlyDeleted = sql`deleted_at IS NOT NULL`;

/**
 * Base query conditions for active (non-deleted) invoices
 */
export async function getActiveInvoices() {
  return sql`SELECT * FROM invoices WHERE deleted_at IS NULL ORDER BY created_at DESC`;
}

/**
 * Base query conditions for active (non-deleted) quotes
 */
export async function getActiveQuotes() {
  return sql`SELECT * FROM quotes WHERE deleted_at IS NULL ORDER BY created_at DESC`;
}

/**
 * Base query conditions for active (non-deleted) delivery notes
 */
export async function getActiveDeliveryNotes() {
  return sql`SELECT * FROM delivery_notes WHERE deleted_at IS NULL ORDER BY created_at DESC`;
}

/**
 * Base query conditions for active (non-deleted) payments
 */
export async function getActivePayments() {
  return sql`SELECT * FROM payments WHERE deleted_at IS NULL ORDER BY created_at DESC`;
}

// ============================================
// Business Rule Validations
// ============================================

/**
 * Check if an invoice can be deleted
 * Returns error message if cannot be deleted, null if OK
 */
export async function canDeleteInvoice(invoiceId: string): Promise<string | null> {
  const invoice = await sql`
    SELECT id, status, paid_amount, total
    FROM invoices
    WHERE id = ${invoiceId} AND deleted_at IS NULL
  `;

  if (invoice.length === 0) {
    return "Invoice not found";
  }

  const inv = invoice[0];

  // Cannot delete paid invoices
  if (inv.status === "paid") {
    return "Cannot delete a paid invoice. Consider cancelling it instead.";
  }

  // Cannot delete if there are related payments
  const payments = await sql`
    SELECT COUNT(*) as count FROM payments
    WHERE invoice_id = ${invoiceId} AND deleted_at IS NULL AND status = 'completed'
  `;

  if (parseInt(payments[0].count, 10) > 0) {
    return "Cannot delete invoice with completed payments. Remove payments first.";
  }

  // Cannot delete if there are related delivery notes
  const deliveryNotes = await sql`
    SELECT COUNT(*) as count FROM delivery_notes
    WHERE invoice_id = ${invoiceId} AND deleted_at IS NULL
  `;

  if (parseInt(deliveryNotes[0].count, 10) > 0) {
    return "Cannot delete invoice with related delivery notes. Delete delivery notes first.";
  }

  return null; // Can be deleted
}

/**
 * Check if a quote can be deleted
 * Returns error message if cannot be deleted, null if OK
 */
export async function canDeleteQuote(quoteId: string): Promise<string | null> {
  const quote = await sql`
    SELECT id, status
    FROM quotes
    WHERE id = ${quoteId} AND deleted_at IS NULL
  `;

  if (quote.length === 0) {
    return "Quote not found";
  }

  // Cannot delete accepted quotes that have been converted to invoices
  if (quote[0].status === "accepted") {
    const invoices = await sql`
      SELECT COUNT(*) as count FROM invoices
      WHERE quote_id = ${quoteId} AND deleted_at IS NULL
    `;

    if (parseInt(invoices[0].count, 10) > 0) {
      return "Cannot delete accepted quote that has been converted to an invoice.";
    }
  }

  return null; // Can be deleted
}

/**
 * Check if a delivery note can be deleted
 * Returns error message if cannot be deleted, null if OK
 */
export async function canDeleteDeliveryNote(deliveryNoteId: string): Promise<string | null> {
  const note = await sql`
    SELECT id, status
    FROM delivery_notes
    WHERE id = ${deliveryNoteId} AND deleted_at IS NULL
  `;

  if (note.length === 0) {
    return "Delivery note not found";
  }

  // Cannot delete delivered notes
  if (note[0].status === "delivered") {
    return "Cannot delete a delivered delivery note. Consider marking it as returned.";
  }

  return null; // Can be deleted
}

/**
 * Check if a payment can be deleted
 * Returns error message if cannot be deleted, null if OK
 */
export async function canDeletePayment(paymentId: string): Promise<string | null> {
  const payment = await sql`
    SELECT id, status, amount, invoice_id
    FROM payments
    WHERE id = ${paymentId} AND deleted_at IS NULL
  `;

  if (payment.length === 0) {
    return "Payment not found";
  }

  // Cannot delete completed payments - use refund instead
  if (payment[0].status === "completed") {
    return "Cannot delete a completed payment. Use refund instead.";
  }

  return null; // Can be deleted
}
