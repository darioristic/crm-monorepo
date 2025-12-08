/**
 * Sales Routes - Quotes, Invoices, Delivery Notes
 */

import type {
  CreateDeliveryNoteRequest,
  CreateInvoiceRequest,
  CreateQuoteRequest,
  UpdateDeliveryNoteRequest,
  UpdateInvoiceRequest,
  UpdateQuoteRequest,
} from "@crm/types";
import { errorResponse, isValidUUID, successResponse } from "@crm/utils";
import { invoiceQueries } from "../db/queries";
import { hasCompanyAccess } from "../db/queries/companies-members";
import { userQueries } from "../db/queries/users";
import { logger } from "../lib/logger";
import { verifyAndGetUser } from "../middleware/auth";
import {
  convertOrderToInvoice,
  convertQuoteToInvoice,
  convertQuoteToOrder,
  getDocumentChain,
} from "../services/document-workflow.service";
import { salesService } from "../services/sales.service";
import {
  applyCompanyIdFromHeader,
  getStatusFromResponse,
  json,
  parseBody,
  parseFilters,
  parsePagination,
  RouteBuilder,
  withAuth,
} from "./helpers";

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

      // Check if companyId query parameter is provided (for admin to filter by company)
      const queryCompanyId = url.searchParams.get("companyId");

      if (queryCompanyId && !isValidUUID(queryCompanyId)) {
        return errorResponse("VALIDATION_ERROR", "Invalid companyId format");
      }

      let companyId: string | null = null;

      if (queryCompanyId) {
        // If companyId is provided in query, verify user has access
        if (auth.role === "tenant_admin" || auth.role === "superadmin") {
          // Admin can access any company (they should be added to all via users_on_company)
          companyId = queryCompanyId;
        } else {
          // Regular users can only access companies they're members of
          const hasAccess = await hasCompanyAccess(queryCompanyId, auth.userId);
          if (!hasAccess) {
            return errorResponse("FORBIDDEN", "Not a member of this company");
          }
          companyId = queryCompanyId;
        }
      } else {
        // No company filter provided -> default to showing documents created by current user
        filters.createdBy = auth.userId;
        companyId = null;
      }

      return salesService.getQuotes(companyId, pagination, filters);
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
      const body = await parseBody<CreateQuoteRequest>(request);
      if (!body) {
        return errorResponse("VALIDATION_ERROR", "Invalid request body");
      }
      return salesService.createQuote({
        ...body,
        createdBy: auth.userId,
        sellerCompanyId: auth.companyId,
      });
    },
    201
  );
});

router.put("/api/v1/quotes/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    const body = await parseBody<UpdateQuoteRequest>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }
    return salesService.updateQuote(params.id, body);
  });
});

router.patch("/api/v1/quotes/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    const body = await parseBody<UpdateQuoteRequest>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }
    return salesService.updateQuote(params.id, body);
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

      // Check if companyId query parameter is provided (for admin to filter by company)
      const queryCompanyId = url.searchParams.get("companyId");

      if (queryCompanyId && !isValidUUID(queryCompanyId)) {
        return errorResponse("VALIDATION_ERROR", "Invalid companyId format");
      }

      let companyId: string | null = null;

      if (queryCompanyId) {
        // If companyId is provided in query, verify user has access
        if (auth.role === "tenant_admin" || auth.role === "superadmin") {
          // Admin can access any company (they should be added to all via users_on_company)
          companyId = queryCompanyId;
        } else {
          // Regular users can only access companies they're members of
          const hasAccess = await hasCompanyAccess(queryCompanyId, auth.userId);
          if (!hasAccess) {
            return errorResponse("FORBIDDEN", "Not a member of this company");
          }
          companyId = queryCompanyId;
        }
      } else {
        // Default to user's own documents when no company filter
        filters.createdBy = auth.userId;
        companyId = null;
      }

      return salesService.getInvoices(companyId, pagination, filters);
    } catch (error) {
      logger.error({ error, url: url.toString() }, "Error in /api/v1/invoices route");
      return errorResponse("INTERNAL_ERROR", "Failed to fetch invoices");
    }
  });
});

router.get("/api/v1/invoices/overdue", async (request, url) => {
  return withAuth(request, async (auth) => {
    // Check if companyId query parameter is provided (for admin to filter by company)
    const effectiveUrl = applyCompanyIdFromHeader(request, url);
    const queryCompanyId = effectiveUrl.searchParams.get("companyId");

    if (queryCompanyId && !isValidUUID(queryCompanyId)) {
      return errorResponse("VALIDATION_ERROR", "Invalid companyId format");
    }

    let companyId: string | null = null;

    if (queryCompanyId) {
      // If companyId is provided in query, verify user has access
      if (auth.role === "tenant_admin" || auth.role === "superadmin") {
        companyId = queryCompanyId;
      } else {
        const hasAccess = await hasCompanyAccess(queryCompanyId, auth.userId);
        if (!hasAccess) {
          return errorResponse("FORBIDDEN", "Not a member of this company");
        }
        companyId = queryCompanyId;
      }
    } else {
      // No query parameter - use user's current active company
      const userCompanyId = auth.companyId ?? (await userQueries.getUserCompanyId(auth.userId));

      if (auth.role === "tenant_admin" || auth.role === "superadmin") {
        companyId = userCompanyId;
      } else {
        if (!userCompanyId) {
          return errorResponse("NOT_FOUND", "No active company found for user");
        }
        companyId = userCompanyId;
      }
    }

    return salesService.getOverdueInvoices(companyId);
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
    if ("internalNote" in invoice) delete (invoice as any).internalNote;
    if ("costPrice" in invoice) delete (invoice as any).costPrice;
    if ("margin" in invoice) delete (invoice as any).margin;

    response.data = invoice;
  }

  return json(response, getStatusFromResponse(response));
});

router.post("/api/v1/invoices", async (request) => {
  return withAuth(
    request,
    async (auth) => {
      const body = await parseBody<CreateInvoiceRequest>(request);
      if (!body) {
        return errorResponse("VALIDATION_ERROR", "Invalid request body");
      }
      return salesService.createInvoice({
        ...body,
        createdBy: auth.userId,
        sellerCompanyId: auth.companyId,
      });
    },
    201
  );
});

router.put("/api/v1/invoices/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    const body = await parseBody<UpdateInvoiceRequest>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }
    return salesService.updateInvoice(params.id, body);
  });
});

router.patch("/api/v1/invoices/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    const body = await parseBody<UpdateInvoiceRequest>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }
    return salesService.updateInvoice(params.id, body);
  });
});

router.delete("/api/v1/invoices/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    return salesService.deleteInvoice(params.id);
  });
});

router.post("/api/v1/invoices/:id/payment", async (request, _url, params) => {
  return withAuth(request, async () => {
    const body = await parseBody<{ amount: number }>(request);
    if (!body || typeof body.amount !== "number") {
      return errorResponse("VALIDATION_ERROR", "Amount is required");
    }
    return salesService.recordPayment(params.id, body.amount);
  });
});

// ============================================
// DELIVERY NOTES
// ============================================

router.get("/api/v1/delivery-notes", async (request, url) => {
  return withAuth(request, async (auth) => {
    const pagination = parsePagination(url);
    const filters = parseFilters(url);

    // Check if companyId query parameter is provided (for admin to filter by company)
    const queryCompanyId = url.searchParams.get("companyId");

    if (queryCompanyId && !isValidUUID(queryCompanyId)) {
      return errorResponse("VALIDATION_ERROR", "Invalid companyId format");
    }

    let companyId: string | null = null;

    if (queryCompanyId) {
      // If companyId is provided in query, verify user has access
      if (auth.role === "tenant_admin" || auth.role === "superadmin") {
        // Admin can access any company (they should be added to all via users_on_company)
        companyId = queryCompanyId;
      } else {
        // Regular users can only access companies they're members of
        const hasAccess = await hasCompanyAccess(queryCompanyId, auth.userId);
        if (!hasAccess) {
          return errorResponse("FORBIDDEN", "Not a member of this company");
        }
        companyId = queryCompanyId;
      }
    } else {
      // Default to user's own documents when no company filter
      filters.createdBy = auth.userId;
      companyId = null;
    }

    return salesService.getDeliveryNotes(companyId, pagination, filters);
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
      const body = await parseBody<CreateDeliveryNoteRequest>(request);
      if (!body) {
        return errorResponse("VALIDATION_ERROR", "Invalid request body");
      }
      return salesService.createDeliveryNote({
        ...body,
        createdBy: auth.userId,
        sellerCompanyId: auth.companyId,
      });
    },
    201
  );
});

router.put("/api/v1/delivery-notes/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    const body = await parseBody<UpdateDeliveryNoteRequest>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }
    return salesService.updateDeliveryNote(params.id, body);
  });
});

router.patch("/api/v1/delivery-notes/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    const body = await parseBody<UpdateDeliveryNoteRequest>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }
    return salesService.updateDeliveryNote(params.id, body);
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
      const body = await parseBody<{
        customizations?: {
          orderNumber?: string;
          orderDate?: string;
          expectedDeliveryDate?: string;
          notes?: string;
          purchaseOrderNumber?: string;
        };
      }>(request);

      if (!auth.tenantId) {
        return errorResponse("VALIDATION_ERROR", "Tenant context required");
      }

      const order = await convertQuoteToOrder({
        quoteId: params.id,
        userId: auth.userId,
        tenantId: auth.tenantId,
        customizations: body?.customizations
          ? {
              orderNumber: body.customizations.orderNumber,
              orderDate: body.customizations.orderDate
                ? new Date(body.customizations.orderDate)
                : undefined,
              expectedDeliveryDate: body.customizations.expectedDeliveryDate
                ? new Date(body.customizations.expectedDeliveryDate)
                : undefined,
              notes: body.customizations.notes,
              purchaseOrderNumber: body.customizations.purchaseOrderNumber,
            }
          : undefined,
      });

      return successResponse(order);
    },
    201
  );
});

// Convert Quote directly to Invoice
router.post("/api/v1/quotes/:id/convert-to-invoice", async (request, _url, params) => {
  return withAuth(
    request,
    async (auth) => {
      const body = await parseBody<{
        customizations?: {
          invoiceNumber?: string;
          issueDate?: string;
          dueDate?: string;
          paymentTerms?: number;
          notes?: string;
        };
      }>(request);

      if (!auth.tenantId) {
        return errorResponse("VALIDATION_ERROR", "Tenant context required");
      }

      const invoiceId = await convertQuoteToInvoice({
        quoteId: params.id,
        userId: auth.userId,
        tenantId: auth.tenantId,
        customizations: body?.customizations
          ? {
              invoiceNumber: body.customizations.invoiceNumber,
              issueDate: body.customizations.issueDate
                ? new Date(body.customizations.issueDate)
                : undefined,
              dueDate: body.customizations.dueDate
                ? new Date(body.customizations.dueDate)
                : undefined,
              paymentTerms: body.customizations.paymentTerms,
              notes: body.customizations.notes,
            }
          : undefined,
      });

      return successResponse({ invoiceId });
    },
    201
  );
});

// Convert Order to Invoice
router.post("/api/v1/orders/:id/convert-to-invoice", async (request, _url, params) => {
  return withAuth(
    request,
    async (auth) => {
      const body = await parseBody<{
        customizations?: {
          invoiceNumber?: string;
          issueDate?: string;
          dueDate?: string;
          paymentTerms?: number;
          notes?: string;
          partial?: { percentage?: number; amount?: string };
        };
      }>(request);

      if (!auth.tenantId) {
        return errorResponse("VALIDATION_ERROR", "Tenant context required");
      }

      const invoiceId = await convertOrderToInvoice({
        orderId: params.id,
        userId: auth.userId,
        tenantId: auth.tenantId,
        customizations: body?.customizations
          ? {
              invoiceNumber: body.customizations.invoiceNumber,
              issueDate: body.customizations.issueDate
                ? new Date(body.customizations.issueDate)
                : undefined,
              dueDate: body.customizations.dueDate
                ? new Date(body.customizations.dueDate)
                : undefined,
              paymentTerms: body.customizations.paymentTerms,
              notes: body.customizations.notes,
              partial: body.customizations.partial,
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
    if (!auth.tenantId) {
      return errorResponse("VALIDATION_ERROR", "Tenant context required");
    }

    const chain = await getDocumentChain(params.quoteId, auth.tenantId);
    return successResponse(chain);
  });
});

export const salesRoutes = router.getRoutes();
