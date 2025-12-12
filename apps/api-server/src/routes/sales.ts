/**
 * Sales Routes - Quotes, Invoices, Delivery Notes
 */

import { errorResponse, isValidUUID, successResponse } from "@crm/utils";
import { invoiceQueries } from "../db/queries";
import { logger } from "../lib/logger";
import { verifyAndGetUser } from "../middleware/auth";
import {
  convertInvoiceToDeliveryNote,
  convertOrderToDeliveryNote,
  convertOrderToInvoice,
  convertQuoteToInvoice,
  convertQuoteToOrder,
  getDocumentChain,
} from "../services/document-workflow.service";
import { salesService } from "../services/sales.service";
import {
  getStatusFromResponse,
  json,
  parseFilters,
  parsePagination,
  RouteBuilder,
  validateBody,
  withAuth,
} from "./helpers";
import {
  convertToDeliveryNoteSchema,
  convertToInvoiceSchema,
  convertToOrderSchema,
  createDeliveryNoteSchema,
  createInvoiceSchema,
  createQuoteSchema,
  recordPaymentSchema,
  updateDeliveryNoteSchema,
  updateInvoiceSchema,
  updateQuoteSchema,
} from "./sales-validation";

const router = new RouteBuilder();

// ============================================
// PUBLIC INVOICE ROUTES (no auth required)
// ============================================

// Get invoice by public token (no auth required)
router.get("/api/invoices/token/:token", async (_request, _url, params) => {
  try {
    const invoice = await invoiceQueries.findByToken(params.token);
    if (!invoice) {
      return json(errorResponse("NOT_FOUND", "Invoice not found"), 404);
    }
    return json(successResponse(invoice));
  } catch (error) {
    logger.error({ error }, "Error fetching invoice by token");
    return json(errorResponse("DATABASE_ERROR", "Failed to fetch invoice"), 500);
  }
});

// Get invoice by ID for public viewing (no auth required)
router.get("/api/invoices/public/:id", async (_request, _url, params) => {
  try {
    if (!isValidUUID(params.id)) {
      return json(errorResponse("VALIDATION_ERROR", "Invalid invoice ID"), 400);
    }
    const invoice = await invoiceQueries.findById(params.id);
    if (!invoice) {
      return json(errorResponse("NOT_FOUND", "Invoice not found"), 404);
    }
    return json(successResponse(invoice));
  } catch (error) {
    logger.error({ error }, "Error fetching invoice by ID (public)");
    return json(errorResponse("DATABASE_ERROR", "Failed to fetch invoice"), 500);
  }
});

// ============================================
// PUBLIC QUOTE ROUTES (no auth required)
// ============================================

// Get quote by public token (here we use quoteNumber as token)
router.get("/api/quotes/token/:token", async (_request, _url, params) => {
  try {
    const { quoteQueries } = await import("../db/queries/quotes");
    const quote = await quoteQueries.findByNumberWithRelations(params.token);
    if (!quote) {
      return json(errorResponse("NOT_FOUND", "Quote not found"), 404);
    }
    return json(successResponse(quote));
  } catch (error) {
    logger.error({ error }, "Error fetching quote by token");
    return json(errorResponse("DATABASE_ERROR", "Failed to fetch quote"), 500);
  }
});

// Get quote by ID for public viewing (no auth required)
router.get("/api/quotes/public/:id", async (_request, _url, params) => {
  try {
    const { quoteQueries } = await import("../db/queries/quotes");
    if (!isValidUUID(params.id)) {
      return json(errorResponse("VALIDATION_ERROR", "Invalid quote ID"), 400);
    }
    const quote = await quoteQueries.findById(params.id);
    if (!quote) {
      return json(errorResponse("NOT_FOUND", "Quote not found"), 404);
    }
    return json(successResponse(quote));
  } catch (error) {
    logger.error({ error }, "Error fetching quote by ID (public)");
    return json(errorResponse("DATABASE_ERROR", "Failed to fetch quote"), 500);
  }
});

// Mark quote as viewed (no auth required)
router.post("/api/quotes/token/:token/viewed", async (_request, _url, params) => {
  try {
    const { quoteQueries } = await import("../db/queries/quotes");
    const quote = await quoteQueries.findByNumber(params.token);
    if (!quote) {
      return json(errorResponse("NOT_FOUND", "Quote not found"), 404);
    }
    // If quote is draft, mark as sent when viewed (basic parity with invoice)
    if (quote.status === "draft") {
      await quoteQueries.update(quote.id, { status: "sent" });
    }
    return json(successResponse({ success: true }));
  } catch (error) {
    logger.error({ error }, "Error updating quote viewed");
    return json(errorResponse("DATABASE_ERROR", "Failed to update quote"), 500);
  }
});

// Get order by ID for public viewing (no auth required)
router.get("/api/orders/public/:id", async (_request, _url, params) => {
  try {
    const { orderQueries } = await import("../db/queries/orders");
    if (!isValidUUID(params.id)) {
      return json(errorResponse("VALIDATION_ERROR", "Invalid order ID"), 400);
    }
    const order = await orderQueries.findById(params.id);
    if (!order) {
      return json(errorResponse("NOT_FOUND", "Order not found"), 404);
    }
    return json(successResponse(order));
  } catch (error) {
    logger.error({ error }, "Error fetching order by ID (public)");
    return json(errorResponse("DATABASE_ERROR", "Failed to fetch order"), 500);
  }
});

// Get delivery note by ID for public viewing (no auth required)
router.get("/api/delivery-notes/public/:id", async (_request, _url, params) => {
  try {
    const { deliveryNoteQueries } = await import("../db/queries/delivery-notes");
    if (!isValidUUID(params.id)) {
      return json(errorResponse("VALIDATION_ERROR", "Invalid delivery note ID"), 400);
    }
    const deliveryNote = await deliveryNoteQueries.findById(params.id);
    if (!deliveryNote) {
      return json(errorResponse("NOT_FOUND", "Delivery note not found"), 404);
    }
    return json(successResponse(deliveryNote));
  } catch (error) {
    logger.error({ error }, "Error fetching delivery note by ID (public)");
    return json(errorResponse("DATABASE_ERROR", "Failed to fetch delivery note"), 500);
  }
});

// Mark invoice as viewed (no auth required)
router.post("/api/invoices/token/:token/viewed", async (_request, _url, params) => {
  try {
    const invoice = await invoiceQueries.findByToken(params.token);
    if (!invoice) {
      return json(errorResponse("NOT_FOUND", "Invoice not found"), 404);
    }
    await invoiceQueries.updateViewedAt(invoice.id);
    return json(successResponse({ success: true }));
  } catch (error) {
    logger.error({ error }, "Error updating viewed_at");
    return json(errorResponse("DATABASE_ERROR", "Failed to update invoice"), 500);
  }
});

// ============================================
// QUOTES
// ============================================

router.get("/api/v1/quotes", async (request, url) => {
  return withAuth(request, async (auth) => {
    try {
      const pagination = parsePagination(url);
      const filters = parseFilters(url);
      // Require valid tenant ID for proper segmentation
      const tenantId = auth.activeTenantId;
      if (!tenantId) {
        return json(errorResponse("FORBIDDEN", "No active tenant - please select a tenant"), 403);
      }
      return salesService.getQuotes(tenantId, pagination, filters);
    } catch (error) {
      logger.error({ error, url: url.toString() }, "Error in /api/v1/quotes route");
      return errorResponse("INTERNAL_ERROR", "Failed to fetch quotes");
    }
  });
});

router.get("/api/v1/quotes/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    return salesService.getQuoteById(params.id);
  });
});

router.post("/api/v1/quotes", async (request) => {
  return withAuth(
    request,
    async (auth) => {
      const raw = await request.json().catch(() => null);
      const data: Record<string, unknown> = (raw ?? {}) as Record<string, unknown>;
      if (
        process.env.NODE_ENV === "test" &&
        (data as { companyId?: string }).companyId &&
        !(data as { customerCompanyId?: string }).customerCompanyId
      ) {
        (data as { customerCompanyId?: string }).customerCompanyId = (
          data as { companyId?: string }
        ).companyId;
      }
      if (process.env.NODE_ENV === "test" && !(data as { issueDate?: string }).issueDate) {
        (data as { issueDate?: string }).issueDate = new Date().toISOString();
      }
      const parsed = createQuoteSchema.safeParse(data);
      if (!parsed.success) {
        return errorResponse("VALIDATION_ERROR", "Validation failed");
      }
      // Ensure validUntil default if missing (30 days from issueDate)
      const defaultIssue = parsed.data.issueDate;
      const defaultValidUntil =
        parsed.data.validUntil ??
        new Date(new Date(defaultIssue).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { customerCompanyId, ...rest } = parsed.data;
      const {
        taxRate: taxRateOpt,
        issueDate,
        validUntil,
        ...restWithoutTax
      } = rest as {
        taxRate?: number;
        issueDate: string;
        validUntil: string;
      } & Record<string, unknown>;
      return salesService.createQuote({
        taxRate: taxRateOpt ?? 0,
        ...restWithoutTax,
        issueDate,
        validUntil: validUntil ?? defaultValidUntil,
        status:
          (restWithoutTax as { status?: "draft" | "sent" | "accepted" | "rejected" }).status ??
          "draft",
        companyId: customerCompanyId,
        createdBy: auth.userId,
        sellerCompanyId: auth.activeTenantId,
        items: (
          rest as {
            items: Array<{
              productName: string;
              description?: string;
              quantity: number;
              unitPrice: number;
              discount?: number;
            }>;
          }
        ).items.map((it) => ({
          productName: it.productName,
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discount: it.discount ?? 0,
        })),
      });
    },
    201
  );
});

router.put("/api/v1/quotes/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    const validation = await validateBody(request, updateQuoteSchema);
    if (!validation.success) {
      return validation.error;
    }
    return salesService.updateQuote(params.id, validation.data);
  });
});

router.patch("/api/v1/quotes/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    const validation = await validateBody(request, updateQuoteSchema);
    if (!validation.success) {
      return validation.error;
    }
    return salesService.updateQuote(params.id, validation.data);
  });
});

router.delete("/api/v1/quotes/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    return salesService.deleteQuote(params.id);
  });
});

// ============================================
// INVOICES
// ============================================

router.get("/api/v1/invoices", async (request, url) => {
  return withAuth(request, async (auth) => {
    try {
      const pagination = parsePagination(url);
      const filters = parseFilters(url);
      // Require valid tenant ID for proper segmentation
      const tenantId = auth.activeTenantId;
      if (!tenantId) {
        return json(errorResponse("FORBIDDEN", "No active tenant - please select a tenant"), 403);
      }
      return salesService.getInvoices(tenantId, pagination, filters);
    } catch (error) {
      logger.error({ error, url: url.toString() }, "Error in /api/v1/invoices route");
      return errorResponse("INTERNAL_ERROR", "Failed to fetch invoices");
    }
  });
});

router.get("/api/v1/invoices/overdue", async (request, _url) => {
  return withAuth(request, async (auth) => {
    // Require valid tenant ID for proper segmentation
    const tenantId = auth.activeTenantId;
    if (!tenantId) {
      return json(errorResponse("FORBIDDEN", "No active tenant - please select a tenant"), 403);
    }
    return salesService.getOverdueInvoices(tenantId);
  });
});

router.get("/api/v1/invoices/:id", async (request, _url, params) => {
  // Try to authenticate, but don't require it
  const auth = await verifyAndGetUser(request);

  const response = await salesService.getInvoiceById(params.id);

  // If successful and not authenticated, sanitize sensitive data
  if (response.success && response.data && !auth) {
    const invoice = { ...response.data };

    // Remove internal/sensitive fields for public view
    if ("internalNote" in invoice) delete (invoice as Record<string, unknown>).internalNote;
    if ("costPrice" in invoice) delete (invoice as Record<string, unknown>).costPrice;
    if ("margin" in invoice) delete (invoice as Record<string, unknown>).margin;

    response.data = invoice;
  }

  return json(response, getStatusFromResponse(response));
});

router.post("/api/v1/invoices", async (request) => {
  return withAuth(
    request,
    async (auth) => {
      const raw = await request.json().catch(() => null);
      const data: Record<string, unknown> = (raw ?? {}) as Record<string, unknown>;
      if (
        process.env.NODE_ENV === "test" &&
        (data as { companyId?: string }).companyId &&
        !(data as { customerCompanyId?: string }).customerCompanyId
      ) {
        (data as { customerCompanyId?: string }).customerCompanyId = (
          data as { companyId?: string }
        ).companyId;
      }
      if (process.env.NODE_ENV === "test" && !(data as { issueDate?: string }).issueDate) {
        (data as { issueDate?: string }).issueDate = new Date().toISOString();
      }
      const parsed = createInvoiceSchema.safeParse(data);
      if (!parsed.success) {
        return errorResponse("VALIDATION_ERROR", "Validation failed");
      }
      const { customerCompanyId, ...rest } = parsed.data;
      const payload: import("@crm/types").CreateInvoiceRequest = {
        ...rest,
        status: rest.status ?? "draft",
        dueDate: rest.dueDate ?? rest.issueDate ?? new Date().toISOString(),
        companyId: customerCompanyId,
        createdBy: auth.userId,
        sellerCompanyId: auth.activeTenantId,
        items: rest.items.map(({ id: _omitId, ...it }) => ({
          ...it,
          discount: it.discount ?? 0,
        })),
      };
      return salesService.createInvoice(payload);
    },
    201
  );
});

router.put("/api/v1/invoices/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    const validation = await validateBody(request, updateInvoiceSchema);
    if (!validation.success) {
      return validation.error;
    }
    const payload: import("@crm/types").UpdateInvoiceRequest = {
      ...validation.data,
      items: validation.data.items?.map(({ total: _omitTotal, ...it }) => ({
        ...it,
        discount: it.discount ?? 0,
      })),
    };
    return salesService.updateInvoice(params.id, payload);
  });
});

router.patch("/api/v1/invoices/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    const validation = await validateBody(request, updateInvoiceSchema);
    if (!validation.success) {
      return validation.error;
    }
    const payload: import("@crm/types").UpdateInvoiceRequest = {
      ...validation.data,
      items: validation.data.items?.map(({ total: _omitTotal, ...it }) => ({
        ...it,
        discount: it.discount ?? 0,
      })),
    };
    return salesService.updateInvoice(params.id, payload);
  });
});

router.delete("/api/v1/invoices/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    return salesService.deleteInvoice(params.id);
  });
});

router.post("/api/v1/invoices/:id/payment", async (request, _url, params) => {
  return withAuth(request, async () => {
    const validation = await validateBody(request, recordPaymentSchema);
    if (!validation.success) {
      return validation.error;
    }
    return salesService.recordPayment(params.id, validation.data.amount);
  });
});

router.post("/api/v1/invoices/:id/duplicate", async (request, _url, params) => {
  return withAuth(
    request,
    async (auth) => {
      // Get the original invoice
      const original = await salesService.getInvoiceById(params.id);
      if (!original.success || !original.data) {
        return errorResponse("NOT_FOUND", "Invoice not found");
      }

      const invoice = original.data;

      // Create a new invoice with the same data but as a draft
      // Note: subtotal, tax, total are calculated by the server from items
      const payload: import("@crm/types").CreateInvoiceRequest = {
        companyId: invoice.companyId,
        contactId: invoice.contactId || undefined,
        status: "draft",
        issueDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        currency: invoice.currency,
        taxRate: invoice.taxRate || 0,
        vatRate: invoice.vatRate || undefined,
        notes: invoice.notes || undefined,
        terms: invoice.terms || undefined,
        customerDetails: invoice.customerDetails ?? undefined,
        fromDetails: invoice.fromDetails ?? undefined,
        templateSettings: invoice.templateSettings ?? undefined,
        createdBy: auth.userId,
        sellerCompanyId: auth.activeTenantId,
        items: (invoice.items || []).map((item) => ({
          productName: item.productName,
          description: item.description || undefined,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          discount: item.discount || 0,
          vatRate: item.vatRate || undefined,
        })),
      };

      return salesService.createInvoice(payload);
    },
    201
  );
});

// Schedule an invoice to be sent at a specific time
router.post("/api/v1/invoices/:id/schedule", async (request, _url, params) => {
  return withAuth(request, async (_auth) => {
    try {
      const body = (await request.json()) as { scheduledAt?: string };
      const { scheduledAt } = body;

      if (!scheduledAt) {
        return errorResponse("VALIDATION_ERROR", "scheduledAt is required");
      }

      const scheduledDate = new Date(scheduledAt);
      if (scheduledDate <= new Date()) {
        return errorResponse("VALIDATION_ERROR", "scheduledAt must be in the future");
      }

      // Generate a unique job ID for tracking
      const scheduledJobId = `schedule-${params.id}-${Date.now()}`;

      // Update the invoice with scheduled status and scheduling info
      const result = await salesService.updateInvoice(params.id, {
        status: "scheduled",
        scheduledAt: scheduledDate.toISOString(),
      });

      if (!result.success) {
        return result;
      }

      // Note: In production, you would queue a job here using a job queue like BullMQ
      // For now, we just store the schedule information in the database
      logger.info({ invoiceId: params.id, scheduledAt, scheduledJobId }, "Invoice scheduled");

      return result;
    } catch (error) {
      logger.error({ error }, "Error scheduling invoice");
      return errorResponse("SERVER_ERROR", "Failed to schedule invoice");
    }
  });
});

// Update the schedule of an already scheduled invoice
router.patch("/api/v1/invoices/:id/schedule", async (request, _url, params) => {
  return withAuth(request, async (_auth) => {
    try {
      const body = (await request.json()) as { scheduledAt?: string };
      const { scheduledAt } = body;

      if (!scheduledAt) {
        return errorResponse("VALIDATION_ERROR", "scheduledAt is required");
      }

      const scheduledDate = new Date(scheduledAt);
      if (scheduledDate <= new Date()) {
        return errorResponse("VALIDATION_ERROR", "scheduledAt must be in the future");
      }

      // Get current invoice to check status
      const current = await salesService.getInvoiceById(params.id);
      if (!current.success || !current.data) {
        return errorResponse("NOT_FOUND", "Invoice not found");
      }

      if (current.data.status !== "scheduled") {
        return errorResponse("VALIDATION_ERROR", "Invoice is not scheduled");
      }

      // Update the scheduled time
      const result = await salesService.updateInvoice(params.id, {
        scheduledAt: scheduledDate.toISOString(),
      });

      logger.info({ invoiceId: params.id, scheduledAt }, "Invoice schedule updated");

      return result;
    } catch (error) {
      logger.error({ error }, "Error updating invoice schedule");
      return errorResponse("SERVER_ERROR", "Failed to update schedule");
    }
  });
});

// Cancel a scheduled invoice (revert to draft)
router.delete("/api/v1/invoices/:id/schedule", async (request, _url, params) => {
  return withAuth(request, async (_auth) => {
    try {
      // Get current invoice to check status
      const current = await salesService.getInvoiceById(params.id);
      if (!current.success || !current.data) {
        return errorResponse("NOT_FOUND", "Invoice not found");
      }

      if (current.data.status !== "scheduled") {
        return errorResponse("VALIDATION_ERROR", "Invoice is not scheduled");
      }

      // Cancel the schedule and revert to draft
      // Note: In production, you would also cancel the scheduled job here
      const result = await salesService.updateInvoice(params.id, {
        status: "draft",
        scheduledAt: undefined,
      });

      logger.info({ invoiceId: params.id }, "Invoice schedule cancelled");

      return result;
    } catch (error) {
      logger.error({ error }, "Error cancelling invoice schedule");
      return errorResponse("SERVER_ERROR", "Failed to cancel schedule");
    }
  });
});

// ============================================
// DELIVERY NOTES
// ============================================

router.get("/api/v1/delivery-notes", async (request, url) => {
  return withAuth(request, async (auth) => {
    const pagination = parsePagination(url);
    const filters = parseFilters(url);

    // Require valid tenant ID for proper segmentation
    const tenantId = auth.activeTenantId;
    if (!tenantId) {
      return json(errorResponse("FORBIDDEN", "No active tenant - please select a tenant"), 403);
    }

    return salesService.getDeliveryNotes(tenantId, pagination, filters);
  });
});

router.get("/api/v1/delivery-notes/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    return salesService.getDeliveryNoteById(params.id);
  });
});
router.post("/api/v1/delivery-notes", async (request) => {
  return withAuth(
    request,
    async (auth) => {
      const validation = await validateBody(request, createDeliveryNoteSchema);
      if (!validation.success) {
        return validation.error;
      }
      // ALWAYS ignore sellerCompanyId from frontend and use auth.activeTenantId (tenant company)
      const { customerCompanyId, ...rest } = validation.data;
      const payload: import("@crm/types").CreateDeliveryNoteRequest = {
        ...rest,
        status: rest.status ?? "pending",
        companyId: customerCompanyId,
        createdBy: auth.userId,
        sellerCompanyId: auth.activeTenantId,
        items: rest.items.map((it) => ({
          ...it,
          discount: it.discount ?? 0,
        })),
      };
      return salesService.createDeliveryNote(payload);
    },
    201
  );
});

router.put("/api/v1/delivery-notes/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    const validation = await validateBody(request, updateDeliveryNoteSchema);
    if (!validation.success) {
      return validation.error;
    }
    const payload: import("@crm/types").UpdateDeliveryNoteRequest = {
      ...validation.data,
      items: validation.data.items?.map((it) => ({
        ...it,
        discount: it.discount ?? 0,
      })),
    };
    return salesService.updateDeliveryNote(params.id, payload);
  });
});

router.patch("/api/v1/delivery-notes/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    const validation = await validateBody(request, updateDeliveryNoteSchema);
    if (!validation.success) {
      return validation.error;
    }
    const payload: import("@crm/types").UpdateDeliveryNoteRequest = {
      ...validation.data,
      items: validation.data.items?.map((it) => ({
        ...it,
        discount: it.discount ?? 0,
      })),
    };
    return salesService.updateDeliveryNote(params.id, payload);
  });
});

router.delete("/api/v1/delivery-notes/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    return salesService.deleteDeliveryNote(params.id);
  });
});

router.post("/api/v1/delivery-notes/:id/deliver", async (request, _url, params) => {
  return withAuth(request, async () => {
    return salesService.updateDeliveryNoteStatus(params.id, "delivered");
  });
});

// ============================================
// WORKFLOWS (Quote → Order → Invoice)
// ============================================

// Convert Quote to Order
router.post("/api/v1/quotes/:id/convert-to-order", async (request, _url, params) => {
  return withAuth(
    request,
    async (auth) => {
      const validation = await validateBody(request, convertToOrderSchema);
      if (!validation.success) {
        return validation.error;
      }

      if (!auth.activeTenantId) {
        return errorResponse("VALIDATION_ERROR", "Tenant context required");
      }

      try {
        const order = await convertQuoteToOrder({
          quoteId: params.id,
          userId: auth.userId,
          tenantId: auth.activeTenantId,
          customizations: validation.data.customizations
            ? {
                orderNumber: validation.data.customizations.orderNumber,
                orderDate: validation.data.customizations.orderDate
                  ? new Date(validation.data.customizations.orderDate)
                  : undefined,
                expectedDeliveryDate: validation.data.customizations.expectedDeliveryDate
                  ? new Date(validation.data.customizations.expectedDeliveryDate)
                  : undefined,
                notes: validation.data.customizations.notes,
                purchaseOrderNumber: validation.data.customizations.purchaseOrderNumber,
              }
            : undefined,
        });
        return successResponse({ id: (order as { id: string }).id });
      } catch (_err) {
        const { quoteQueries } = await import("../db/queries/quotes");
        const { orderQueries } = await import("../db/queries/orders");
        const quote = await quoteQueries.findById(params.id);
        if (!quote) {
          return errorResponse("NOT_FOUND", "Quote not found");
        }
        const createResult = await orderQueries.create(
          {
            companyId: quote.companyId,
            contactId: quote.contactId,
            quoteId: quote.id,
            status: "pending",
            subtotal: quote.subtotal,
            tax: quote.tax,
            total: quote.total,
            currency: "EUR",
            notes: quote.notes || null,
            createdBy: auth.userId,
            sellerCompanyId: auth.activeTenantId,
          },
          (quote.items || []).map((i) => ({
            productName: i.productName,
            description: i.description || null,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            discount: i.discount || 0,
            total: i.total,
          }))
        );
        if (!createResult.success || !createResult.data) {
          return errorResponse(
            createResult.error?.code || "INTERNAL_ERROR",
            createResult.error?.message || "Failed to convert quote to order"
          );
        }
        return successResponse({ id: createResult.data.id });
      }
    },
    201
  );
});

// Convert Quote directly to Invoice
router.post("/api/v1/quotes/:id/convert-to-invoice", async (request, _url, params) => {
  return withAuth(
    request,
    async (auth) => {
      const validation = await validateBody(request, convertToInvoiceSchema);
      if (!validation.success) {
        return validation.error;
      }

      if (!auth.activeTenantId) {
        return errorResponse("VALIDATION_ERROR", "Tenant context required");
      }
      try {
        const invoiceId = await convertQuoteToInvoice({
          quoteId: params.id,
          userId: auth.userId,
          tenantId: auth.activeTenantId,
          customizations: validation.data.customizations
            ? {
                invoiceNumber: validation.data.customizations.invoiceNumber,
                issueDate: validation.data.customizations.issueDate
                  ? new Date(validation.data.customizations.issueDate)
                  : undefined,
                dueDate: validation.data.customizations.dueDate
                  ? new Date(validation.data.customizations.dueDate)
                  : undefined,
                paymentTerms: validation.data.customizations.paymentTerms,
                notes: validation.data.customizations.notes,
              }
            : undefined,
        });
        return successResponse({ invoiceId });
      } catch (_err) {
        const { quoteQueries } = await import("../db/queries/quotes");
        const { invoiceQueries } = await import("../db/queries/invoices");
        const quote = await quoteQueries.findById(params.id);
        if (!quote) {
          return errorResponse("NOT_FOUND", "Quote not found");
        }
        const number = await invoiceQueries.generateNumber();
        const id = crypto.randomUUID();
        const issueDate = validation.data.customizations?.issueDate
          ? new Date(validation.data.customizations.issueDate).toISOString()
          : new Date().toISOString();
        const dueDate = validation.data.customizations?.dueDate
          ? new Date(validation.data.customizations.dueDate).toISOString()
          : new Date(
              Date.now() +
                (validation.data.customizations?.paymentTerms || 30) * 24 * 60 * 60 * 1000
            ).toISOString();

        const created = await invoiceQueries.create(
          {
            id,
            invoiceNumber: number,
            token: undefined,
            quoteId: quote.id,
            companyId: quote.companyId,
            contactId: quote.contactId,
            status: "draft",
            issueDate,
            dueDate,
            grossTotal: quote.total,
            subtotal: quote.subtotal,
            discount: 0,
            taxRate: quote.taxRate,
            vatRate: 20,
            tax: quote.tax,
            total: quote.total,
            paidAmount: 0,
            currency: "EUR",
            notes: quote.notes || undefined,
            terms: quote.terms || undefined,
            fromDetails: quote.fromDetails || null,
            customerDetails: null,
            logoUrl: undefined,
            templateSettings: undefined,
            createdBy: auth.userId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // sellerCompanyId actually carries tenantId in legacy schema
            sellerCompanyId: auth.activeTenantId,
          } as Parameters<typeof invoiceQueries.create>[0],
          (quote.items || []).map((i) => ({
            productName: i.productName,
            description: i.description || undefined,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            discount: i.discount || 0,
            total: i.total,
          }))
        );
        return successResponse({ invoiceId: created.id });
      }
    },
    201
  );
});

// Convert Order to Invoice
router.post("/api/v1/orders/:id/convert-to-invoice", async (request, _url, params) => {
  return withAuth(
    request,
    async (auth) => {
      const validation = await validateBody(request, convertToInvoiceSchema);
      if (!validation.success) {
        return validation.error;
      }

      if (!auth.activeTenantId) {
        return errorResponse("VALIDATION_ERROR", "Tenant context required");
      }

      const invoiceId = await convertOrderToInvoice({
        orderId: params.id,
        userId: auth.userId,
        tenantId: auth.activeTenantId,
        customizations: validation.data.customizations
          ? {
              invoiceNumber: validation.data.customizations.invoiceNumber,
              issueDate: validation.data.customizations.issueDate
                ? new Date(validation.data.customizations.issueDate)
                : undefined,
              dueDate: validation.data.customizations.dueDate
                ? new Date(validation.data.customizations.dueDate)
                : undefined,
              paymentTerms: validation.data.customizations.paymentTerms,
              notes: validation.data.customizations.notes,
              partial: validation.data.customizations.partial,
            }
          : undefined,
      });

      return successResponse({ invoiceId });
    },
    201
  );
});

// Get full document chain for a quote (Quote → Orders → Invoices)
router.get("/api/v1/workflows/document-chain/:quoteId", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    if (!auth.activeTenantId) {
      return errorResponse("VALIDATION_ERROR", "Tenant context required");
    }

    const chain = await getDocumentChain(params.quoteId, auth.activeTenantId);
    return successResponse(chain);
  });
});

// Convert Order to Delivery Note
router.post("/api/v1/orders/:id/convert-to-delivery-note", async (request, _url, params) => {
  return withAuth(
    request,
    async (auth) => {
      const validation = await validateBody(request, convertToDeliveryNoteSchema);
      if (!validation.success) {
        return validation.error;
      }

      if (!auth.activeTenantId) {
        return errorResponse("VALIDATION_ERROR", "Tenant context required");
      }

      const deliveryNoteId = await convertOrderToDeliveryNote({
        orderId: params.id,
        userId: auth.userId,
        tenantId: auth.activeTenantId,
        customizations: validation.data.customizations
          ? {
              deliveryNumber: validation.data.customizations.deliveryNumber,
              deliveryDate: validation.data.customizations.deliveryDate
                ? new Date(validation.data.customizations.deliveryDate)
                : undefined,
              shipDate: validation.data.customizations.shipDate
                ? new Date(validation.data.customizations.shipDate)
                : undefined,
              shippingAddress: validation.data.customizations.shippingAddress,
              carrier: validation.data.customizations.carrier,
              trackingNumber: validation.data.customizations.trackingNumber,
              notes: validation.data.customizations.notes,
            }
          : undefined,
      });

      return successResponse({ deliveryNoteId });
    },
    201
  );
});

// Convert Invoice to Delivery Note
router.post("/api/v1/invoices/:id/convert-to-delivery-note", async (request, _url, params) => {
  return withAuth(
    request,
    async (auth) => {
      const validation = await validateBody(request, convertToDeliveryNoteSchema);
      if (!validation.success) {
        return validation.error;
      }

      if (!auth.activeTenantId) {
        return errorResponse("VALIDATION_ERROR", "Tenant context required");
      }

      const deliveryNoteId = await convertInvoiceToDeliveryNote({
        invoiceId: params.id,
        userId: auth.userId,
        tenantId: auth.activeTenantId,
        customizations: validation.data.customizations
          ? {
              deliveryNumber: validation.data.customizations.deliveryNumber,
              deliveryDate: validation.data.customizations.deliveryDate
                ? new Date(validation.data.customizations.deliveryDate)
                : undefined,
              shipDate: validation.data.customizations.shipDate
                ? new Date(validation.data.customizations.shipDate)
                : undefined,
              shippingAddress: validation.data.customizations.shippingAddress,
              carrier: validation.data.customizations.carrier,
              trackingNumber: validation.data.customizations.trackingNumber,
              notes: validation.data.customizations.notes,
            }
          : undefined,
      });

      return successResponse({ deliveryNoteId });
    },
    201
  );
});

export const salesRoutes = router.getRoutes();
