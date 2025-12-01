/**
 * Sales Routes - Quotes, Invoices, Delivery Notes
 */

import { errorResponse } from "@crm/utils";
import { salesService } from "../services/sales.service";
import { RouteBuilder, withAuth, parseBody, parsePagination, parseFilters } from "./helpers";
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
// QUOTES
// ============================================

router.get("/api/v1/quotes", async (request, url) => {
  return withAuth(request, async () => {
    const pagination = parsePagination(url);
    const filters = parseFilters(url);
    return salesService.getQuotes(pagination, filters);
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
  return withAuth(request, async () => {
    const pagination = parsePagination(url);
    const filters = parseFilters(url);
    return salesService.getInvoices(pagination, filters);
  });
});

router.get("/api/v1/invoices/overdue", async (request) => {
  return withAuth(request, async () => {
    return salesService.getOverdueInvoices();
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
  return withAuth(request, async () => {
    const pagination = parsePagination(url);
    const filters = parseFilters(url);
    return salesService.getDeliveryNotes(pagination, filters);
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
