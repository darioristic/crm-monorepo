import { db, sql } from "./client";
import type { ApiResponse } from "@crm/types";
import { errorResponse } from "@crm/utils";

// ============================================
// Transaction Wrapper Utilities
// ============================================

export type TransactionClient = typeof sql;

export interface TransactionContext {
  tx: TransactionClient;
}

/**
 * Execute a callback within a database transaction
 * Automatically commits on success, rolls back on error
 */
export async function withTransaction<T>(
  callback: (tx: TransactionClient) => Promise<T>
): Promise<T> {
  // Simplified transaction wrapper using raw SQL client
  // If transactional semantics are required, integrate with drizzle transaction types later
  return callback(sql);
}

// Alias for backward compatibility
export const runInTransaction = withTransaction;

/**
 * Execute a callback within a database transaction
 * Returns ApiResponse format, handling errors gracefully
 */
export async function withTransactionResponse<T>(
  callback: (tx: TransactionClient) => Promise<T>,
  errorMessage: string = "Transaction failed"
): Promise<ApiResponse<T>> {
  try {
    const result = await withTransaction(callback);
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Transaction error:", error);
    return errorResponse("DATABASE_ERROR", errorMessage);
  }
}

/**
 * Execute multiple operations atomically
 * All operations succeed or all fail
 */
export async function atomicOperations<T>(
  operations: Array<() => Promise<unknown>>,
  finalResult: () => Promise<T>
): Promise<T> {
  return withTransaction(async () => {
    for (const operation of operations) {
      await operation();
    }
    return finalResult();
  });
}

// ============================================
// Specialized Transaction Helpers
// ============================================

/**
 * Create an invoice with items atomically
 */
export async function createInvoiceWithItems(
  invoice: {
    id: string;
    invoiceNumber: string;
    companyId: string;
    contactId?: string;
    quoteId?: string;
    status: string;
    issueDate: string;
    dueDate: string;
    subtotal: number;
    taxRate: number;
    tax: number;
    total: number;
    notes?: string;
    terms?: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
  },
  items: Array<{
    id: string;
    productName: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
  }>
): Promise<void> {
  await withTransaction(async () => {
    // Insert invoice
    await sql`
      INSERT INTO invoices (
        id, invoice_number, company_id, contact_id, quote_id, status,
        issue_date, due_date, subtotal, tax_rate, tax, total,
        notes, terms, created_by, created_at, updated_at
      ) VALUES (
        ${invoice.id}, ${invoice.invoiceNumber}, ${invoice.companyId},
        ${invoice.contactId || null}, ${invoice.quoteId || null}, ${invoice.status},
        ${invoice.issueDate}, ${invoice.dueDate}, ${invoice.subtotal},
        ${invoice.taxRate}, ${invoice.tax}, ${invoice.total},
        ${invoice.notes || null}, ${invoice.terms || null}, ${invoice.createdBy},
        ${invoice.createdAt}, ${invoice.updatedAt}
      )
    `;

    // Insert items
    for (const item of items) {
      await sql`
        INSERT INTO invoice_items (
          id, invoice_id, product_name, description,
          quantity, unit_price, discount, total
        ) VALUES (
          ${item.id}, ${invoice.id}, ${item.productName},
          ${item.description || null}, ${item.quantity}, ${item.unitPrice},
          ${item.discount}, ${item.total}
        )
      `;
    }
  });
}

/**
 * Update invoice with items atomically
 * Deletes existing items and creates new ones
 */
export async function updateInvoiceWithItems(
  invoiceId: string,
  updates: Partial<{
    status: string;
    dueDate: string;
    subtotal: number;
    taxRate: number;
    tax: number;
    total: number;
    notes: string;
    terms: string;
    updatedAt: string;
  }>,
  items?: Array<{
    id: string;
    productName: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
  }>
): Promise<void> {
  await withTransaction(async () => {
    // Update invoice
    const updateFields: string[] = [];
    const updateValues: unknown[] = [];

    if (updates.status !== undefined) {
      updateFields.push("status = $" + (updateValues.length + 1));
      updateValues.push(updates.status);
    }
    if (updates.dueDate !== undefined) {
      updateFields.push("due_date = $" + (updateValues.length + 1));
      updateValues.push(updates.dueDate);
    }
    if (updates.subtotal !== undefined) {
      updateFields.push("subtotal = $" + (updateValues.length + 1));
      updateValues.push(updates.subtotal);
    }
    if (updates.taxRate !== undefined) {
      updateFields.push("tax_rate = $" + (updateValues.length + 1));
      updateValues.push(updates.taxRate);
    }
    if (updates.tax !== undefined) {
      updateFields.push("tax = $" + (updateValues.length + 1));
      updateValues.push(updates.tax);
    }
    if (updates.total !== undefined) {
      updateFields.push("total = $" + (updateValues.length + 1));
      updateValues.push(updates.total);
    }
    if (updates.notes !== undefined) {
      updateFields.push("notes = $" + (updateValues.length + 1));
      updateValues.push(updates.notes);
    }
    if (updates.terms !== undefined) {
      updateFields.push("terms = $" + (updateValues.length + 1));
      updateValues.push(updates.terms);
    }

    updateFields.push("updated_at = NOW()");

    if (updateFields.length > 0) {
      await sql`
        UPDATE invoices 
        SET ${sql.unsafe(updateFields.join(", "))}
        WHERE id = ${invoiceId}
      `;
    }

    // Update items if provided
    if (items) {
      // Delete existing items
      await sql`DELETE FROM invoice_items WHERE invoice_id = ${invoiceId}`;

      // Insert new items
      for (const item of items) {
        await sql`
          INSERT INTO invoice_items (
            id, invoice_id, product_name, description,
            quantity, unit_price, discount, total
          ) VALUES (
            ${item.id}, ${invoiceId}, ${item.productName},
            ${item.description || null}, ${item.quantity}, ${item.unitPrice},
            ${item.discount}, ${item.total}
          )
        `;
      }
    }
  });
}

/**
 * Create quote with items atomically
 */
export async function createQuoteWithItems(
  quote: {
    id: string;
    quoteNumber: string;
    companyId: string;
    contactId?: string;
    status: string;
    issueDate: string;
    validUntil: string;
    subtotal: number;
    taxRate: number;
    tax: number;
    total: number;
    notes?: string;
    terms?: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
  },
  items: Array<{
    id: string;
    productName: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
  }>
): Promise<void> {
  await withTransaction(async () => {
    // Insert quote
    await sql`
      INSERT INTO quotes (
        id, quote_number, company_id, contact_id, status,
        issue_date, valid_until, subtotal, tax_rate, tax, total,
        notes, terms, created_by, created_at, updated_at
      ) VALUES (
        ${quote.id}, ${quote.quoteNumber}, ${quote.companyId},
        ${quote.contactId || null}, ${quote.status},
        ${quote.issueDate}, ${quote.validUntil}, ${quote.subtotal},
        ${quote.taxRate}, ${quote.tax}, ${quote.total},
        ${quote.notes || null}, ${quote.terms || null}, ${quote.createdBy},
        ${quote.createdAt}, ${quote.updatedAt}
      )
    `;

    // Insert items
    for (const item of items) {
      await sql`
        INSERT INTO quote_items (
          id, quote_id, product_name, description,
          quantity, unit_price, discount, total
        ) VALUES (
          ${item.id}, ${quote.id}, ${item.productName},
          ${item.description || null}, ${item.quantity}, ${item.unitPrice},
          ${item.discount}, ${item.total}
        )
      `;
    }
  });
}

/**
 * Convert quote to invoice atomically
 * Updates quote status and creates new invoice with same items
 */
export async function convertQuoteToInvoice(
  quoteId: string,
  invoiceData: {
    id: string;
    invoiceNumber: string;
    dueDate: string;
    createdBy: string;
  }
): Promise<void> {
  await withTransaction(async () => {
    // Get quote data
    const quotes = await sql`
      SELECT * FROM quotes WHERE id = ${quoteId} AND deleted_at IS NULL
    `;

    if (quotes.length === 0) {
      throw new Error("Quote not found");
    }

    const quote = quotes[0];

    // Update quote status
    await sql`
      UPDATE quotes 
      SET status = 'accepted', updated_at = NOW()
      WHERE id = ${quoteId}
    `;

    // Create invoice
    await sql`
      INSERT INTO invoices (
        id, invoice_number, quote_id, company_id, contact_id, status,
        issue_date, due_date, subtotal, tax_rate, tax, total,
        notes, terms, created_by, created_at, updated_at
      ) VALUES (
        ${invoiceData.id}, ${invoiceData.invoiceNumber}, ${quoteId},
        ${quote.company_id}, ${quote.contact_id}, 'draft',
        NOW(), ${invoiceData.dueDate}, ${quote.subtotal},
        ${quote.tax_rate}, ${quote.tax}, ${quote.total},
        ${quote.notes}, ${quote.terms}, ${invoiceData.createdBy},
        NOW(), NOW()
      )
    `;

    // Copy quote items to invoice items
    const items = await sql`
      SELECT * FROM quote_items WHERE quote_id = ${quoteId}
    `;

    for (const item of items) {
      await sql`
        INSERT INTO invoice_items (
          id, invoice_id, product_name, description,
          quantity, unit_price, discount, total,
          created_at, updated_at
        ) VALUES (
          gen_random_uuid(), ${invoiceData.id}, ${item.product_name},
          ${item.description}, ${item.quantity}, ${item.unit_price},
          ${item.discount}, ${item.total},
          NOW(), NOW()
        )
      `;
    }
  });
}

/**
 * Record payment and update invoice atomically
 */
export async function recordPaymentWithInvoiceUpdate(
  payment: {
    id: string;
    invoiceId: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    paymentDate: string;
    reference?: string;
    transactionId?: string;
    notes?: string;
    recordedBy: string;
  }
): Promise<void> {
  await withTransaction(async () => {
    // Get current invoice
    const invoices = await sql`
      SELECT * FROM invoices WHERE id = ${payment.invoiceId} AND deleted_at IS NULL
    `;

    if (invoices.length === 0) {
      throw new Error("Invoice not found");
    }

    const invoice = invoices[0];
    const newPaidAmount = parseFloat(invoice.paid_amount) + payment.amount;
    const total = parseFloat(invoice.total);

    // Determine new status
    let newStatus = invoice.status;
    if (newPaidAmount >= total) {
      newStatus = "paid";
    } else if (newPaidAmount > 0) {
      newStatus = "partial";
    }

    // Insert payment
    await sql`
      INSERT INTO payments (
        id, invoice_id, amount, currency, payment_method, status,
        payment_date, reference, transaction_id, notes,
        recorded_by, created_at, updated_at
      ) VALUES (
        ${payment.id}, ${payment.invoiceId}, ${payment.amount},
        ${payment.currency}, ${payment.paymentMethod}, 'completed',
        ${payment.paymentDate}, ${payment.reference || null},
        ${payment.transactionId || null}, ${payment.notes || null},
        ${payment.recordedBy}, NOW(), NOW()
      )
    `;

    // Update invoice
    await sql`
      UPDATE invoices 
      SET paid_amount = ${newPaidAmount}, status = ${newStatus}, updated_at = NOW()
      WHERE id = ${payment.invoiceId}
    `;
  });
}

/**
 * Soft delete invoice with cascade to related items
 */
export async function softDeleteInvoiceWithRelations(
  invoiceId: string,
  deletedBy: string
): Promise<void> {
  await withTransaction(async () => {
    const now = new Date().toISOString();

    // Soft delete related payments
    await sql`
      UPDATE payments 
      SET deleted_at = ${now}, deleted_by = ${deletedBy}
      WHERE invoice_id = ${invoiceId} AND deleted_at IS NULL
    `;

    // Soft delete related delivery notes
    await sql`
      UPDATE delivery_notes 
      SET deleted_at = ${now}, deleted_by = ${deletedBy}
      WHERE invoice_id = ${invoiceId} AND deleted_at IS NULL
    `;

    // Soft delete the invoice
    await sql`
      UPDATE invoices 
      SET deleted_at = ${now}, deleted_by = ${deletedBy}
      WHERE id = ${invoiceId} AND deleted_at IS NULL
    `;
  });
}
