import { z } from "zod";
import { lineItemSchema } from "./line-item";
import {
  type EditorDoc,
  invoiceTemplateSchema,
  orderTemplateSchema,
  quoteTemplateSchema,
} from "./template";

/**
 * Invoice-specific form schema
 */
export const invoiceFormSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["draft", "sent", "paid", "partial", "overdue", "cancelled"]).default("draft"),
  template: invoiceTemplateSchema,
  fromDetails: z.custom<EditorDoc | string | null>().optional(),
  customerDetails: z.custom<EditorDoc | string | null>().optional(),
  customerId: z.string().uuid().nullable().optional(),
  customerName: z.string().nullable().optional(),
  paymentDetails: z.custom<EditorDoc | string | null>().optional(),
  noteDetails: z.custom<EditorDoc | string | null>().optional(),
  dueDate: z.string(),
  issueDate: z.string(),
  invoiceNumber: z.string(),
  logoUrl: z.string().nullable().optional(),
  vat: z.number().nullable().optional().default(0),
  tax: z.number().nullable().optional().default(0),
  discount: z.number().nullable().optional().default(0),
  subtotal: z.number().nullable().optional().default(0),
  topBlock: z.custom<EditorDoc | null>().nullable().optional(),
  bottomBlock: z.custom<EditorDoc | null>().nullable().optional(),
  amount: z.number().default(0),
  lineItems: z.array(lineItemSchema).min(1),
  token: z.string().optional(),
  scheduledAt: z.string().nullable().optional(),
});

/**
 * Quote-specific form schema
 */
export const quoteFormSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["draft", "sent", "accepted", "rejected", "expired"]).default("draft"),
  template: quoteTemplateSchema,
  fromDetails: z.custom<EditorDoc | string | null>().optional(),
  customerDetails: z.custom<EditorDoc | string | null>().optional(),
  customerId: z.string().uuid().optional(),
  customerName: z.string().optional(),
  paymentDetails: z.custom<EditorDoc | string | null>().optional(),
  noteDetails: z.custom<EditorDoc | string | null>().optional(),
  validUntil: z.string(),
  issueDate: z.string(),
  quoteNumber: z.string(),
  logoUrl: z.string().nullable().optional(),
  vat: z.number().nullable().optional().default(0),
  tax: z.number().nullable().optional().default(0),
  discount: z.number().nullable().optional().default(0),
  subtotal: z.number().nullable().optional().default(0),
  topBlock: z.custom<EditorDoc | null>().nullable().optional(),
  bottomBlock: z.custom<EditorDoc | null>().nullable().optional(),
  amount: z.number().default(0),
  lineItems: z.array(lineItemSchema).default([]),
  token: z.string().optional(),
  scheduledAt: z.string().nullable().optional(),
});

/**
 * Order-specific form schema
 */
export const orderFormSchema = z.object({
  id: z.string().uuid(),
  status: z
    .enum(["pending", "processing", "completed", "cancelled", "refunded"])
    .default("pending"),
  template: orderTemplateSchema,
  fromDetails: z.custom<EditorDoc | string | null>().optional(),
  customerDetails: z.custom<EditorDoc | string | null>().optional(),
  customerId: z.string().uuid().optional(),
  customerName: z.string().optional(),
  paymentDetails: z.custom<EditorDoc | string | null>().optional(),
  noteDetails: z.custom<EditorDoc | string | null>().optional(),
  issueDate: z.string(),
  orderNumber: z.string(),
  logoUrl: z.string().nullable().optional(),
  vat: z.number().nullable().optional().default(0),
  tax: z.number().nullable().optional().default(0),
  discount: z.number().nullable().optional().default(0),
  subtotal: z.number().nullable().optional().default(0),
  topBlock: z.custom<EditorDoc | null>().nullable().optional(),
  bottomBlock: z.custom<EditorDoc | null>().nullable().optional(),
  amount: z.number().default(0),
  lineItems: z.array(lineItemSchema).min(1),
  token: z.string().optional(),
  scheduledAt: z.string().nullable().optional(),
});

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;
export type QuoteFormValues = z.infer<typeof quoteFormSchema>;
export type OrderFormValues = z.infer<typeof orderFormSchema>;
