/**
 * Workflow Routes - Quote→Invoice→Delivery automation
 */

import { errorResponse } from "@crm/utils";
import { workflowService } from "../services/workflow.service";
import { emailService } from "../services/email.service";
import { 
  RouteBuilder, 
  withAuth, 
  parseBody,
  json,
} from "./helpers";
import type { AuthContext } from "../middleware/auth";
import { z } from "zod";

const router = new RouteBuilder();

// ============================================
// Schemas
// ============================================

const convertQuoteToInvoiceSchema = z.object({
  sendEmail: z.boolean().optional().default(false),
  invoiceOverrides: z.object({
    dueDate: z.string().datetime().optional(),
    notes: z.string().max(2000).optional(),
    paymentTerms: z.string().max(500).optional(),
  }).optional(),
});

const convertInvoiceToDeliverySchema = z.object({
  shippingAddress: z.string().max(500).optional(),
  deliveryNotes: z.string().max(2000).optional(),
});

const fullSalesCycleSchema = z.object({
  sendInvoiceEmail: z.boolean().optional().default(false),
  createDeliveryNote: z.boolean().optional().default(true),
  shippingAddress: z.string().max(500).optional(),
});

const updateQuoteStatusSchema = z.object({
  status: z.enum(["accepted", "rejected", "expired"]),
  autoConvert: z.boolean().optional().default(false),
  sendEmail: z.boolean().optional().default(false),
});

const sendEmailSchema = z.object({
  recipientEmail: z.string().email().optional(),
});

// ============================================
// Workflow Routes
// ============================================

// Local helpers for validation/auth wrappers
function validateUuidParam(id: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(id);
}

async function withValidatedAuth<T, S extends z.ZodTypeAny>(
  request: Request,
  schema: S,
  handler: (data: z.infer<S>, auth: AuthContext) => Promise<import("@crm/types").ApiResponse<T>>,
  statusOnSuccess: number = 200,
): Promise<Response> {
  return withAuth(request, async (auth) => {
    const body = await parseBody<unknown>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }
    return handler(parsed.data, auth);
  }, statusOnSuccess);
}

async function withAuthAndUuidValidation<T>(
  request: Request,
  id: string,
  label: string,
  handler: () => Promise<import("@crm/types").ApiResponse<T>>,
  statusOnSuccess: number = 200,
): Promise<Response> {
  if (!validateUuidParam(id)) {
    return json(errorResponse("VALIDATION_ERROR", `Invalid ${label} format`), 400);
  }
  return withAuth(request, async () => handler(), statusOnSuccess);
}

// Convert Quote to Invoice
router.post("/api/v1/workflow/quote/:quoteId/convert-to-invoice", async (request, _url, params) => {
  if (!validateUuidParam(params.quoteId)) {
    return json(errorResponse("VALIDATION_ERROR", "Invalid quote ID format"), 400);
  }
  
  return withValidatedAuth(
    request,
    convertQuoteToInvoiceSchema,
    async (data: z.infer<typeof convertQuoteToInvoiceSchema>, auth: AuthContext) => {
      return workflowService.convertQuoteToInvoice({
        quoteId: params.quoteId,
        userId: auth.userId,
        sendEmail: data.sendEmail,
        invoiceOverrides: data.invoiceOverrides,
      });
    },
    201
  );
});

// Convert Invoice to Delivery Note
router.post("/api/v1/workflow/invoice/:invoiceId/convert-to-delivery", async (request, _url, params) => {
  if (!validateUuidParam(params.invoiceId)) {
    return json(errorResponse("VALIDATION_ERROR", "Invalid invoice ID format"), 400);
  }
  
  return withValidatedAuth(
    request,
    convertInvoiceToDeliverySchema,
    async (data: z.infer<typeof convertInvoiceToDeliverySchema>, auth: AuthContext) => {
      return workflowService.convertInvoiceToDeliveryNote({
        invoiceId: params.invoiceId,
        userId: auth.userId,
        shippingAddress: data.shippingAddress,
        deliveryNotes: data.deliveryNotes,
      });
    },
    201
  );
});

// Full Sales Cycle
router.post("/api/v1/workflow/quote/:quoteId/full-cycle", async (request, _url, params) => {
  if (!validateUuidParam(params.quoteId)) {
    return json(errorResponse("VALIDATION_ERROR", "Invalid quote ID format"), 400);
  }
  
  return withValidatedAuth(
    request,
    fullSalesCycleSchema,
    async (data: z.infer<typeof fullSalesCycleSchema>, auth: AuthContext) => {
      return workflowService.runFullSalesCycle(params.quoteId, auth.userId, {
        sendInvoiceEmail: data.sendInvoiceEmail,
        createDeliveryNote: data.createDeliveryNote,
        shippingAddress: data.shippingAddress,
      });
    },
    201
  );
});

// Update Quote Status with Workflow
router.post("/api/v1/workflow/quote/:quoteId/status", async (request, _url, params) => {
  if (!validateUuidParam(params.quoteId)) {
    return json(errorResponse("VALIDATION_ERROR", "Invalid quote ID format"), 400);
  }
  
  return withValidatedAuth(
    request,
    updateQuoteStatusSchema,
    async (data: z.infer<typeof updateQuoteStatusSchema>, auth: AuthContext) => {
      return workflowService.updateQuoteStatusWithWorkflow(
        params.quoteId,
        data.status,
        auth.userId,
        {
          autoConvert: data.autoConvert,
          sendEmail: data.sendEmail,
        }
      );
    }
  );
});

// Get workflow status by source
router.get("/api/v1/workflow/quote/:quoteId/status", async (request, _url, params) => {
  return withAuthAndUuidValidation(request, params.quoteId, "quote ID", async () => {
    return workflowService.getWorkflowBySourceId(params.quoteId, "quote");
  });
});

router.get("/api/v1/workflow/invoice/:invoiceId/status", async (request, _url, params) => {
  return withAuthAndUuidValidation(request, params.invoiceId, "invoice ID", async () => {
    return workflowService.getWorkflowBySourceId(params.invoiceId, "invoice");
  });
});

// ============================================
// Email Routes
// ============================================

// Send Invoice Email
router.post("/api/v1/invoices/:invoiceId/send-email", async (request, _url, params) => {
  if (!validateUuidParam(params.invoiceId)) {
    return json(errorResponse("VALIDATION_ERROR", "Invalid invoice ID format"), 400);
  }
  
  return withValidatedAuth(
    request,
    sendEmailSchema,
    async (data: z.infer<typeof sendEmailSchema>) => {
      return emailService.sendInvoiceEmail(params.invoiceId, data.recipientEmail);
    }
  );
});

// Send Quote Email
router.post("/api/v1/quotes/:quoteId/send-email", async (request, _url, params) => {
  if (!validateUuidParam(params.quoteId)) {
    return json(errorResponse("VALIDATION_ERROR", "Invalid quote ID format"), 400);
  }
  
  return withValidatedAuth(
    request,
    sendEmailSchema,
    async (data: z.infer<typeof sendEmailSchema>) => {
      return emailService.sendQuoteEmail(params.quoteId, data.recipientEmail);
    }
  );
});

// Send Payment Reminder
router.post("/api/v1/invoices/:invoiceId/send-reminder", async (request, _url, params) => {
  return withAuthAndUuidValidation(request, params.invoiceId, "invoice ID", async () => {
    return emailService.sendPaymentReminder(params.invoiceId);
  });
});

// Send Bulk Payment Reminders (admin only)
router.post("/api/v1/workflow/send-bulk-reminders", async (request) => {
  return withAuth(request, async (auth) => {
    if (auth.role !== "tenant_admin" && auth.role !== "superadmin") {
      return errorResponse("FORBIDDEN", "Admin access required");
    }
    return emailService.sendBulkPaymentReminders();
  });
});

export const workflowRoutes = router.getRoutes();
