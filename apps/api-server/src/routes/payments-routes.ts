/**
 * Payment Routes
 */

import type {
  CreatePaymentRequest,
  PaymentMethod,
  PaymentStatus,
  UpdatePaymentRequest,
} from "@crm/types";
import { errorResponse } from "@crm/utils";
import { paymentsService } from "../services/payments.service";
import { parseBody, parsePagination, RouteBuilder, withAuth } from "./helpers";

const router = new RouteBuilder();

// ============================================
// List Payments
// ============================================

router.get("/api/v1/payments", async (request, url) => {
  return withAuth(request, async () => {
    const pagination = parsePagination(url);

    // Parse payment-specific filters
    const invoiceId = url.searchParams.get("invoiceId") || undefined;
    const status = url.searchParams.get("status") as PaymentStatus | undefined;
    const paymentMethod = url.searchParams.get("paymentMethod") as PaymentMethod | undefined;
    const dateFrom = url.searchParams.get("dateFrom") || undefined;
    const dateTo = url.searchParams.get("dateTo") || undefined;
    const recordedBy = url.searchParams.get("recordedBy") || undefined;

    return paymentsService.getPayments(pagination, {
      invoiceId,
      status,
      paymentMethod,
      dateFrom,
      dateTo,
      recordedBy,
    });
  });
});

// ============================================
// Get Payment Stats
// ============================================

router.get("/api/v1/payments/stats", async (request, url) => {
  return withAuth(request, async () => {
    const dateFrom = url.searchParams.get("dateFrom") || undefined;
    const dateTo = url.searchParams.get("dateTo") || undefined;
    return paymentsService.getPaymentStats({ dateFrom, dateTo });
  });
});

// ============================================
// Get Payment by ID
// ============================================

router.get("/api/v1/payments/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    return paymentsService.getPaymentById(params.id);
  });
});

// ============================================
// Get Payments by Invoice
// ============================================

router.get("/api/v1/invoices/:invoiceId/payments", async (request, _url, params) => {
  return withAuth(request, async () => {
    return paymentsService.getPaymentsByInvoice(params.invoiceId);
  });
});

// ============================================
// Get Invoice Payment Summary
// ============================================

router.get("/api/v1/invoices/:invoiceId/payment-summary", async (request, _url, params) => {
  return withAuth(request, async () => {
    return paymentsService.getInvoicePaymentSummary(params.invoiceId);
  });
});

// ============================================
// Create Payment
// ============================================

router.post("/api/v1/payments", async (request) => {
  return withAuth(
    request,
    async (auth) => {
      const body = await parseBody<CreatePaymentRequest>(request);
      if (!body) {
        return errorResponse("VALIDATION_ERROR", "Invalid request body");
      }
      return paymentsService.recordPayment(body, auth.userId);
    },
    201
  );
});

// ============================================
// Update Payment
// ============================================

router.put("/api/v1/payments/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    const body = await parseBody<UpdatePaymentRequest>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }
    return paymentsService.updatePayment(params.id, body);
  });
});

router.patch("/api/v1/payments/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    const body = await parseBody<UpdatePaymentRequest>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }
    return paymentsService.updatePayment(params.id, body);
  });
});

// ============================================
// Refund Payment
// ============================================

router.post("/api/v1/payments/:id/refund", async (request, _url, params) => {
  return withAuth(request, async () => {
    return paymentsService.refundPayment(params.id);
  });
});

// ============================================
// Delete Payment
// ============================================

router.delete("/api/v1/payments/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    return paymentsService.deletePayment(params.id);
  });
});

export const paymentRoutes = router.getRoutes();
