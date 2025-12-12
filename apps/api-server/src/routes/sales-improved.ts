/**
 * Improved Sales Routes - Using New Schema with Multi-Tenancy
 *
 * This file demonstrates how to update existing sales routes to use the improved schema
 * Key changes:
 * - All queries now include tenantId for proper isolation
 * - Support for document workflows (Quote → Order → Invoice)
 * - Integration with document-workflow.service.ts
 */

import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { customAlphabet } from "nanoid";
import { z } from "zod";
import { db } from "../db/client";
import { companies } from "../db/schema/companies";
import {
  invoiceItemsImproved,
  invoiceOrders,
  invoicesImproved,
  orderItemsImproved,
  ordersImproved,
  organizationRoles,
  quoteItemsImproved,
  quotesImproved,
} from "../db/schema/improved-sales";
import { logger } from "../lib/logger";
import {
  convertOrderToInvoice,
  convertQuoteToInvoice,
  convertQuoteToOrder,
  createConsolidatedInvoice,
  getDocumentChain,
} from "../services/document-workflow.service";

type Variables = {
  user: {
    id: string;
    tenantId: string;
    role: string;
    companyId?: string;
  };
};

const app = new Hono<{ Variables: Variables }>();

// ============================================
// Middleware: Extract tenant and user from auth
// ============================================

// This middleware should be applied to all routes
// In your actual implementation, this comes from your auth middleware
app.use("*", async (c, next) => {
  // Mock for demonstration - replace with your actual auth
  const user = c.get("user");
  if (!user || !user.tenantId) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});

// ============================================
// QUOTES - GET ALL
// ============================================

const getQuotesQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(["draft", "sent", "accepted", "rejected", "expired"]).optional(),
  companyId: z.string().uuid().optional(),
  search: z.string().optional(),
});

app.get("/api/v1/quotes", zValidator("query", getQuotesQuerySchema), async (c) => {
  try {
    const user = c.get("user");
    const query = c.req.valid("query");
    const offset = (query.page - 1) * query.limit;

    // Build WHERE clause with tenantId (CRITICAL for multi-tenancy)
    const conditions = [eq(quotesImproved.tenantId, user.tenantId)];

    // Filter by status
    if (query.status) {
      const status = query.status as import("../db/schema/improved-sales").QuoteImproved["status"];
      conditions.push(eq(quotesImproved.status, status));
    }

    // Filter by company
    if (query.companyId) {
      conditions.push(eq(quotesImproved.companyId, query.companyId));
    }

    // Search by quote number
    if (query.search) {
      conditions.push(sql`${quotesImproved.quoteNumber} ILIKE ${`%${query.search}%`}`);
    }

    // Get quotes with pagination
    const quotes = await db
      .select()
      .from(quotesImproved)
      .where(and(...conditions))
      .orderBy(desc(quotesImproved.createdAt))
      .limit(query.limit)
      .offset(offset);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(quotesImproved)
      .where(and(...conditions));

    return c.json({
      success: true,
      data: quotes,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: Number(count),
        totalPages: Math.ceil(Number(count) / query.limit),
      },
    });
  } catch (error: unknown) {
    logger.error({ error }, "Failed to fetch quotes");
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

// ============================================
// QUOTES - GET BY ID (with items and relationships)
// ============================================

app.get("/api/v1/quotes/:id", async (c) => {
  try {
    const user = c.get("user");
    const quoteId = c.req.param("id");

    // Get quote with tenant check
    const [quote] = await db
      .select()
      .from(quotesImproved)
      .where(
        and(
          eq(quotesImproved.id, quoteId),
          eq(quotesImproved.tenantId, user.tenantId) // CRITICAL: tenant isolation
        )
      );

    if (!quote) {
      return c.json({ error: "Quote not found" }, 404);
    }

    // Get quote items
    const items = await db
      .select()
      .from(quoteItemsImproved)
      .where(eq(quoteItemsImproved.quoteId, quoteId))
      .orderBy(quoteItemsImproved.sortOrder);

    // Get related orders (if converted)
    const relatedOrders = await db
      .select()
      .from(ordersImproved)
      .where(and(eq(ordersImproved.quoteId, quoteId), eq(ordersImproved.tenantId, user.tenantId)));

    // Get related invoices (if converted directly or via orders)
    const relatedInvoices = await db
      .select()
      .from(invoicesImproved)
      .where(
        and(eq(invoicesImproved.quoteId, quoteId), eq(invoicesImproved.tenantId, user.tenantId))
      );

    return c.json({
      success: true,
      data: {
        ...quote,
        items,
        relatedOrders,
        relatedInvoices,
      },
    });
  } catch (error: unknown) {
    logger.error({ error }, "Failed to fetch quote");
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// ============================================
// QUOTES - CREATE
// ============================================

const createQuoteSchema = z.object({
  companyId: z.string().uuid(),
  contactId: z.string().uuid().optional(),
  validUntil: z.string().datetime(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid().optional(),
        productName: z.string(),
        description: z.string().optional(),
        sku: z.string().optional(),
        quantity: z.string(),
        unit: z.string().default("pcs"),
        unitPrice: z.string(),
        discount: z.string().default("0"),
        taxRate: z.string().default("0"),
      })
    )
    .min(1),
  notes: z.string().optional(),
  terms: z.string().optional(),
  internalNotes: z.string().optional(),
});

app.post("/api/v1/quotes", zValidator("json", createQuoteSchema), async (c) => {
  try {
    const user = c.get("user");
    const body = c.req.valid("json");

    // Verify company access
    const [company] = await db
      .select()
      .from(organizationRoles)
      .where(
        and(
          eq(organizationRoles.companyId, body.companyId),
          eq(organizationRoles.tenantId, user.tenantId),
          eq(organizationRoles.role, "customer")
        )
      );

    if (!company) {
      return c.json({ error: "Company not found or not a customer" }, 404);
    }

    return await db.transaction(async (tx) => {
      // Calculate totals
      let subtotal = 0;
      let tax = 0;

      for (const item of body.items) {
        const itemTotal =
          parseFloat(item.quantity) *
          parseFloat(item.unitPrice) *
          (1 - parseFloat(item.discount) / 100);
        subtotal += itemTotal;
        tax += itemTotal * (parseFloat(item.taxRate) / 100);
      }

      const total = subtotal + tax;

      // Create quote
      const quoteNumber = `QUO-${customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 10)()}`;

      const [quote] = await tx
        .insert(quotesImproved)
        .values({
          quoteNumber,
          tenantId: user.tenantId, // CRITICAL: set tenant
          companyId: body.companyId,
          contactId: body.contactId,
          validUntil: new Date(body.validUntil),
          subtotal: subtotal.toFixed(2),
          tax: tax.toFixed(2),
          total: total.toFixed(2),
          notes: body.notes,
          terms: body.terms,
          internalNotes: body.internalNotes,
          createdBy: user.id,
        })
        .returning();

      // Create quote items
      const itemsData = body.items.map((item, index) => {
        const itemTotal =
          parseFloat(item.quantity) *
          parseFloat(item.unitPrice) *
          (1 - parseFloat(item.discount) / 100);

        return {
          quoteId: quote.id,
          productId: item.productId,
          productName: item.productName,
          description: item.description,
          sku: item.sku,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          discount: item.discount,
          taxRate: item.taxRate,
          total: itemTotal.toFixed(2),
          sortOrder: index,
        };
      });

      const items = await tx.insert(quoteItemsImproved).values(itemsData).returning();

      logger.info({ quoteId: quote.id, userId: user.id }, "Quote created");

      return c.json({
        success: true,
        data: {
          ...quote,
          items,
        },
      });
    });
  } catch (error: unknown) {
    logger.error({ error }, "Failed to create quote");
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

// ============================================
// QUOTES - UPDATE
// ============================================

app.put("/api/v1/quotes/:id", zValidator("json", createQuoteSchema.partial()), async (c) => {
  try {
    const user = c.get("user");
    const quoteId = c.req.param("id");
    const body = c.req.valid("json");

    // Check quote exists and belongs to tenant
    const [existing] = await db
      .select()
      .from(quotesImproved)
      .where(and(eq(quotesImproved.id, quoteId), eq(quotesImproved.tenantId, user.tenantId)));

    if (!existing) {
      return c.json({ error: "Quote not found" }, 404);
    }

    if (existing.status === "converted") {
      return c.json({ error: "Cannot update converted quote" }, 400);
    }

    return await db.transaction(async (tx) => {
      // Update quote
      const updateData: Record<string, unknown> = {
        updatedBy: user.id,
        updatedAt: new Date(),
      };

      if (body.validUntil) updateData.validUntil = new Date(body.validUntil);
      if (body.notes !== undefined) updateData.notes = body.notes;
      if (body.terms !== undefined) updateData.terms = body.terms;
      if (body.internalNotes !== undefined) updateData.internalNotes = body.internalNotes;

      // If items are updated, recalculate totals
      if (body.items) {
        // Delete old items
        await tx.delete(quoteItemsImproved).where(eq(quoteItemsImproved.quoteId, quoteId));

        // Calculate new totals
        let subtotal = 0;
        let tax = 0;

        for (const item of body.items) {
          const itemTotal =
            parseFloat(item.quantity) *
            parseFloat(item.unitPrice) *
            (1 - parseFloat(item.discount ?? "0") / 100);
          subtotal += itemTotal;
          tax += itemTotal * (parseFloat(item.taxRate ?? "0") / 100);
        }

        const total = subtotal + tax;

        updateData.subtotal = subtotal.toFixed(2);
        updateData.tax = tax.toFixed(2);
        updateData.total = total.toFixed(2);

        // Create new items
        const itemsData = body.items.map((item, index) => {
          const itemTotal =
            parseFloat(item.quantity) *
            parseFloat(item.unitPrice) *
            (1 - parseFloat(item.discount ?? "0") / 100);

          return {
            quoteId,
            productId: item.productId,
            productName: item.productName,
            description: item.description,
            sku: item.sku,
            quantity: item.quantity,
            unit: item.unit ?? "pcs",
            unitPrice: item.unitPrice,
            discount: item.discount ?? "0",
            taxRate: item.taxRate ?? "0",
            total: itemTotal.toFixed(2),
            sortOrder: index,
          };
        });

        await tx.insert(quoteItemsImproved).values(itemsData);
      }

      const [updated] = await tx
        .update(quotesImproved)
        .set(updateData)
        .where(eq(quotesImproved.id, quoteId))
        .returning();

      logger.info({ quoteId, userId: user.id }, "Quote updated");

      return c.json({
        success: true,
        data: updated,
      });
    });
  } catch (error: unknown) {
    logger.error({ error }, "Failed to update quote");
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

// ============================================
// QUOTES - DELETE
// ============================================

app.delete("/api/v1/quotes/:id", async (c) => {
  try {
    const user = c.get("user");
    const quoteId = c.req.param("id");

    // Check quote exists and belongs to tenant
    const [existing] = await db
      .select()
      .from(quotesImproved)
      .where(and(eq(quotesImproved.id, quoteId), eq(quotesImproved.tenantId, user.tenantId)));

    if (!existing) {
      return c.json({ error: "Quote not found" }, 404);
    }

    if (existing.status === "converted") {
      return c.json({ error: "Cannot delete converted quote" }, 400);
    }

    // Delete quote (cascade will delete items)
    await db.delete(quotesImproved).where(eq(quotesImproved.id, quoteId));

    logger.info({ quoteId, userId: user.id }, "Quote deleted");

    return c.json({
      success: true,
      message: "Quote deleted successfully",
    });
  } catch (error: unknown) {
    logger.error({ error }, "Failed to delete quote");
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

// ============================================
// WORKFLOW: CONVERT QUOTE TO ORDER
// ============================================

const convertQuoteToOrderSchema = z.object({
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

app.post(
  "/api/v1/quotes/:id/convert-to-order",
  zValidator("json", convertQuoteToOrderSchema),
  async (c) => {
    try {
      const user = c.get("user");
      const quoteId = c.req.param("id");
      const body = c.req.valid("json");

      const order = await convertQuoteToOrder({
        quoteId,
        userId: user.id,
        tenantId: user.tenantId,
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

      return c.json({
        success: true,
        data: order,
      });
    } catch (error: unknown) {
      logger.error({ error }, "Failed to convert quote to order");
      return c.json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
  }
);

// ============================================
// WORKFLOW: CONVERT QUOTE TO INVOICE
// ============================================

const convertQuoteToInvoiceSchema = z.object({
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

app.post(
  "/api/v1/quotes/:id/convert-to-invoice",
  zValidator("json", convertQuoteToInvoiceSchema),
  async (c) => {
    try {
      const user = c.get("user");
      const quoteId = c.req.param("id");
      const body = c.req.valid("json");

      const invoiceId = await convertQuoteToInvoice({
        quoteId,
        userId: user.id,
        tenantId: user.tenantId,
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

      return c.json({
        success: true,
        data: { invoiceId },
      });
    } catch (error: unknown) {
      logger.error({ error }, "Failed to convert quote to invoice");
      return c.json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
  }
);

// ============================================
// WORKFLOW: GET DOCUMENT CHAIN
// ============================================

app.get("/api/v1/quotes/:id/chain", async (c) => {
  try {
    const user = c.get("user");
    const quoteId = c.req.param("id");

    const chain = await getDocumentChain(quoteId, user.tenantId);

    return c.json({
      success: true,
      data: chain,
    });
  } catch (error: unknown) {
    logger.error({ error }, "Failed to get document chain");
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// ============================================
// ORDERS - LIST
// ============================================

app.get("/api/v1/orders", async (c) => {
  try {
    const user = c.get("user");
    const { status, companyId, quoteId, page = "1", limit = "50" } = c.req.query();

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    // Build conditions - ALWAYS include tenantId
    const conditions = [eq(ordersImproved.tenantId, user.tenantId)];

    if (status) {
      const s = status as import("../db/schema/improved-sales").OrderImproved["status"];
      conditions.push(eq(ordersImproved.status, s));
    }
    if (companyId) {
      conditions.push(eq(ordersImproved.companyId, companyId));
    }
    if (quoteId) {
      conditions.push(eq(ordersImproved.quoteId, quoteId));
    }

    const orders = await db
      .select()
      .from(ordersImproved)
      .where(and(...conditions))
      .orderBy(desc(ordersImproved.createdAt))
      .limit(limitNum)
      .offset(offset);

    return c.json({
      success: true,
      data: orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        offset,
      },
    });
  } catch (error: unknown) {
    logger.error({ error }, "Failed to list orders");
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// ============================================
// ORDERS - GET BY ID
// ============================================

app.get("/api/v1/orders/:id", async (c) => {
  try {
    const user = c.get("user");
    const orderId = c.req.param("id");

    // Get order with tenant isolation
    const [order] = await db
      .select()
      .from(ordersImproved)
      .where(and(eq(ordersImproved.id, orderId), eq(ordersImproved.tenantId, user.tenantId)));

    if (!order) {
      return c.json({ error: "Order not found" }, 404);
    }

    // Get items
    const items = await db
      .select()
      .from(orderItemsImproved)
      .where(eq(orderItemsImproved.orderId, orderId));

    // Get linked invoices via invoice_orders bridge
    const linkedInvoices = await db
      .select({
        invoiceId: invoiceOrders.invoiceId,
        amountAllocated: invoiceOrders.amountAllocated,
        invoiceNumber: invoicesImproved.invoiceNumber,
        invoiceStatus: invoicesImproved.status,
        issueDate: invoicesImproved.issueDate,
      })
      .from(invoiceOrders)
      .innerJoin(invoicesImproved, eq(invoiceOrders.invoiceId, invoicesImproved.id))
      .where(eq(invoiceOrders.orderId, orderId));

    // Get source quote if exists
    let sourceQuote = null;
    if (order.quoteId) {
      const [quote] = await db
        .select()
        .from(quotesImproved)
        .where(eq(quotesImproved.id, order.quoteId));
      sourceQuote = quote || null;
    }

    return c.json({
      success: true,
      data: {
        order,
        items,
        linkedInvoices,
        sourceQuote,
      },
    });
  } catch (error: unknown) {
    logger.error({ error }, "Failed to get order");
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// ============================================
// ORDERS - CREATE
// ============================================

const createOrderSchema = z.object({
  companyId: z.string().uuid(),
  quoteId: z.string().uuid().optional(),
  orderNumber: z.string().optional(),
  orderDate: z.string().datetime().optional(),
  expectedDeliveryDate: z.string().datetime().optional(),
  purchaseOrderNumber: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.string().uuid().optional(),
      productName: z.string().min(1),
      description: z.string().min(1),
      quantity: z.number().positive(),
      unit: z.string().optional(),
      unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
      taxRate: z.number().min(0).max(100).optional(),
      discount: z.number().min(0).max(100).optional(),
    })
  ),
});

app.post("/api/v1/orders", zValidator("json", createOrderSchema), async (c) => {
  try {
    const user = c.get("user");
    const body = c.req.valid("json");

    // Verify company belongs to tenant
    const [company] = await db
      .select()
      .from(companies)
      .where(and(eq(companies.id, body.companyId), eq(companies.tenantId, user.tenantId)));

    if (!company) {
      return c.json({ error: "Company not found" }, 404);
    }

    const result = await db.transaction(async (tx) => {
      // Generate order number if not provided
      const orderNumber =
        body.orderNumber || `ORD-${new Date().getFullYear()}-${customAlphabet("1234567890", 6)()}`;

      // Calculate totals
      const subtotal = body.items.reduce((sum, item) => {
        const itemTotal = item.quantity * parseFloat(item.unitPrice);
        const discount = item.discount ? (itemTotal * item.discount) / 100 : 0;
        return sum + (itemTotal - discount);
      }, 0);

      const totalTax = body.items.reduce((sum, item) => {
        const itemTotal = item.quantity * parseFloat(item.unitPrice);
        const discount = item.discount ? (itemTotal * item.discount) / 100 : 0;
        const taxableAmount = itemTotal - discount;
        const tax = item.taxRate ? (taxableAmount * item.taxRate) / 100 : 0;
        return sum + tax;
      }, 0);

      const totalAmount = subtotal + totalTax;

      // Create order
      const [order] = await tx
        .insert(ordersImproved)
        .values({
          orderNumber,
          tenantId: user.tenantId,
          companyId: body.companyId,
          quoteId: body.quoteId,
          orderDate: body.orderDate ? new Date(body.orderDate) : new Date(),
          expectedDeliveryDate: body.expectedDeliveryDate
            ? new Date(body.expectedDeliveryDate)
            : undefined,
          purchaseOrderNumber: body.purchaseOrderNumber,
          subtotal: subtotal.toFixed(2),
          tax: totalTax.toFixed(2),
          total: totalAmount.toFixed(2),
          status: "pending",
          notes: body.notes,
          createdBy: user.id,
        })
        .returning();

      // Create items
      const itemsData = body.items.map((item) => {
        const itemTotal = item.quantity * parseFloat(item.unitPrice);
        const discount = item.discount ? (itemTotal * item.discount) / 100 : 0;
        const taxableAmount = itemTotal - discount;
        const tax = item.taxRate ? (taxableAmount * item.taxRate) / 100 : 0;
        const total = taxableAmount + tax;

        return {
          orderId: order.id,
          productId: item.productId,
          productName: item.productName,
          description: item.description,
          quantity: String(item.quantity),
          unit: item.unit ?? "pcs",
          unitPrice: item.unitPrice,
          taxRate: String(item.taxRate || 0),
          discount: String(item.discount || 0),
          total: total.toFixed(2),
        };
      });

      await tx.insert(orderItemsImproved).values(itemsData);

      logger.info({ orderId: order.id, userId: user.id }, "Order created");

      return order;
    });

    return c.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    logger.error({ error }, "Failed to create order");
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// ============================================
// ORDERS - UPDATE
// ============================================

const updateOrderSchema = z.object({
  orderDate: z.string().datetime().optional(),
  expectedDeliveryDate: z.string().datetime().optional(),
  purchaseOrderNumber: z.string().optional(),
  notes: z.string().optional(),
  status: z
    .enum([
      "draft",
      "pending",
      "confirmed",
      "processing",
      "partially_fulfilled",
      "fulfilled",
      "partially_invoiced",
      "invoiced",
      "cancelled",
      "on_hold",
    ])
    .optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid().optional(),
        productName: z.string().min(1),
        description: z.string().min(1),
        quantity: z.number().positive(),
        unit: z.string().optional(),
        unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
        taxRate: z.number().min(0).max(100).optional(),
        discount: z.number().min(0).max(100).optional(),
      })
    )
    .optional(),
});

app.put("/api/v1/orders/:id", zValidator("json", updateOrderSchema), async (c) => {
  try {
    const user = c.get("user");
    const orderId = c.req.param("id");
    const body = c.req.valid("json");

    // Check order exists and belongs to tenant
    const [existing] = await db
      .select()
      .from(ordersImproved)
      .where(and(eq(ordersImproved.id, orderId), eq(ordersImproved.tenantId, user.tenantId)));

    if (!existing) {
      return c.json({ error: "Order not found" }, 404);
    }

    if (existing.status === "fulfilled" || existing.status === "cancelled") {
      return c.json({ error: "Cannot update fulfilled or cancelled order" }, 400);
    }

    return await db.transaction(async (tx) => {
      const updateData: Record<string, unknown> = {
        updatedBy: user.id,
        updatedAt: new Date(),
      };

      if (body.orderDate) updateData.orderDate = new Date(body.orderDate);
      if (body.expectedDeliveryDate)
        updateData.expectedDeliveryDate = new Date(body.expectedDeliveryDate);
      if (body.purchaseOrderNumber) updateData.purchaseOrderNumber = body.purchaseOrderNumber;
      if (body.notes) updateData.notes = body.notes;
      if (body.status) {
        updateData.status = body.status;
        if (body.status === "confirmed") updateData.confirmedAt = new Date();
        if (body.status === "cancelled") updateData.cancelledAt = new Date();
      }

      // Update items if provided
      if (body.items) {
        // Delete old items
        await tx.delete(orderItemsImproved).where(eq(orderItemsImproved.orderId, orderId));

        // Calculate new totals
        const subtotal = body.items.reduce((sum, item) => {
          const itemTotal = item.quantity * parseFloat(item.unitPrice);
          const discount = item.discount ? (itemTotal * item.discount) / 100 : 0;
          return sum + (itemTotal - discount);
        }, 0);

        const totalTax = body.items.reduce((sum, item) => {
          const itemTotal = item.quantity * parseFloat(item.unitPrice);
          const discount = item.discount ? (itemTotal * item.discount) / 100 : 0;
          const taxableAmount = itemTotal - discount;
          const tax = item.taxRate ? (taxableAmount * item.taxRate) / 100 : 0;
          return sum + tax;
        }, 0);

        const totalAmount = subtotal + totalTax;

        updateData.subtotal = subtotal.toFixed(2);
        updateData.tax = totalTax.toFixed(2);
        updateData.total = totalAmount.toFixed(2);

        // Insert new items
        const itemsData = body.items.map((item) => {
          const itemTotal = item.quantity * parseFloat(item.unitPrice);
          const discount = item.discount ? (itemTotal * item.discount) / 100 : 0;
          const taxableAmount = itemTotal - discount;
          const tax = item.taxRate ? (taxableAmount * item.taxRate) / 100 : 0;
          const total = taxableAmount + tax;

          return {
            orderId,
            productId: item.productId,
            productName: item.productName,
            description: item.description,
            quantity: String(item.quantity),
            unit: item.unit ?? "pcs",
            unitPrice: item.unitPrice,
            taxRate: String(item.taxRate || 0),
            discount: String(item.discount || 0),
            total: total.toFixed(2),
          };
        });

        await tx.insert(orderItemsImproved).values(itemsData);
      }

      const [updated] = await tx
        .update(ordersImproved)
        .set(updateData)
        .where(eq(ordersImproved.id, orderId))
        .returning();

      logger.info({ orderId, userId: user.id }, "Order updated");

      return c.json({
        success: true,
        data: updated,
      });
    });
  } catch (error: unknown) {
    logger.error({ error }, "Failed to update order");
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// ============================================
// ORDERS - DELETE
// ============================================

app.delete("/api/v1/orders/:id", async (c) => {
  try {
    const user = c.get("user");
    const orderId = c.req.param("id");

    // Check order exists and belongs to tenant
    const [existing] = await db
      .select()
      .from(ordersImproved)
      .where(and(eq(ordersImproved.id, orderId), eq(ordersImproved.tenantId, user.tenantId)));

    if (!existing) {
      return c.json({ error: "Order not found" }, 404);
    }

    if (existing.status === "fulfilled") {
      return c.json({ error: "Cannot delete fulfilled order" }, 400);
    }

    // Check if order has any invoices
    const linkedInvoices = await db
      .select()
      .from(invoiceOrders)
      .where(eq(invoiceOrders.orderId, orderId));

    if (linkedInvoices.length > 0) {
      return c.json({ error: "Cannot delete order with invoices" }, 400);
    }

    // Delete order (cascade will delete items)
    await db.delete(ordersImproved).where(eq(ordersImproved.id, orderId));

    logger.info({ orderId, userId: user.id }, "Order deleted");

    return c.json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (error: unknown) {
    logger.error({ error }, "Failed to delete order");
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// ============================================
// WORKFLOW: CONVERT ORDER TO INVOICE
// ============================================

const convertOrderToInvoiceSchema = z.object({
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

app.post(
  "/api/v1/orders/:id/convert-to-invoice",
  zValidator("json", convertOrderToInvoiceSchema),
  async (c) => {
    try {
      const user = c.get("user");
      const orderId = c.req.param("id");
      const body = c.req.valid("json");

      const invoiceId = await convertOrderToInvoice({
        orderId,
        userId: user.id,
        tenantId: user.tenantId,
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

      return c.json({
        success: true,
        data: { invoiceId },
      });
    } catch (error: unknown) {
      logger.error({ error }, "Failed to convert order to invoice");
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 400);
    }
  }
);

// ============================================
// INVOICES - LIST
// ============================================

app.get("/api/v1/invoices", async (c) => {
  try {
    const user = c.get("user");
    const { status, companyId, page = "1", limit = "50" } = c.req.query();

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    // Build conditions - ALWAYS include tenantId
    const conditions = [eq(invoicesImproved.tenantId, user.tenantId)];

    if (status) {
      const allowed = [
        "draft",
        "sent",
        "paid",
        "overdue",
        "cancelled",
        "refunded",
        "viewed",
        "partially_paid",
      ] as const;
      const normalized = String(status).toLowerCase();
      const mapped = (
        normalized === "canceled" ? "cancelled" : normalized
      ) as (typeof allowed)[number];
      if (allowed.includes(mapped)) {
        conditions.push(eq(invoicesImproved.status, mapped));
      }
    }
    if (companyId) {
      conditions.push(eq(invoicesImproved.companyId, companyId));
    }

    const invoices = await db
      .select()
      .from(invoicesImproved)
      .where(and(...conditions))
      .orderBy(desc(invoicesImproved.createdAt))
      .limit(limitNum)
      .offset(offset);

    return c.json({
      success: true,
      data: invoices,
      pagination: {
        page: pageNum,
        limit: limitNum,
        offset,
      },
    });
  } catch (error: unknown) {
    logger.error({ error }, "Failed to list invoices");
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

// ============================================
// INVOICES - GET BY ID
// ============================================

app.get("/api/v1/invoices/:id", async (c) => {
  try {
    const user = c.get("user");
    const invoiceId = c.req.param("id");

    // Get invoice with tenant isolation
    const [invoice] = await db
      .select()
      .from(invoicesImproved)
      .where(and(eq(invoicesImproved.id, invoiceId), eq(invoicesImproved.tenantId, user.tenantId)));

    if (!invoice) {
      return c.json({ error: "Invoice not found" }, 404);
    }

    // Get items
    const items = await db
      .select()
      .from(invoiceItemsImproved)
      .where(eq(invoiceItemsImproved.invoiceId, invoiceId));

    // Get linked orders via invoice_orders bridge
    const linkedOrders = await db
      .select({
        orderId: invoiceOrders.orderId,
        amountAllocated: invoiceOrders.amountAllocated,
        orderNumber: ordersImproved.orderNumber,
        orderStatus: ordersImproved.status,
        orderDate: ordersImproved.orderDate,
      })
      .from(invoiceOrders)
      .innerJoin(ordersImproved, eq(invoiceOrders.orderId, ordersImproved.id))
      .where(eq(invoiceOrders.invoiceId, invoiceId));

    // Get source quote if exists
    let sourceQuote = null;
    if (invoice.quoteId) {
      const [quote] = await db
        .select()
        .from(quotesImproved)
        .where(eq(quotesImproved.id, invoice.quoteId));
      sourceQuote = quote || null;
    }

    return c.json({
      success: true,
      data: {
        invoice,
        items,
        linkedOrders,
        sourceQuote,
      },
    });
  } catch (error: unknown) {
    logger.error({ error }, "Failed to get invoice");
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

// ============================================
// INVOICES - CREATE
// ============================================

const createInvoiceSchema = z.object({
  companyId: z.string().uuid(),
  quoteId: z.string().uuid().optional(),
  invoiceNumber: z.string().optional(),
  issueDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  paymentTerms: z.number().int().min(0).optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.string().uuid().optional(),
      productName: z.string().min(1),
      description: z.string().min(1),
      quantity: z.number().positive(),
      unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
      taxRate: z.number().min(0).max(100).optional(),
      discount: z.number().min(0).max(100).optional(),
      unit: z.string().optional(),
    })
  ),
});

app.post("/api/v1/invoices", zValidator("json", createInvoiceSchema), async (c) => {
  try {
    const user = c.get("user");
    const body = c.req.valid("json");

    // Verify company belongs to tenant
    const [company] = await db
      .select()
      .from(companies)
      .where(and(eq(companies.id, body.companyId), eq(companies.tenantId, user.tenantId)));

    if (!company) {
      return c.json({ error: "Company not found" }, 404);
    }

    const result = await db.transaction(async (tx) => {
      // Generate invoice number if not provided
      const invoiceNumber =
        body.invoiceNumber ||
        `INV-${new Date().getFullYear()}-${customAlphabet("1234567890", 6)()}`;

      // Calculate totals
      const subtotal = body.items.reduce((sum, item) => {
        const itemTotal = item.quantity * parseFloat(item.unitPrice);
        const discount = item.discount ? (itemTotal * item.discount) / 100 : 0;
        return sum + (itemTotal - discount);
      }, 0);

      const totalTax = body.items.reduce((sum, item) => {
        const itemTotal = item.quantity * parseFloat(item.unitPrice);
        const discount = item.discount ? (itemTotal * item.discount) / 100 : 0;
        const taxableAmount = itemTotal - discount;
        const tax = item.taxRate ? (taxableAmount * item.taxRate) / 100 : 0;
        return sum + tax;
      }, 0);

      const totalAmount = subtotal + totalTax;

      const issueDate = body.issueDate ? new Date(body.issueDate) : new Date();
      const paymentTerms = body.paymentTerms || 30;
      const dueDate = body.dueDate
        ? new Date(body.dueDate)
        : new Date(issueDate.getTime() + paymentTerms * 24 * 60 * 60 * 1000);

      // Create invoice
      const [invoice] = await tx
        .insert(invoicesImproved)
        .values({
          invoiceNumber,
          tenantId: user.tenantId,
          companyId: body.companyId,
          quoteId: body.quoteId,
          issueDate,
          dueDate,
          paymentTerms,
          subtotal: subtotal.toFixed(2),
          tax: totalTax.toFixed(2),
          total: totalAmount.toFixed(2),
          paidAmount: "0.00",
          status: "draft",
          notes: body.notes,
          createdBy: user.id,
        })
        .returning();

      // Create items
      const itemsData = body.items.map((item) => {
        const itemTotal = item.quantity * parseFloat(item.unitPrice);
        const discount = item.discount ? (itemTotal * item.discount) / 100 : 0;
        const taxableAmount = itemTotal - discount;
        const tax = item.taxRate ? (taxableAmount * item.taxRate) / 100 : 0;
        const total = taxableAmount + tax;

        return {
          invoiceId: invoice.id,
          productId: item.productId,
          productName: item.productName,
          description: item.description,
          quantity: String(item.quantity),
          unit: item.unit ?? "pcs",
          unitPrice: item.unitPrice,
          discount: String(item.discount || 0),
          vatRate: String(item.taxRate || 0),
          total: total.toFixed(2),
        };
      });

      await tx.insert(invoiceItemsImproved).values(itemsData);

      logger.info({ invoiceId: invoice.id, userId: user.id }, "Invoice created");

      return invoice;
    });

    return c.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    logger.error({ error }, "Failed to create invoice");
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

// ============================================
// INVOICES - UPDATE
// ============================================

const updateInvoiceSchema = z.object({
  issueDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  paymentTerms: z.number().int().min(0).optional(),
  notes: z.string().optional(),
  status: z
    .enum(["draft", "sent", "viewed", "overdue", "partially_paid", "paid", "cancelled", "refunded"])
    .optional(),
  paidAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid().optional(),
        productName: z.string().min(1),
        description: z.string().min(1),
        quantity: z.number().positive(),
        unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
        taxRate: z.number().min(0).max(100).optional(),
        discount: z.number().min(0).max(100).optional(),
        unit: z.string().optional(),
      })
    )
    .optional(),
});

app.put("/api/v1/invoices/:id", zValidator("json", updateInvoiceSchema), async (c) => {
  try {
    const user = c.get("user");
    const invoiceId = c.req.param("id");
    const body = c.req.valid("json");

    // Check invoice exists and belongs to tenant
    const [existing] = await db
      .select()
      .from(invoicesImproved)
      .where(and(eq(invoicesImproved.id, invoiceId), eq(invoicesImproved.tenantId, user.tenantId)));

    if (!existing) {
      return c.json({ error: "Invoice not found" }, 404);
    }

    if (existing.status === "paid" || existing.status === "cancelled") {
      return c.json({ error: "Cannot update paid or cancelled invoice" }, 400);
    }

    return await db.transaction(async (tx) => {
      const updateData: Record<string, unknown> = {
        updatedBy: user.id,
        updatedAt: new Date(),
      };

      if (body.issueDate) updateData.issueDate = new Date(body.issueDate);
      if (body.dueDate) updateData.dueDate = new Date(body.dueDate);
      if (body.paymentTerms !== undefined) updateData.paymentTerms = body.paymentTerms;
      if (body.notes) updateData.notes = body.notes;
      if (body.paidAmount) updateData.paidAmount = body.paidAmount;
      if (body.status) {
        updateData.status = body.status;
        if (body.status === "sent") updateData.sentAt = new Date();
        if (body.status === "paid") updateData.paidAt = new Date();
        if (body.status === "cancelled") updateData.cancelledAt = new Date();
      }

      // Update items if provided
      if (body.items) {
        // Delete old items
        await tx.delete(invoiceItemsImproved).where(eq(invoiceItemsImproved.invoiceId, invoiceId));

        // Calculate new totals
        const subtotal = body.items.reduce((sum, item) => {
          const itemTotal = item.quantity * parseFloat(item.unitPrice);
          const discount = item.discount ? (itemTotal * item.discount) / 100 : 0;
          return sum + (itemTotal - discount);
        }, 0);

        const totalTax = body.items.reduce((sum, item) => {
          const itemTotal = item.quantity * parseFloat(item.unitPrice);
          const discount = item.discount ? (itemTotal * item.discount) / 100 : 0;
          const taxableAmount = itemTotal - discount;
          const tax = item.taxRate ? (taxableAmount * item.taxRate) / 100 : 0;
          return sum + tax;
        }, 0);

        const totalAmount = subtotal + totalTax;

        updateData.subtotal = subtotal.toFixed(2);
        updateData.totalTax = totalTax.toFixed(2);
        updateData.totalAmount = totalAmount.toFixed(2);

        // Insert new items
        const itemsData = body.items.map((item) => {
          const itemTotal = item.quantity * parseFloat(item.unitPrice);
          const discount = item.discount ? (itemTotal * item.discount) / 100 : 0;
          const taxableAmount = itemTotal - discount;
          const tax = item.taxRate ? (taxableAmount * item.taxRate) / 100 : 0;
          const total = taxableAmount + tax;

          return {
            invoiceId,
            productId: item.productId,
            productName: item.productName,
            description: item.description,
            quantity: String(item.quantity),
            unit: item.unit ?? "pcs",
            unitPrice: item.unitPrice,
            discount: String(item.discount || 0),
            vatRate: String(item.taxRate || 0),
            total: total.toFixed(2),
          };
        });

        await tx.insert(invoiceItemsImproved).values(itemsData);
      }

      const [updated] = await tx
        .update(invoicesImproved)
        .set(updateData)
        .where(eq(invoicesImproved.id, invoiceId))
        .returning();

      logger.info({ invoiceId, userId: user.id }, "Invoice updated");

      return c.json({
        success: true,
        data: updated,
      });
    });
  } catch (error: unknown) {
    logger.error({ error }, "Failed to update invoice");
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// ============================================
// INVOICES - DELETE
// ============================================

app.delete("/api/v1/invoices/:id", async (c) => {
  try {
    const user = c.get("user");
    const invoiceId = c.req.param("id");

    // Check invoice exists and belongs to tenant
    const [existing] = await db
      .select()
      .from(invoicesImproved)
      .where(and(eq(invoicesImproved.id, invoiceId), eq(invoicesImproved.tenantId, user.tenantId)));

    if (!existing) {
      return c.json({ error: "Invoice not found" }, 404);
    }

    if (existing.status === "paid" || existing.status === "partially_paid") {
      return c.json({ error: "Cannot delete paid or partially paid invoice" }, 400);
    }

    // Delete invoice (cascade will delete items and invoice_orders)
    await db.delete(invoicesImproved).where(eq(invoicesImproved.id, invoiceId));

    logger.info({ invoiceId, userId: user.id }, "Invoice deleted");

    return c.json({
      success: true,
      message: "Invoice deleted successfully",
    });
  } catch (error: unknown) {
    logger.error({ error }, "Failed to delete invoice");
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

// ============================================
// WORKFLOW: CONSOLIDATED INVOICE
// ============================================

const consolidatedInvoiceSchema = z.object({
  orders: z
    .array(
      z.object({
        orderId: z.string().uuid(),
        amountAllocated: z.string().optional(),
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

app.post(
  "/api/v1/invoices/consolidated",
  zValidator("json", consolidatedInvoiceSchema),
  async (c) => {
    try {
      const user = c.get("user");
      const body = c.req.valid("json");

      const invoiceId = await createConsolidatedInvoice({
        tenantId: user.tenantId,
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

      return c.json({
        success: true,
        data: { invoiceId },
      });
    } catch (error: unknown) {
      logger.error({ error }, "Failed to create consolidated invoice");
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 400);
    }
  }
);

export default app;
