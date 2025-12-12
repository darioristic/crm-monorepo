/**
 * Workflow Service - Automates business processes
 * Quote → Invoice → Delivery Note flow
 */

import { randomUUID } from "node:crypto";
import type { ApiResponse, DeliveryNote, Invoice, Quote } from "@crm/types";
import { errorResponse, successResponse } from "@crm/utils";
import { sql } from "../db/client";
import { runInTransaction } from "../db/transaction";
import { logger } from "../lib/logger";
import { emailService } from "./email.service";

// ============================================
// Types
// ============================================

export type WorkflowStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";
export type WorkflowType =
  | "quote_to_invoice"
  | "invoice_to_delivery"
  | "full_sales_cycle"
  | "payment_reminder";

export interface WorkflowStep {
  id: string;
  name: string;
  status: WorkflowStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface WorkflowInstance {
  id: string;
  type: WorkflowType;
  status: WorkflowStatus;
  sourceId: string;
  sourceType: "quote" | "invoice";
  targetId?: string;
  targetType?: "invoice" | "delivery_note";
  steps: WorkflowStep[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface ConvertQuoteOptions {
  quoteId: string;
  userId: string;
  sendEmail?: boolean;
  invoiceOverrides?: {
    dueDate?: string;
    notes?: string;
    paymentTerms?: string;
  };
}

export interface ConvertInvoiceOptions {
  invoiceId: string;
  userId: string;
  shippingAddress?: string;
  deliveryNotes?: string;
}

// ============================================
// Invoice Number Generator
// ============================================

async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  // Get the last invoice number for this year
  const result = await sql`
    SELECT invoice_number FROM invoices 
    WHERE invoice_number LIKE ${`${prefix}%`}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  let nextNumber = 1;
  if (result.length > 0) {
    const lastNumber = result[0].invoice_number;
    const numPart = parseInt(lastNumber.replace(prefix, ""), 10);
    if (!Number.isNaN(numPart)) {
      nextNumber = numPart + 1;
    }
  }

  return `${prefix}${String(nextNumber).padStart(4, "0")}`;
}

async function generateDeliveryNoteNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `DN-${year}-`;

  const result = await sql`
    SELECT delivery_note_number FROM delivery_notes 
    WHERE delivery_note_number LIKE ${`${prefix}%`}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  let nextNumber = 1;
  if (result.length > 0) {
    const lastNumber = result[0].delivery_note_number;
    const numPart = parseInt(lastNumber.replace(prefix, ""), 10);
    if (!Number.isNaN(numPart)) {
      nextNumber = numPart + 1;
    }
  }

  return `${prefix}${String(nextNumber).padStart(4, "0")}`;
}

// ============================================
// Workflow Service Class
// ============================================

class WorkflowService {
  /**
   * Convert accepted quote to invoice
   */
  async convertQuoteToInvoice(
    options: ConvertQuoteOptions
  ): Promise<ApiResponse<{ invoice: Invoice; workflow: WorkflowInstance }>> {
    const { quoteId, userId, sendEmail = false, invoiceOverrides = {} } = options;
    const workflowId = randomUUID();

    const steps: WorkflowStep[] = [
      { id: "validate", name: "Validate Quote", status: "pending" },
      { id: "create_invoice", name: "Create Invoice", status: "pending" },
      { id: "copy_items", name: "Copy Line Items", status: "pending" },
      { id: "update_quote", name: "Update Quote Status", status: "pending" },
      { id: "send_email", name: "Send Email", status: sendEmail ? "pending" : "cancelled" },
    ];

    const workflow: WorkflowInstance = {
      id: workflowId,
      type: "quote_to_invoice",
      status: "in_progress",
      sourceId: quoteId,
      sourceType: "quote",
      steps,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      // Step 1: Validate Quote
      steps[0].status = "in_progress";
      steps[0].startedAt = new Date().toISOString();

      const quoteData = await sql`
        SELECT * FROM quotes WHERE id = ${quoteId}
      `;

      if (quoteData.length === 0) {
        steps[0].status = "failed";
        steps[0].error = "Quote not found";
        workflow.status = "failed";
        return errorResponse("NOT_FOUND", "Quote not found");
      }

      const quote = quoteData[0];

      // Check if quote is in valid state for conversion
      if (quote.status !== "accepted" && quote.status !== "sent") {
        steps[0].status = "failed";
        steps[0].error = `Quote must be 'accepted' or 'sent' to convert. Current status: ${quote.status}`;
        workflow.status = "failed";
        return errorResponse(
          "VALIDATION_ERROR",
          `Quote must be 'accepted' or 'sent' to convert. Current status: ${quote.status}`
        );
      }

      steps[0].status = "completed";
      steps[0].completedAt = new Date().toISOString();

      // Run the conversion in a transaction
      const result = await runInTransaction(async (_tx) => {
        // Step 2: Create Invoice
        steps[1].status = "in_progress";
        steps[1].startedAt = new Date().toISOString();

        const invoiceNumber = await generateInvoiceNumber();
        const invoiceId = randomUUID();
        const issueDate = new Date();
        const dueDate = invoiceOverrides.dueDate
          ? new Date(invoiceOverrides.dueDate)
          : new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

        await sql`
          INSERT INTO invoices (
            id, company_id, contact_id, invoice_number, 
            issue_date, due_date, subtotal, tax_rate, tax, total,
            status, notes, terms, quote_id, created_by, created_at, updated_at
          ) VALUES (
            ${invoiceId}, ${quote.company_id}, ${quote.contact_id}, ${invoiceNumber},
            ${issueDate.toISOString()}, ${dueDate.toISOString()}, 
            ${quote.subtotal}, ${quote.tax_rate || "0"}, ${quote.tax}, ${quote.total},
            'draft', ${invoiceOverrides.notes || quote.notes || null},
            ${invoiceOverrides.paymentTerms || quote.terms || null}, ${quoteId},
            ${userId}, NOW(), NOW()
          )
        `;

        steps[1].status = "completed";
        steps[1].completedAt = new Date().toISOString();

        // Step 3: Copy Line Items
        steps[2].status = "in_progress";
        steps[2].startedAt = new Date().toISOString();

        const quoteItems = await sql`
          SELECT * FROM quote_items WHERE quote_id = ${quoteId}
        `;

        for (const item of quoteItems) {
          await sql`
            INSERT INTO invoice_items (
              id, invoice_id, product_name, description,
              quantity, unit_price, discount, total, created_at, updated_at
            ) VALUES (
              ${randomUUID()}, ${invoiceId}, 
              ${item.product_name}, ${item.description},
              ${item.quantity}, ${item.unit_price}, ${item.discount}, ${item.total},
              NOW(), NOW()
            )
          `;
        }

        steps[2].status = "completed";
        steps[2].completedAt = new Date().toISOString();

        // Step 4: Update Quote Status
        steps[3].status = "in_progress";
        steps[3].startedAt = new Date().toISOString();

        await sql`
          UPDATE quotes 
          SET status = 'accepted', updated_at = NOW()
          WHERE id = ${quoteId}
        `;

        steps[3].status = "completed";
        steps[3].completedAt = new Date().toISOString();

        // Get created invoice
        const invoiceResult = await sql`
          SELECT * FROM invoices WHERE id = ${invoiceId}
        `;

        return {
          invoice: invoiceResult[0],
          invoiceId,
        };
      });

      // Step 5: Send Email (outside transaction)
      if (sendEmail) {
        steps[4].status = "in_progress";
        steps[4].startedAt = new Date().toISOString();

        try {
          await emailService.sendInvoiceEmail(result.invoiceId);
          steps[4].status = "completed";
          steps[4].completedAt = new Date().toISOString();
        } catch (emailError) {
          steps[4].status = "failed";
          steps[4].error = "Failed to send email";
          logger.error(
            { error: emailError, invoiceId: result.invoiceId },
            "Failed to send invoice email"
          );
          // Don't fail the workflow for email failure
        }
      }

      workflow.status = "completed";
      workflow.completedAt = new Date().toISOString();
      workflow.targetId = result.invoiceId;
      workflow.targetType = "invoice";
      workflow.updatedAt = new Date().toISOString();

      // Get items for the invoice
      const invoiceItems = await sql`
        SELECT * FROM invoice_items WHERE invoice_id = ${result.invoiceId}
      `;

      const fullInvoice = {
        ...result.invoice,
        items: invoiceItems,
      } as unknown as Invoice;

      logger.info(
        { quoteId, invoiceId: result.invoiceId, workflowId },
        "Quote converted to invoice"
      );

      return successResponse({ invoice: fullInvoice, workflow });
    } catch (error) {
      logger.error({ error, quoteId, workflowId }, "Failed to convert quote to invoice");
      workflow.status = "failed";
      return errorResponse("INTERNAL_ERROR", "Failed to convert quote to invoice");
    }
  }

  /**
   * Convert invoice to delivery note
   */
  async convertInvoiceToDeliveryNote(
    options: ConvertInvoiceOptions
  ): Promise<ApiResponse<{ deliveryNote: DeliveryNote; workflow: WorkflowInstance }>> {
    const { invoiceId, userId, shippingAddress, deliveryNotes } = options;
    const workflowId = randomUUID();

    const steps: WorkflowStep[] = [
      { id: "validate", name: "Validate Invoice", status: "pending" },
      { id: "create_delivery", name: "Create Delivery Note", status: "pending" },
      { id: "copy_items", name: "Copy Line Items", status: "pending" },
      { id: "update_invoice", name: "Update Invoice", status: "pending" },
    ];

    const workflow: WorkflowInstance = {
      id: workflowId,
      type: "invoice_to_delivery",
      status: "in_progress",
      sourceId: invoiceId,
      sourceType: "invoice",
      steps,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      // Step 1: Validate Invoice
      steps[0].status = "in_progress";
      steps[0].startedAt = new Date().toISOString();

      const invoiceData = await sql`
        SELECT i.*, c.name as company_name, c.address as company_address
        FROM invoices i
        LEFT JOIN companies c ON i.company_id = c.id
        WHERE i.id = ${invoiceId}
      `;

      if (invoiceData.length === 0) {
        steps[0].status = "failed";
        steps[0].error = "Invoice not found";
        workflow.status = "failed";
        return errorResponse("NOT_FOUND", "Invoice not found");
      }

      const invoice = invoiceData[0];

      // Check if delivery note already exists
      const existingDelivery = await sql`
        SELECT id FROM delivery_notes WHERE invoice_id = ${invoiceId}
      `;

      if (existingDelivery.length > 0) {
        steps[0].status = "failed";
        steps[0].error = "Delivery note already exists for this invoice";
        workflow.status = "failed";
        return errorResponse("CONFLICT", "Delivery note already exists for this invoice");
      }

      steps[0].status = "completed";
      steps[0].completedAt = new Date().toISOString();

      const result = await runInTransaction(async (_tx) => {
        // Step 2: Create Delivery Note
        steps[1].status = "in_progress";
        steps[1].startedAt = new Date().toISOString();

        const deliveryNoteNumber = await generateDeliveryNoteNumber();
        const deliveryNoteId = randomUUID();

        await sql`
          INSERT INTO delivery_notes (
            id, company_id, contact_id, invoice_id, delivery_number,
            shipping_address, status, notes,
            created_by, created_at, updated_at
          ) VALUES (
            ${deliveryNoteId}, ${invoice.company_id}, ${invoice.contact_id}, ${invoiceId},
            ${deliveryNoteNumber},
            ${shippingAddress || invoice.company_address || "N/A"},
            'pending', ${deliveryNotes || null},
            ${userId}, NOW(), NOW()
          )
        `;

        steps[1].status = "completed";
        steps[1].completedAt = new Date().toISOString();

        // Step 3: Copy Line Items
        steps[2].status = "in_progress";
        steps[2].startedAt = new Date().toISOString();

        const invoiceItems = await sql`
          SELECT * FROM invoice_items WHERE invoice_id = ${invoiceId}
        `;

        for (const item of invoiceItems) {
          await sql`
            INSERT INTO delivery_note_items (
              id, delivery_note_id, product_name, description,
              quantity, unit, created_at, updated_at
            ) VALUES (
              ${randomUUID()}, ${deliveryNoteId},
              ${item.product_name}, ${item.description},
              ${item.quantity}, 'pcs', NOW(), NOW()
            )
          `;
        }

        steps[2].status = "completed";
        steps[2].completedAt = new Date().toISOString();

        // Step 4: Mark as completed (invoice already linked via delivery_notes.invoice_id)
        steps[3].status = "in_progress";
        steps[3].startedAt = new Date().toISOString();

        // Update invoice timestamp to reflect the change
        await sql`
          UPDATE invoices 
          SET updated_at = NOW()
          WHERE id = ${invoiceId}
        `;

        steps[3].status = "completed";
        steps[3].completedAt = new Date().toISOString();

        const deliveryResult = await sql`
          SELECT * FROM delivery_notes WHERE id = ${deliveryNoteId}
        `;

        return {
          deliveryNote: deliveryResult[0],
          deliveryNoteId,
        };
      });

      workflow.status = "completed";
      workflow.completedAt = new Date().toISOString();
      workflow.targetId = result.deliveryNoteId;
      workflow.targetType = "delivery_note";
      workflow.updatedAt = new Date().toISOString();

      const deliveryItems = await sql`
        SELECT * FROM delivery_note_items WHERE delivery_note_id = ${result.deliveryNoteId}
      `;

      const fullDeliveryNote = {
        ...result.deliveryNote,
        items: deliveryItems,
      } as unknown as DeliveryNote;

      logger.info(
        { invoiceId, deliveryNoteId: result.deliveryNoteId, workflowId },
        "Invoice converted to delivery note"
      );

      return successResponse({ deliveryNote: fullDeliveryNote, workflow });
    } catch (error) {
      logger.error({ error, invoiceId, workflowId }, "Failed to convert invoice to delivery note");
      workflow.status = "failed";
      return errorResponse("INTERNAL_ERROR", "Failed to convert invoice to delivery note");
    }
  }

  /**
   * Full sales cycle: Quote → Invoice → Delivery Note
   */
  async runFullSalesCycle(
    quoteId: string,
    userId: string,
    options: {
      sendInvoiceEmail?: boolean;
      createDeliveryNote?: boolean;
      shippingAddress?: string;
    } = {}
  ): Promise<
    ApiResponse<{
      invoice?: Invoice;
      deliveryNote?: DeliveryNote;
      workflow: WorkflowInstance;
    }>
  > {
    const workflowId = randomUUID();
    const { sendInvoiceEmail = false, createDeliveryNote = true, shippingAddress } = options;

    logger.info({ quoteId, workflowId, options }, "Starting full sales cycle");

    // Step 1: Convert Quote to Invoice
    const invoiceResult = await this.convertQuoteToInvoice({
      quoteId,
      userId,
      sendEmail: sendInvoiceEmail,
    });

    if (!invoiceResult.success) {
      return invoiceResult as ApiResponse<{
        invoice?: Invoice;
        deliveryNote?: DeliveryNote;
        workflow: WorkflowInstance;
      }>;
    }

    const { invoice } = invoiceResult.data!;
    let deliveryNote: DeliveryNote | undefined;

    // Step 2: Create Delivery Note (optional)
    if (createDeliveryNote) {
      const deliveryResult = await this.convertInvoiceToDeliveryNote({
        invoiceId: invoice.id,
        userId,
        shippingAddress,
      });

      if (deliveryResult.success) {
        deliveryNote = deliveryResult.data?.deliveryNote;
      } else {
        logger.warn({ invoiceId: invoice.id }, "Failed to create delivery note in full cycle");
      }
    }

    const fullWorkflow: WorkflowInstance = {
      id: workflowId,
      type: "full_sales_cycle",
      status: "completed",
      sourceId: quoteId,
      sourceType: "quote",
      targetId: deliveryNote?.id || invoice.id,
      targetType: deliveryNote ? "delivery_note" : "invoice",
      steps: [
        {
          id: "quote_to_invoice",
          name: "Convert Quote to Invoice",
          status: "completed",
          completedAt: new Date().toISOString(),
        },
        {
          id: "invoice_to_delivery",
          name: "Create Delivery Note",
          status: deliveryNote ? "completed" : createDeliveryNote ? "failed" : "cancelled",
          completedAt: deliveryNote ? new Date().toISOString() : undefined,
        },
      ],
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    logger.info(
      { quoteId, invoiceId: invoice.id, deliveryNoteId: deliveryNote?.id, workflowId },
      "Full sales cycle completed"
    );

    return successResponse({
      invoice,
      deliveryNote,
      workflow: fullWorkflow,
    });
  }

  /**
   * Get workflow status by source ID
   */
  async getWorkflowBySourceId(
    sourceId: string,
    sourceType: "quote" | "invoice"
  ): Promise<
    ApiResponse<{ related: { invoiceId?: string; deliveryNoteId?: string; quoteId?: string } }>
  > {
    try {
      if (sourceType === "quote") {
        const quote = await sql`
          SELECT invoice_id FROM quotes WHERE id = ${sourceId}
        `;

        if (quote.length === 0) {
          return errorResponse("NOT_FOUND", "Quote not found");
        }

        const invoiceId = quote[0].invoice_id;
        let deliveryNoteId: string | undefined;

        if (invoiceId) {
          const delivery = await sql`
            SELECT id FROM delivery_notes WHERE invoice_id = ${invoiceId}
          `;
          deliveryNoteId = delivery[0]?.id;
        }

        return successResponse({
          related: {
            quoteId: sourceId,
            invoiceId,
            deliveryNoteId,
          },
        });
      } else {
        const invoice = await sql`
          SELECT quote_id, delivery_note_id FROM invoices WHERE id = ${sourceId}
        `;

        if (invoice.length === 0) {
          return errorResponse("NOT_FOUND", "Invoice not found");
        }

        return successResponse({
          related: {
            quoteId: invoice[0].quote_id,
            invoiceId: sourceId,
            deliveryNoteId: invoice[0].delivery_note_id,
          },
        });
      }
    } catch (error) {
      logger.error({ error, sourceId, sourceType }, "Failed to get workflow status");
      return errorResponse("INTERNAL_ERROR", "Failed to get workflow status");
    }
  }

  /**
   * Update quote status with automatic actions
   */
  async updateQuoteStatusWithWorkflow(
    quoteId: string,
    newStatus: "accepted" | "rejected" | "expired",
    userId: string,
    options: { autoConvert?: boolean; sendEmail?: boolean } = {}
  ): Promise<ApiResponse<{ quote: Quote; invoice?: Invoice }>> {
    try {
      // Update quote status
      await sql`
        UPDATE quotes SET status = ${newStatus}, updated_at = NOW()
        WHERE id = ${quoteId}
      `;

      const quoteResult = await sql`
        SELECT * FROM quotes WHERE id = ${quoteId}
      `;

      if (quoteResult.length === 0) {
        return errorResponse("NOT_FOUND", "Quote not found");
      }

      const quote = quoteResult[0] as Quote;
      let invoice: Invoice | undefined;

      // Auto-convert to invoice if accepted and autoConvert is true
      if (newStatus === "accepted" && options.autoConvert) {
        const convertResult = await this.convertQuoteToInvoice({
          quoteId,
          userId,
          sendEmail: options.sendEmail,
        });

        if (convertResult.success) {
          invoice = convertResult.data?.invoice;
        }
      }

      return successResponse({ quote, invoice });
    } catch (error) {
      logger.error({ error, quoteId, newStatus }, "Failed to update quote status");
      return errorResponse("INTERNAL_ERROR", "Failed to update quote status");
    }
  }
}

export const workflowService = new WorkflowService();
export default workflowService;
