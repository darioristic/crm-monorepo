/**
 * Example API Endpoints for Document Workflows
 *
 * These endpoints demonstrate how to use the improved schema
 * for cross-document workflows (Quote → Order → Invoice)
 */

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { logger } from "../lib/logger";
import {
  convertOrderToInvoice,
  convertQuoteToInvoice,
  convertQuoteToOrder,
  createConsolidatedInvoice,
  getDocumentChain,
} from "../services/document-workflow.service";

const app = new Hono();

// ============================================
// POST /api/workflows/quote-to-order
// Convert a quote to an order
// ============================================

const quoteToOrderSchema = z.object({
  quoteId: z.string().uuid(),
  customizations: z
    .object({
      orderNumber: z.string().optional(),
      orderDate: z.string().datetime().optional(),
      expectedDeliveryDate: z.string().datetime().optional(),
      notes: z.string().optional(),
      purchaseOrderNumber: z.string().optional(),
    })
    .optional(),
});

app.post("/quote-to-order", zValidator("json", quoteToOrderSchema), async (c) => {
  try {
    const userUnknown = (c as { get: (key: string) => unknown }).get("user");
    const tenantIdUnknown = (c as { get: (key: string) => unknown }).get("tenantId");
    const user = userUnknown as { id: string };
    const tenantId = tenantIdUnknown as string;
    const body = c.req.valid("json");

    const order = await convertQuoteToOrder({
      quoteId: body.quoteId,
      userId: user.id,
      tenantId,
      customizations: body.customizations
        ? {
            ...body.customizations,
            orderDate: body.customizations.orderDate
              ? new Date(body.customizations.orderDate)
              : undefined,
            expectedDeliveryDate: body.customizations.expectedDeliveryDate
              ? new Date(body.customizations.expectedDeliveryDate)
              : undefined,
          }
        : undefined,
    });

    logger.info(
      {
        quoteId: body.quoteId,
        orderId: order.id,
        userId: user.id,
      },
      "Quote converted to order"
    );

    return c.json({
      success: true,
      data: order,
    });
  } catch (error: unknown) {
    logger.error({ error }, "Failed to convert quote to order");
    return c.json(
      {
        success: false,
        error:
          typeof error === "object" && error && "message" in error
            ? (error as { message?: string }).message
            : "Unknown error",
      },
      400
    );
  }
});

// ============================================
// POST /api/workflows/quote-to-invoice
// Convert a quote directly to an invoice (bypass order)
// ============================================

const quoteToInvoiceSchema = z.object({
  quoteId: z.string().uuid(),
  customizations: z
    .object({
      invoiceNumber: z.string().optional(),
      issueDate: z.string().datetime().optional(),
      dueDate: z.string().datetime().optional(),
      paymentTerms: z.number().int().min(0).optional(),
      notes: z.string().optional(),
    })
    .optional(),
});

app.post("/quote-to-invoice", zValidator("json", quoteToInvoiceSchema), async (c) => {
  try {
    const userUnknown = (c as { get: (key: string) => unknown }).get("user");
    const tenantIdUnknown = (c as { get: (key: string) => unknown }).get("tenantId");
    const user = userUnknown as { id: string };
    const tenantId = tenantIdUnknown as string;
    const body = c.req.valid("json");

    const invoiceId = await convertQuoteToInvoice({
      quoteId: body.quoteId,
      userId: user.id,
      tenantId,
      customizations: body.customizations
        ? {
            ...body.customizations,
            issueDate: body.customizations.issueDate
              ? new Date(body.customizations.issueDate)
              : undefined,
            dueDate: body.customizations.dueDate
              ? new Date(body.customizations.dueDate)
              : undefined,
          }
        : undefined,
    });

    logger.info(
      {
        quoteId: body.quoteId,
        invoiceId,
        userId: user.id,
      },
      "Quote converted to invoice"
    );

    return c.json({
      success: true,
      data: { invoiceId },
    });
  } catch (error: unknown) {
    logger.error({ error }, "Failed to convert quote to invoice");
    return c.json(
      {
        success: false,
        error:
          typeof error === "object" && error && "message" in error
            ? (error as { message?: string }).message
            : "Unknown error",
      },
      400
    );
  }
});

// ============================================
// POST /api/workflows/order-to-invoice
// Convert an order to an invoice
// Supports partial invoicing
// ============================================

const orderToInvoiceSchema = z.object({
  orderId: z.string().uuid(),
  customizations: z
    .object({
      invoiceNumber: z.string().optional(),
      issueDate: z.string().datetime().optional(),
      dueDate: z.string().datetime().optional(),
      paymentTerms: z.number().int().min(0).optional(),
      notes: z.string().optional(),
      partial: z
        .object({
          percentage: z.number().min(0).max(100).optional(),
          amount: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

app.post("/order-to-invoice", zValidator("json", orderToInvoiceSchema), async (c) => {
  try {
    const userUnknown = (c as { get: (key: string) => unknown }).get("user");
    const tenantIdUnknown = (c as { get: (key: string) => unknown }).get("tenantId");
    const user = userUnknown as { id: string };
    const tenantId = tenantIdUnknown as string;
    const body = c.req.valid("json");

    const invoiceId = await convertOrderToInvoice({
      orderId: body.orderId,
      userId: user.id,
      tenantId,
      customizations: body.customizations
        ? {
            ...body.customizations,
            issueDate: body.customizations.issueDate
              ? new Date(body.customizations.issueDate)
              : undefined,
            dueDate: body.customizations.dueDate
              ? new Date(body.customizations.dueDate)
              : undefined,
          }
        : undefined,
    });

    logger.info(
      {
        orderId: body.orderId,
        invoiceId,
        userId: user.id,
        isPartial: !!body.customizations?.partial,
      },
      "Order converted to invoice"
    );

    return c.json({
      success: true,
      data: { invoiceId },
    });
  } catch (error: unknown) {
    logger.error({ error }, "Failed to convert order to invoice");
    return c.json(
      {
        success: false,
        error:
          typeof error === "object" && error && "message" in error
            ? (error as { message?: string }).message
            : "Unknown error",
      },
      400
    );
  }
});

// ============================================
// POST /api/workflows/consolidated-invoice
// Create a consolidated invoice from multiple orders
// ============================================

const consolidatedInvoiceSchema = z.object({
  orders: z
    .array(
      z.object({
        orderId: z.string().uuid(),
        amountAllocated: z.string().optional(), // if not provided, uses full remaining amount
      })
    )
    .min(1),
  customizations: z
    .object({
      invoiceNumber: z.string().optional(),
      issueDate: z.string().datetime().optional(),
      dueDate: z.string().datetime().optional(),
      paymentTerms: z.number().int().min(0).optional(),
      notes: z.string().optional(),
    })
    .optional(),
});

app.post("/consolidated-invoice", zValidator("json", consolidatedInvoiceSchema), async (c) => {
  try {
    const userUnknown = (c as { get: (key: string) => unknown }).get("user");
    const tenantIdUnknown = (c as { get: (key: string) => unknown }).get("tenantId");
    const user = userUnknown as { id: string };
    const tenantId = tenantIdUnknown as string;
    const body = c.req.valid("json");

    const invoiceId = await createConsolidatedInvoice({
      tenantId,
      userId: user.id,
      orders: body.orders,
      customizations: body.customizations
        ? {
            ...body.customizations,
            issueDate: body.customizations.issueDate
              ? new Date(body.customizations.issueDate)
              : undefined,
            dueDate: body.customizations.dueDate
              ? new Date(body.customizations.dueDate)
              : undefined,
          }
        : undefined,
    });

    logger.info(
      {
        invoiceId,
        orderCount: body.orders.length,
        userId: user.id,
      },
      "Consolidated invoice created"
    );

    return c.json({
      success: true,
      data: { invoiceId },
    });
  } catch (error: unknown) {
    logger.error({ error }, "Failed to create consolidated invoice");
    return c.json(
      {
        success: false,
        error:
          typeof error === "object" && error && "message" in error
            ? (error as { message?: string }).message
            : "Unknown error",
      },
      400
    );
  }
});

// ============================================
// GET /api/workflows/document-chain/:quoteId
// Get the full document chain for a quote
// (Quote → Orders → Invoices)
// ============================================

app.get("/document-chain/:quoteId", async (c) => {
  try {
    const tenantIdUnknown = (c as { get: (key: string) => unknown }).get("tenantId");
    const tenantId = tenantIdUnknown as string;
    const quoteId = c.req.param("quoteId");

    const chain = await getDocumentChain(quoteId, tenantId);

    return c.json({
      success: true,
      data: chain,
    });
  } catch (error: unknown) {
    logger.error({ error }, "Failed to get document chain");
    return c.json(
      {
        success: false,
        error:
          typeof error === "object" && error && "message" in error
            ? (error as { message?: string }).message
            : "Unknown error",
      },
      400
    );
  }
});

// ============================================
// Example Usage in Documentation
// ============================================

/**
 * Usage Examples:
 *
 * 1. Simple Quote → Order → Invoice Flow:
 *
 * ```bash
 * # Create quote (existing endpoint)
 * POST /api/quotes
 *
 * # Convert quote to order
 * POST /api/workflows/quote-to-order
 * {
 *   "quoteId": "quote-uuid",
 *   "customizations": {
 *     "purchaseOrderNumber": "PO-12345",
 *     "expectedDeliveryDate": "2025-02-15T00:00:00Z"
 *   }
 * }
 *
 * # Convert order to invoice
 * POST /api/workflows/order-to-invoice
 * {
 *   "orderId": "order-uuid"
 * }
 * ```
 *
 * 2. Partial Order Invoicing:
 *
 * ```bash
 * # Invoice 40% upfront
 * POST /api/workflows/order-to-invoice
 * {
 *   "orderId": "order-uuid",
 *   "customizations": {
 *     "notes": "Upfront payment (40%)",
 *     "partial": {
 *       "percentage": 40
 *     }
 *   }
 * }
 *
 * # Invoice remaining 60% later
 * POST /api/workflows/order-to-invoice
 * {
 *   "orderId": "order-uuid",
 *   "customizations": {
 *     "notes": "Final payment (60%)",
 *     "partial": {
 *       "percentage": 60
 *     }
 *   }
 * }
 * ```
 *
 * 3. Consolidated Multi-Order Invoice:
 *
 * ```bash
 * # Invoice multiple orders together
 * POST /api/workflows/consolidated-invoice
 * {
 *   "orders": [
 *     { "orderId": "order-1-uuid" },
 *     { "orderId": "order-2-uuid" },
 *     { "orderId": "order-3-uuid", "amountAllocated": "500.00" }
 *   ],
 *   "customizations": {
 *     "notes": "Monthly consolidated invoice"
 *   }
 * }
 * ```
 *
 * 4. Direct Quote → Invoice (bypass Order):
 *
 * ```bash
 * # For simple quotes that don't need order tracking
 * POST /api/workflows/quote-to-invoice
 * {
 *   "quoteId": "quote-uuid",
 *   "customizations": {
 *     "paymentTerms": 15
 *   }
 * }
 * ```
 *
 * 5. View Full Document Chain:
 *
 * ```bash
 * GET /api/workflows/document-chain/{quoteId}
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "quote": { ... },
 *     "orders": [
 *       { "order": { ... }, "items": [...] }
 *     ],
 *     "invoices": [
 *       { "invoice": { ... }, "linkedOrders": [...] }
 *     ]
 *   }
 * }
 * ```
 */

export default app;
