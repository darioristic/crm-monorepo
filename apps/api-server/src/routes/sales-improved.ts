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
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "../db/client";
import {
  invoicesImproved,
  ordersImproved,
  organizationRoles,
  quoteItemsImproved,
  quotesImproved,
} from "../db/schema/improved-sales";
import { logger } from "../lib/logger";
import {
  convertQuoteToInvoice,
  convertQuoteToOrder,
  getDocumentChain,
} from "../services/document-workflow.service";

const app = new Hono();

// ============================================
// Middleware: Extract tenant and user from auth
// ============================================

interface AuthContext {
  user: {
    id: string;
    tenantId: string;
    role: string;
    companyId?: string;
  };
}

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
  status: z.string().optional(),
  companyId: z.string().uuid().optional(),
  search: z.string().optional(),
});

app.get("/api/v1/quotes", zValidator("query", getQuotesQuerySchema), async (c) => {
  try {
    const user = c.get("user") as AuthContext["user"];
    const query = c.req.valid("query");
    const offset = (query.page - 1) * query.limit;

    // Build WHERE clause with tenantId (CRITICAL for multi-tenancy)
    const conditions = [eq(quotesImproved.tenantId, user.tenantId)];

    // Filter by status
    if (query.status) {
      conditions.push(eq(quotesImproved.status, query.status as any));
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
  } catch (error: any) {
    logger.error("Failed to fetch quotes", { error });
    return c.json(
      {
        success: false,
        error: error.message,
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
    const user = c.get("user") as AuthContext["user"];
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
  } catch (error: any) {
    logger.error("Failed to fetch quote", { error });
    return c.json({ error: error.message }, 500);
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
    const user = c.get("user") as AuthContext["user"];
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
      const quoteNumber = `QUO-${nanoid(10).toUpperCase()}`;

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

      logger.info("Quote created", { quoteId: quote.id, userId: user.id });

      return c.json({
        success: true,
        data: {
          ...quote,
          items,
        },
      });
    });
  } catch (error: any) {
    logger.error("Failed to create quote", { error });
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// QUOTES - UPDATE
// ============================================

app.put("/api/v1/quotes/:id", zValidator("json", createQuoteSchema.partial()), async (c) => {
  try {
    const user = c.get("user") as AuthContext["user"];
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
      const updateData: any = {
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

      logger.info("Quote updated", { quoteId, userId: user.id });

      return c.json({
        success: true,
        data: updated,
      });
    });
  } catch (error: any) {
    logger.error("Failed to update quote", { error });
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// QUOTES - DELETE
// ============================================

app.delete("/api/v1/quotes/:id", async (c) => {
  try {
    const user = c.get("user") as AuthContext["user"];
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

    logger.info("Quote deleted", { quoteId, userId: user.id });

    return c.json({
      success: true,
      message: "Quote deleted successfully",
    });
  } catch (error: any) {
    logger.error("Failed to delete quote", { error });
    return c.json({ error: error.message }, 500);
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
      const user = c.get("user") as AuthContext["user"];
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
    } catch (error: any) {
      logger.error("Failed to convert quote to order", { error });
      return c.json({ error: error.message }, 400);
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
      const user = c.get("user") as AuthContext["user"];
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
    } catch (error: any) {
      logger.error("Failed to convert quote to invoice", { error });
      return c.json({ error: error.message }, 400);
    }
  }
);

// ============================================
// WORKFLOW: GET DOCUMENT CHAIN
// ============================================

app.get("/api/v1/quotes/:id/chain", async (c) => {
  try {
    const user = c.get("user") as AuthContext["user"];
    const quoteId = c.req.param("id");

    const chain = await getDocumentChain(quoteId, user.tenantId);

    return c.json({
      success: true,
      data: chain,
    });
  } catch (error: any) {
    logger.error("Failed to get document chain", { error });
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// ORDERS - Similar pattern as quotes
// ============================================

// GET /api/v1/orders - List orders with tenant isolation
// GET /api/v1/orders/:id - Get order with items
// POST /api/v1/orders - Create order
// PUT /api/v1/orders/:id - Update order
// DELETE /api/v1/orders/:id - Delete order
// POST /api/v1/orders/:id/convert-to-invoice - Convert to invoice

// ============================================
// INVOICES - Similar pattern as quotes
// ============================================

// GET /api/v1/invoices - List invoices with tenant isolation
// GET /api/v1/invoices/:id - Get invoice with items and linked orders
// POST /api/v1/invoices - Create invoice
// PUT /api/v1/invoices/:id - Update invoice
// DELETE /api/v1/invoices/:id - Delete invoice
// POST /api/v1/invoices/consolidated - Create consolidated invoice from multiple orders

export default app;
