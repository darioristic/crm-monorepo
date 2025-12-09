/**
 * Sales Routes Validation Schemas
 */

import { z } from "zod";

// ============================================
// Shared Schemas
// ============================================

const itemSchema = z.object({
  id: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  productName: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  quantity: z.number().positive("Quantity must be positive"),
  unitPrice: z.number().nonnegative("Unit price must be non-negative"),
  taxRate: z.number().min(0).max(100).optional(),
  discount: z.number().min(0).max(100).optional(),
});

// ============================================
// Quote Validation Schemas
// ============================================

export const createQuoteSchema = z.object({
  customerCompanyId: z.string().uuid("Invalid customer company ID"),
  issueDate: z.string().datetime().or(z.date()),
  validUntil: z.string().datetime().or(z.date()),
  items: z.array(itemSchema).min(1, "At least one item is required"),
  notes: z.string().optional(),
  terms: z.string().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  discount: z.number().min(0).optional(), // Allow absolute amounts, not just percentages
  status: z.enum(["draft", "sent", "accepted", "rejected"]).optional(),
  createdBy: z.string().uuid().optional(),
});

export const updateQuoteSchema = z.object({
  companyId: z.string().uuid("Invalid company ID").optional(),
  issueDate: z.string().datetime().or(z.date()).optional(),
  validUntil: z.string().datetime().or(z.date()).optional(),
  items: z.array(itemSchema).optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  discount: z.number().min(0).optional(), // Allow absolute amounts, not just percentages
  status: z.enum(["draft", "sent", "accepted", "rejected"]).optional(),
});

// ============================================
// Invoice Validation Schemas
// ============================================

export const createInvoiceSchema = z.object({
  customerCompanyId: z.string().uuid("Invalid customer company ID"),
  issueDate: z.string().datetime().or(z.date()),
  dueDate: z.string().datetime().or(z.date()).optional(),
  items: z.array(itemSchema).min(1, "At least one item is required"),
  notes: z.string().optional(),
  terms: z.string().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  discount: z.number().min(0).optional(), // Allow absolute amounts, not just percentages
  status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).optional(),
  paymentTerms: z.number().int().nonnegative().optional(),
  createdBy: z.string().uuid().optional(),
});

export const updateInvoiceSchema = z.object({
  companyId: z.string().uuid("Invalid company ID").optional(),
  issueDate: z.string().datetime().or(z.date()).optional(),
  dueDate: z.string().datetime().or(z.date()).optional(),
  items: z.array(itemSchema).optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  discount: z.number().min(0).optional(), // Allow absolute amounts, not just percentages
  status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).optional(),
  paymentTerms: z.number().int().nonnegative().optional(),
});

export const recordPaymentSchema = z.object({
  amount: z.number().positive("Payment amount must be positive"),
});

// ============================================
// Delivery Note Validation Schemas
// ============================================

export const createDeliveryNoteSchema = z.object({
  customerCompanyId: z.string().uuid("Invalid customer company ID"),
  deliveryDate: z.string().datetime().or(z.date()),
  items: z.array(itemSchema).min(1, "At least one item is required"),
  notes: z.string().optional(),
  status: z.enum(["draft", "pending", "delivered", "cancelled"]).optional(),
  shippingAddress: z.string().optional(),
  createdBy: z.string().uuid().optional(),
});

export const updateDeliveryNoteSchema = z.object({
  companyId: z.string().uuid("Invalid company ID").optional(),
  deliveryDate: z.string().datetime().or(z.date()).optional(),
  items: z.array(itemSchema).optional(),
  notes: z.string().optional(),
  status: z.enum(["draft", "pending", "delivered", "cancelled"]).optional(),
  shippingAddress: z.string().optional(),
});

// ============================================
// Workflow Conversion Schemas
// ============================================

export const convertToOrderSchema = z.object({
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

export const convertToInvoiceSchema = z.object({
  customizations: z
    .object({
      invoiceNumber: z.string().optional(),
      issueDate: z.string().datetime().optional(),
      dueDate: z.string().datetime().optional(),
      paymentTerms: z.number().int().nonnegative().optional(),
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

export const convertToDeliveryNoteSchema = z.object({
  customizations: z
    .object({
      deliveryNumber: z.string().optional(),
      deliveryDate: z.string().datetime().optional(),
      shipDate: z.string().datetime().optional(),
      shippingAddress: z.string().optional(),
      carrier: z.string().optional(),
      trackingNumber: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
});
