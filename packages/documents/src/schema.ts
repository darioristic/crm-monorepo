import { z } from "zod";

export const documentClassifierSchema = z.object({
  type: z.enum(["invoice", "receipt", "contract", "other"]),
  confidence: z.number().min(0).max(1),
  language: z.string().optional(),
});

export const imageClassifierSchema = z.object({
  type: z.enum(["invoice", "receipt", "contract", "other"]),
  confidence: z.number().min(0).max(1),
  language: z.string().optional(),
});

export const invoiceLineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unit_price: z.number(),
  total: z.number(),
  vat_rate: z.number().optional(),
});

export const invoiceSchema = z.object({
  invoice_number: z.string().nullable(),
  invoice_date: z.string().nullable(),
  due_date: z.string().nullable(),
  vendor_name: z.string().nullable(),
  vendor_address: z.string().nullable(),
  customer_name: z.string().nullable(),
  customer_address: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  total_amount: z.number().nullable(),
  currency: z.string().nullable(),
  tax_amount: z.number().nullable(),
  tax_rate: z.number().nullable(),
  tax_type: z.string().nullable(),
  line_items: z.array(invoiceLineItemSchema).default([]),
  payment_instructions: z.string().nullable(),
  notes: z.string().nullable(),
  language: z.string().nullable(),
});

export const receiptSchema = z.object({
  merchant_name: z.string().nullable(),
  merchant_address: z.string().nullable(),
  date: z.string().nullable(),
  total_amount: z.number().nullable(),
  currency: z.string().nullable(),
  tax_amount: z.number().nullable(),
  payment_method: z.string().nullable(),
  items: z
    .array(
      z.object({
        name: z.string(),
        quantity: z.number(),
        price: z.number(),
      })
    )
    .default([]),
  language: z.string().nullable(),
});

