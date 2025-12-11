import { z } from "zod";

/**
 * Shared line item schema for all document types (Invoice, Quote, Order)
 * Used to validate individual line items in documents
 */
export const lineItemSchema = z.object({
  name: z.string().default(""),
  /** Product description - shown below name in gray */
  description: z.string().optional(),
  quantity: z.number().min(0, "Quantity must be at least 0").default(1),
  unit: z.string().optional().default("pcs"),
  price: z.number().default(0),
  productId: z.string().optional(),
  /** Discount percentage for this line item (0-100) */
  discount: z
    .preprocess(
      (v) => (typeof v === "number" && Number.isNaN(v) ? 0 : v),
      z.number().min(0).max(100)
    )
    .optional()
    .default(0),
  /** VAT percentage for this line item */
  vat: z
    .preprocess(
      (v) => (typeof v === "number" && Number.isNaN(v) ? 20 : v),
      z.number().min(0).max(100)
    )
    .optional()
    .default(20),
});

export type LineItem = z.infer<typeof lineItemSchema>;
