/**
 * Document Workflow Service
 *
 * Handles cross-document workflows for Quote → Order → Invoice chains
 * Supports:
 * - Quote to Order conversion
 * - Quote to Invoice conversion (direct)
 * - Order to Invoice conversion
 * - Multi-order consolidated invoicing
 * - Partial order invoicing
 */

import type { DeliveryNote, DeliveryNoteItem } from "@crm/types";
import { and, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../db/client";
import {
  type InvoiceImproved,
  invoiceItemsImproved,
  invoiceOrders,
  invoicesImproved,
  type OrderImproved,
  type OrderItemImproved,
  orderItemsImproved,
  ordersImproved,
  type QuoteImproved,
  type QuoteItemImproved,
  quoteItemsImproved,
  quotesImproved,
} from "../db/schema/improved-sales";
import { logger } from "../lib/logger";

// ============================================
// Quote to Order Conversion
// ============================================

interface ConvertQuoteToOrderInput {
  quoteId: string;
  userId: string;
  tenantId: string;
  customizations?: {
    orderNumber?: string;
    orderDate?: Date;
    expectedDeliveryDate?: Date;
    notes?: string;
    purchaseOrderNumber?: string;
  };
}

export async function convertQuoteToOrder(input: ConvertQuoteToOrderInput): Promise<OrderImproved> {
  const { quoteId, userId, tenantId, customizations } = input;

  return await db.transaction(async (tx) => {
    // 1. Fetch quote with items
    const [quote] = await tx
      .select()
      .from(quotesImproved)
      .where(and(eq(quotesImproved.id, quoteId), eq(quotesImproved.tenantId, tenantId)));

    if (!quote) {
      throw new Error(`Quote ${quoteId} not found`);
    }

    if (quote.status === "converted") {
      throw new Error(`Quote ${quote.quoteNumber} has already been converted`);
    }

    const quoteItems = await tx
      .select()
      .from(quoteItemsImproved)
      .where(eq(quoteItemsImproved.quoteId, quoteId));

    // 2. Create order from quote
    const orderNumber = customizations?.orderNumber ?? `ORD-${nanoid(10).toUpperCase()}`;

    const [order] = await tx
      .insert(ordersImproved)
      .values({
        orderNumber,
        tenantId,
        companyId: quote.companyId,
        contactId: quote.contactId,
        quoteId: quote.id,
        status: "pending",
        orderDate: customizations?.orderDate ?? new Date(),
        expectedDeliveryDate: customizations?.expectedDeliveryDate,
        subtotal: quote.subtotal,
        taxRate: quote.taxRate,
        tax: quote.tax,
        discount: quote.discount,
        total: quote.total,
        currency: quote.currency,
        remainingAmount: quote.total,
        notes: customizations?.notes ?? quote.notes,
        terms: quote.terms,
        purchaseOrderNumber: customizations?.purchaseOrderNumber,
        fromDetails: quote.fromDetails,
        customerDetails: quote.customerDetails,
        createdBy: userId,
      })
      .returning();

    // 3. Create order items from quote items
    const orderItemsData = quoteItems.map((item, index) => ({
      orderId: order.id,
      quoteItemId: item.id,
      productId: item.productId || null,
      productName: item.productName,
      description: item.description,
      sku: item.sku,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      discount: item.discount,
      taxRate: item.taxRate,
      total: item.total,
      sortOrder: index,
    }));

    await tx.insert(orderItemsImproved).values(orderItemsData);

    // 4. Update quote status
    await tx
      .update(quotesImproved)
      .set({
        status: "converted",
        convertedToOrderAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(quotesImproved.id, quoteId));

    logger.info(`Converted quote ${quote.quoteNumber} to order ${orderNumber}`);

    return order;
  });
}

// ============================================
// Quote to Invoice Conversion (Direct)
// ============================================

interface ConvertQuoteToInvoiceInput {
  quoteId: string;
  userId: string;
  tenantId: string;
  customizations?: {
    invoiceNumber?: string;
    issueDate?: Date;
    dueDate?: Date;
    paymentTerms?: number;
    notes?: string;
  };
}

export async function convertQuoteToInvoice(input: ConvertQuoteToInvoiceInput): Promise<string> {
  const { quoteId, userId, tenantId, customizations } = input;

  return await db.transaction(async (tx) => {
    // 1. Fetch quote with items
    const [quote] = await tx
      .select()
      .from(quotesImproved)
      .where(and(eq(quotesImproved.id, quoteId), eq(quotesImproved.tenantId, tenantId)));

    if (!quote) {
      throw new Error(`Quote ${quoteId} not found`);
    }

    if (quote.status === "converted") {
      throw new Error(`Quote ${quote.quoteNumber} has already been converted`);
    }

    const quoteItems = await tx
      .select()
      .from(quoteItemsImproved)
      .where(eq(quoteItemsImproved.quoteId, quoteId));

    // 2. Create invoice from quote
    const invoiceNumber = customizations?.invoiceNumber ?? `INV-${nanoid(10).toUpperCase()}`;
    const issueDate = customizations?.issueDate ?? new Date();
    const paymentTerms = customizations?.paymentTerms ?? 30;
    const dueDate =
      customizations?.dueDate ?? new Date(issueDate.getTime() + paymentTerms * 24 * 60 * 60 * 1000);

    const [invoice] = await tx
      .insert(invoicesImproved)
      .values({
        invoiceNumber,
        tenantId,
        companyId: quote.companyId,
        contactId: quote.contactId,
        quoteId: quote.id,
        status: "draft",
        issueDate,
        dueDate,
        paymentTerms,
        grossTotal: quote.total,
        subtotal: quote.subtotal,
        taxRate: quote.taxRate,
        tax: quote.tax,
        discount: quote.discount,
        total: quote.total,
        remainingAmount: quote.total,
        currency: quote.currency,
        notes: customizations?.notes ?? quote.notes,
        terms: quote.terms,
        fromDetails: quote.fromDetails,
        customerDetails: quote.customerDetails,
        token: nanoid(32),
        createdBy: userId,
      })
      .returning();

    // 3. Create invoice items from quote items
    const invoiceItemsData = quoteItems.map((item, index) => ({
      invoiceId: invoice.id,
      quoteItemId: item.id,
      productId: item.productId || null,
      productName: item.productName,
      description: item.description,
      sku: item.sku,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      discount: item.discount,
      vatRate: item.taxRate,
      total: item.total,
      sortOrder: index,
    }));

    await tx.insert(invoiceItemsImproved).values(invoiceItemsData);

    // 4. Update quote status
    await tx
      .update(quotesImproved)
      .set({
        status: "converted",
        convertedToInvoiceAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(quotesImproved.id, quoteId));

    logger.info(`Converted quote ${quote.quoteNumber} to invoice ${invoiceNumber}`);

    return invoice.id;
  });
}

// ============================================
// Order to Invoice Conversion (Single Order)
// ============================================

interface ConvertOrderToInvoiceInput {
  orderId: string;
  userId: string;
  tenantId: string;
  customizations?: {
    invoiceNumber?: string;
    issueDate?: Date;
    dueDate?: Date;
    paymentTerms?: number;
    notes?: string;
    partial?: {
      percentage?: number; // 0-100
      amount?: string; // specific amount
    };
  };
}

export async function convertOrderToInvoice(input: ConvertOrderToInvoiceInput): Promise<string> {
  const { orderId, userId, tenantId, customizations } = input;

  return await db.transaction(async (tx) => {
    // 1. Fetch order with items
    const [order] = await tx
      .select()
      .from(ordersImproved)
      .where(and(eq(ordersImproved.id, orderId), eq(ordersImproved.tenantId, tenantId)));

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    const orderItems = await tx
      .select()
      .from(orderItemsImproved)
      .where(eq(orderItemsImproved.orderId, orderId));

    // 2. Calculate invoice amount
    let amountToInvoice: string;

    if (customizations?.partial?.amount) {
      amountToInvoice = customizations.partial.amount;
    } else if (customizations?.partial?.percentage) {
      const percentage = customizations.partial.percentage / 100;
      amountToInvoice = (parseFloat(order.total) * percentage).toFixed(2);
    } else {
      // Full order amount - already invoiced
      const remaining = parseFloat(order.remainingAmount);
      if (remaining <= 0) {
        throw new Error(`Order ${order.orderNumber} has already been fully invoiced`);
      }
      amountToInvoice = order.remainingAmount;
    }

    // 3. Create invoice
    const invoiceNumber = customizations?.invoiceNumber ?? `INV-${nanoid(10).toUpperCase()}`;
    const issueDate = customizations?.issueDate ?? new Date();
    const paymentTerms = customizations?.paymentTerms ?? 30;
    const dueDate =
      customizations?.dueDate ?? new Date(issueDate.getTime() + paymentTerms * 24 * 60 * 60 * 1000);

    const [invoice] = await tx
      .insert(invoicesImproved)
      .values({
        invoiceNumber,
        tenantId,
        companyId: order.companyId,
        contactId: order.contactId,
        quoteId: order.quoteId,
        status: "draft",
        issueDate,
        dueDate,
        paymentTerms,
        grossTotal: amountToInvoice,
        subtotal: amountToInvoice,
        total: amountToInvoice,
        remainingAmount: amountToInvoice,
        currency: order.currency,
        notes: customizations?.notes ?? order.notes,
        terms: order.terms,
        fromDetails: order.fromDetails,
        customerDetails: order.customerDetails,
        token: nanoid(32),
        createdBy: userId,
      })
      .returning();

    // 4. Link order to invoice via bridge table
    await tx.insert(invoiceOrders).values({
      invoiceId: invoice.id,
      orderId: order.id,
      amountAllocated: amountToInvoice,
      createdBy: userId,
    });

    // 5. Create invoice items from order items (proportional if partial)
    const isPartial = parseFloat(amountToInvoice) < parseFloat(order.total);
    const ratio = isPartial ? parseFloat(amountToInvoice) / parseFloat(order.total) : 1;

    const invoiceItemsData = orderItems.map((item, index) => {
      const adjustedQuantity = isPartial
        ? (parseFloat(item.quantity) * ratio).toFixed(2)
        : item.quantity;
      const adjustedTotal = isPartial ? (parseFloat(item.total) * ratio).toFixed(2) : item.total;

      return {
        invoiceId: invoice.id,
        orderItemId: item.id,
        quoteItemId: item.quoteItemId || null,
        productId: item.productId || null,
        productName: item.productName,
        description: item.description,
        sku: item.sku,
        quantity: adjustedQuantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        discount: item.discount,
        vatRate: item.taxRate,
        total: adjustedTotal,
        sortOrder: index,
      };
    });

    await tx.insert(invoiceItemsImproved).values(invoiceItemsData);

    // The trigger will automatically update order.invoicedAmount and order.status

    logger.info(
      `Created invoice ${invoiceNumber} from order ${order.orderNumber} (amount: ${amountToInvoice})`
    );

    return invoice.id;
  });
}

// ============================================
// Consolidated Multi-Order Invoice
// ============================================

interface CreateConsolidatedInvoiceInput {
  tenantId: string;
  userId: string;
  orders: Array<{
    orderId: string;
    amountAllocated?: string; // if not provided, uses remaining amount
  }>;
  customizations?: {
    invoiceNumber?: string;
    issueDate?: Date;
    dueDate?: Date;
    paymentTerms?: number;
    notes?: string;
  };
}

export async function createConsolidatedInvoice(
  input: CreateConsolidatedInvoiceInput
): Promise<string> {
  const { tenantId, userId, orders: orderInputs, customizations } = input;

  if (orderInputs.length === 0) {
    throw new Error("At least one order is required");
  }

  return await db.transaction(async (tx) => {
    // 1. Fetch all orders
    const orderIds = orderInputs.map((o) => o.orderId);
    const orders = await tx
      .select()
      .from(ordersImproved)
      .where(and(inArray(ordersImproved.id, orderIds), eq(ordersImproved.tenantId, tenantId)));

    if (orders.length !== orderIds.length) {
      throw new Error("One or more orders not found");
    }

    // Verify all orders belong to same company
    const companyIds = new Set(orders.map((o) => o.companyId));
    if (companyIds.size > 1) {
      throw new Error("Cannot consolidate orders from different companies");
    }

    const companyId = orders[0].companyId;
    const currency = orders[0].currency;

    // 2. Calculate total invoice amount
    let totalAmount = 0;
    const orderAllocations: Array<{ orderId: string; amount: string }> = [];

    for (const orderInput of orderInputs) {
      const order = orders.find((o) => o.id === orderInput.orderId)!;
      const allocatedAmount = orderInput.amountAllocated
        ? parseFloat(orderInput.amountAllocated)
        : parseFloat(order.remainingAmount);

      if (allocatedAmount > parseFloat(order.remainingAmount)) {
        throw new Error(
          `Order ${order.orderNumber} has only ${order.remainingAmount} remaining, cannot allocate ${allocatedAmount}`
        );
      }

      totalAmount += allocatedAmount;
      orderAllocations.push({
        orderId: order.id,
        amount: allocatedAmount.toFixed(2),
      });
    }

    // 3. Create invoice
    const invoiceNumber = customizations?.invoiceNumber ?? `INV-${nanoid(10).toUpperCase()}`;
    const issueDate = customizations?.issueDate ?? new Date();
    const paymentTerms = customizations?.paymentTerms ?? 30;
    const dueDate =
      customizations?.dueDate ?? new Date(issueDate.getTime() + paymentTerms * 24 * 60 * 60 * 1000);

    const [invoice] = await tx
      .insert(invoicesImproved)
      .values({
        invoiceNumber,
        tenantId,
        companyId,
        status: "draft",
        issueDate,
        dueDate,
        paymentTerms,
        grossTotal: totalAmount.toFixed(2),
        subtotal: totalAmount.toFixed(2),
        total: totalAmount.toFixed(2),
        remainingAmount: totalAmount.toFixed(2),
        currency,
        notes: customizations?.notes,
        token: nanoid(32),
        createdBy: userId,
      })
      .returning();

    // 4. Link all orders to invoice
    const invoiceOrdersData = orderAllocations.map((alloc) => ({
      invoiceId: invoice.id,
      orderId: alloc.orderId,
      amountAllocated: alloc.amount,
      createdBy: userId,
    }));

    await tx.insert(invoiceOrders).values(invoiceOrdersData);

    // 5. Aggregate items from all orders
    const allOrderItems = await tx
      .select()
      .from(orderItemsImproved)
      .where(inArray(orderItemsImproved.orderId, orderIds));

    // Group items by product
    const itemsMap = new Map<
      string,
      {
        productId: string | null;
        productName: string;
        description: string | null;
        sku: string | null;
        unit: string;
        unitPrice: string;
        quantity: number;
        total: number;
      }
    >();

    for (const item of allOrderItems) {
      const key = item.productId || item.productName;
      const existing = itemsMap.get(key);

      if (existing) {
        existing.quantity += parseFloat(item.quantity);
        existing.total += parseFloat(item.total);
      } else {
        itemsMap.set(key, {
          productId: item.productId,
          productName: item.productName,
          description: item.description,
          sku: item.sku,
          unit: item.unit,
          unitPrice: item.unitPrice,
          quantity: parseFloat(item.quantity),
          total: parseFloat(item.total),
        });
      }
    }

    // 6. Create aggregated invoice items
    const invoiceItemsData = Array.from(itemsMap.values()).map((item, index) => ({
      invoiceId: invoice.id,
      productId: item.productId || null,
      productName: item.productName,
      description: item.description,
      sku: item.sku,
      quantity: item.quantity.toFixed(2),
      unit: item.unit,
      unitPrice: item.unitPrice,
      total: item.total.toFixed(2),
      sortOrder: index,
    }));

    await tx.insert(invoiceItemsImproved).values(invoiceItemsData);

    logger.info(`Created consolidated invoice ${invoiceNumber} from ${orders.length} orders`);

    return invoice.id;
  });
}

// ============================================
// Helper: Get Document Chain
// ============================================

interface DocumentChain {
  quote?: QuoteImproved & { items: QuoteItemImproved[] };
  orders: Array<OrderImproved & { items: OrderItemImproved[] }>;
  invoices: Array<InvoiceImproved>;
}

export async function getDocumentChain(quoteId: string, tenantId: string): Promise<DocumentChain> {
  // Fetch quote
  const [quote] = await db
    .select()
    .from(quotesImproved)
    .where(and(eq(quotesImproved.id, quoteId), eq(quotesImproved.tenantId, tenantId)));

  if (!quote) {
    throw new Error(`Quote ${quoteId} not found`);
  }

  const quoteItems = await db
    .select()
    .from(quoteItemsImproved)
    .where(eq(quoteItemsImproved.quoteId, quoteId));

  // Fetch orders from quote
  const orders = await db
    .select()
    .from(ordersImproved)
    .where(and(eq(ordersImproved.quoteId, quoteId), eq(ordersImproved.tenantId, tenantId)));

  const ordersWithItems = await Promise.all(
    orders.map(async (order) => {
      const items = await db
        .select()
        .from(orderItemsImproved)
        .where(eq(orderItemsImproved.orderId, order.id));
      return { ...order, items };
    })
  );

  // Fetch invoices (from quote and from orders)
  const orderIds = orders.map((o) => o.id);

  const invoicesFromQuote = await db
    .select()
    .from(invoicesImproved)
    .where(and(eq(invoicesImproved.quoteId, quoteId), eq(invoicesImproved.tenantId, tenantId)));

  const invoicesFromOrders =
    orderIds.length > 0
      ? await db
          .select({
            invoice: invoicesImproved,
            invoiceOrder: invoiceOrders,
          })
          .from(invoiceOrders)
          .innerJoin(invoicesImproved, eq(invoiceOrders.invoiceId, invoicesImproved.id))
          .where(inArray(invoiceOrders.orderId, orderIds))
      : [];

  const allInvoices = [...invoicesFromQuote, ...invoicesFromOrders.map((r) => r.invoice)];

  // Remove duplicates
  const uniqueInvoices = Array.from(new Map(allInvoices.map((inv) => [inv.id, inv])).values());

  return {
    quote: { ...quote, items: quoteItems },
    orders: ordersWithItems,
    invoices: uniqueInvoices,
  };
}

// ============================================
// Order to Delivery Note Conversion
// ============================================

interface ConvertOrderToDeliveryNoteInput {
  orderId: string;
  userId: string;
  tenantId: string;
  customizations?: {
    deliveryNumber?: string;
    deliveryDate?: Date;
    shipDate?: Date;
    shippingAddress?: string;
    carrier?: string;
    trackingNumber?: string;
    notes?: string;
  };
}

export async function convertOrderToDeliveryNote(
  input: ConvertOrderToDeliveryNoteInput
): Promise<string> {
  const { orderId, userId, tenantId, customizations } = input;

  return await db.transaction(async (tx) => {
    // 1. Fetch order with items
    const [order] = await tx
      .select()
      .from(ordersImproved)
      .where(and(eq(ordersImproved.id, orderId), eq(ordersImproved.tenantId, tenantId)));

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    const orderItems = await tx
      .select()
      .from(orderItemsImproved)
      .where(eq(orderItemsImproved.orderId, orderId));

    // 2. Create delivery note from order
    const deliveryNumber = customizations?.deliveryNumber ?? `DN-${nanoid(10).toUpperCase()}`;

    const { deliveryNoteQueries } = await import("../db/queries/delivery-notes");

    const deliveryNoteData: Omit<DeliveryNote, "items"> & { sellerCompanyId?: string } = {
      id: nanoid(),
      deliveryNumber,
      companyId: order.companyId,
      contactId: order.contactId ?? undefined,
      status: "pending",
      shipDate: (customizations?.shipDate ?? new Date()).toISOString(),
      deliveryDate: customizations?.deliveryDate
        ? customizations.deliveryDate.toISOString()
        : undefined,
      shippingAddress: customizations?.shippingAddress ?? "",
      trackingNumber: customizations?.trackingNumber ?? undefined,
      carrier: customizations?.carrier ?? undefined,
      taxRate: Number(order.taxRate ?? 0),
      subtotal: Number(order.subtotal),
      tax: Number(order.tax ?? 0),
      total: Number(order.total),
      notes: customizations?.notes ?? order.notes ?? undefined,
      terms: order.terms ?? undefined,
      customerDetails: order.customerDetails ?? null,
      fromDetails: order.fromDetails ?? null,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sellerCompanyId: tenantId,
      invoiceId: undefined,
    };

    const deliveryNoteItems: Omit<DeliveryNoteItem, "id" | "deliveryNoteId">[] = orderItems.map(
      (item) => ({
        productName: item.productName ?? "",
        description: item.description ?? "",
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        unit: item.unit ?? "pcs",
        discount: Number(item.discount ?? 0),
        total: Number(item.total),
      })
    );

    const deliveryNote = await deliveryNoteQueries.create(deliveryNoteData, deliveryNoteItems);

    logger.info(
      { orderId, deliveryNoteId: deliveryNote.id, deliveryNumber },
      "Converted order to delivery note"
    );

    return deliveryNote.id;
  });
}

// ============================================
// Invoice to Delivery Note Conversion
// ============================================

interface ConvertInvoiceToDeliveryNoteInput {
  invoiceId: string;
  userId: string;
  tenantId: string;
  customizations?: {
    deliveryNumber?: string;
    deliveryDate?: Date;
    shipDate?: Date;
    shippingAddress?: string;
    carrier?: string;
    trackingNumber?: string;
    notes?: string;
  };
}

export async function convertInvoiceToDeliveryNote(
  input: ConvertInvoiceToDeliveryNoteInput
): Promise<string> {
  const { invoiceId, userId, tenantId, customizations } = input;

  return await db.transaction(async (tx) => {
    // 1. Fetch invoice with items
    const [invoice] = await tx
      .select()
      .from(invoicesImproved)
      .where(and(eq(invoicesImproved.id, invoiceId), eq(invoicesImproved.tenantId, tenantId)));

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    const invoiceItems = await tx
      .select()
      .from(invoiceItemsImproved)
      .where(eq(invoiceItemsImproved.invoiceId, invoiceId));

    // 2. Create delivery note from invoice
    const deliveryNumber = customizations?.deliveryNumber ?? `DN-${nanoid(10).toUpperCase()}`;

    const { deliveryNoteQueries } = await import("../db/queries/delivery-notes");

    const deliveryNoteData: Omit<DeliveryNote, "items"> & { sellerCompanyId?: string } = {
      id: nanoid(),
      deliveryNumber,
      companyId: invoice.companyId,
      contactId: invoice.contactId ?? undefined,
      invoiceId: invoice.id ?? undefined,
      status: "pending",
      shipDate: (customizations?.shipDate ?? new Date()).toISOString(),
      deliveryDate: customizations?.deliveryDate
        ? customizations.deliveryDate.toISOString()
        : undefined,
      shippingAddress: customizations?.shippingAddress ?? "",
      trackingNumber: customizations?.trackingNumber ?? undefined,
      carrier: customizations?.carrier ?? undefined,
      taxRate: Number(invoice.taxRate ?? 0),
      subtotal: Number(invoice.subtotal),
      tax: Number(invoice.tax ?? 0),
      total: Number(invoice.total),
      notes: customizations?.notes ?? invoice.notes ?? undefined,
      terms: invoice.terms ?? undefined,
      customerDetails: invoice.customerDetails ?? null,
      fromDetails: invoice.fromDetails ?? null,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sellerCompanyId: tenantId,
    };

    const deliveryNoteItems: Omit<DeliveryNoteItem, "id" | "deliveryNoteId">[] = invoiceItems.map(
      (item) => ({
        productName: item.productName ?? "",
        description: item.description ?? "",
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        unit: item.unit ?? "pcs",
        discount: Number(item.discount ?? 0),
        total: Number(item.total),
      })
    );

    const deliveryNote = await deliveryNoteQueries.create(deliveryNoteData, deliveryNoteItems);

    logger.info(
      { invoiceId, deliveryNoteId: deliveryNote.id, deliveryNumber },
      "Converted invoice to delivery note"
    );

    return deliveryNote.id;
  });
}
