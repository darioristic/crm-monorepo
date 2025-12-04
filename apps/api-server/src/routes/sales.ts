/**
 * Sales Routes - Quotes, Invoices, Delivery Notes
 */

import { errorResponse, successResponse } from "@crm/utils";
import { salesService } from "../services/sales.service";
import { RouteBuilder, withAuth, parseBody, parsePagination, parseFilters, json, applyCompanyIdFromHeader } from "./helpers";
import { invoiceQueries } from "../db/queries";
import { userQueries } from "../db/queries/users";
import { hasCompanyAccess } from "../db/queries/companies-members";
import { logger } from "../lib/logger";
import type {
  CreateQuoteRequest,
  UpdateQuoteRequest,
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
  CreateDeliveryNoteRequest,
  UpdateDeliveryNoteRequest,
} from "@crm/types";

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
    console.error("Error fetching invoice by token:", error);
    return json(errorResponse("DATABASE_ERROR", "Failed to fetch invoice"), 500);
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
    console.error("Error updating viewed_at:", error);
    return json(errorResponse("DATABASE_ERROR", "Failed to update invoice"), 500);
  }
});

// ============================================
// QUOTES
// ============================================

router.get("/api/v1/quotes", async (request, url) => {
  return withAuth(request, async (auth) => {
    const effectiveUrl = applyCompanyIdFromHeader(request, url);
    const pagination = parsePagination(effectiveUrl);
    const filters = parseFilters(effectiveUrl);
    
    // Check if companyId query parameter is provided (for admin to filter by company)
    const queryCompanyId = effectiveUrl.searchParams.get("companyId");
    
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
      // No query parameter - use user's current active company
      const userCompanyId = auth.companyId ?? (await userQueries.getUserCompanyId(auth.userId));
      
      if (auth.role === "tenant_admin" || auth.role === "superadmin") {
        companyId = userCompanyId;
      } else {
        // Regular users need an active company
        if (!userCompanyId) {
          return errorResponse("NOT_FOUND", "No active company found for user");
        }
        companyId = userCompanyId;
      }
    }
    
    return salesService.getQuotes(companyId, pagination, filters);
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
    async () => {
      const body = await parseBody<CreateQuoteRequest>(request);
      if (!body) {
        return errorResponse("VALIDATION_ERROR", "Invalid request body");
      }
      return salesService.createQuote(body);
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
      const effectiveUrl = applyCompanyIdFromHeader(request, url);
      const pagination = parsePagination(effectiveUrl);
      const filters = parseFilters(effectiveUrl);
      
      // Check if companyId query parameter is provided (for admin to filter by company)
      const queryCompanyId = effectiveUrl.searchParams.get("companyId");
      
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
        // No query parameter - use user's current active company
        const userCompanyId = auth.companyId ?? (await userQueries.getUserCompanyId(auth.userId));
        
        if (auth.role === "tenant_admin" || auth.role === "superadmin") {
          companyId = userCompanyId;
        } else {
          // Regular users need an active company
          if (!userCompanyId) {
            return errorResponse("NOT_FOUND", "No active company found for user");
          }
          companyId = userCompanyId;
        }
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
  return withAuth(request, async () => {
    return salesService.getInvoiceById(params.id);
  });
});

router.post("/api/v1/invoices", async (request) => {
  return withAuth(
    request,
    async (auth) => {
      const body = await parseBody<CreateInvoiceRequest>(request);
      if (!body) {
        return errorResponse("VALIDATION_ERROR", "Invalid request body");
      }
      return salesService.createInvoice({ ...body, createdBy: auth.userId });
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
    const effectiveUrl = applyCompanyIdFromHeader(request, url);
    const pagination = parsePagination(effectiveUrl);
    const filters = parseFilters(effectiveUrl);
    
    // Check if companyId query parameter is provided (for admin to filter by company)
    const queryCompanyId = effectiveUrl.searchParams.get("companyId");
    
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
      // No query parameter - use user's current active company
      const userCompanyId = auth.companyId ?? (await userQueries.getUserCompanyId(auth.userId));
      
      if (auth.role === "tenant_admin" || auth.role === "superadmin") {
        companyId = userCompanyId;
      } else {
        // Regular users need an active company
        if (!userCompanyId) {
          return errorResponse("NOT_FOUND", "No active company found for user");
        }
        companyId = userCompanyId;
      }
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
    async () => {
      const body = await parseBody<CreateDeliveryNoteRequest>(request);
      if (!body) {
        return errorResponse("VALIDATION_ERROR", "Invalid request body");
      }
      return salesService.createDeliveryNote(body);
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

export const salesRoutes = router.getRoutes();
