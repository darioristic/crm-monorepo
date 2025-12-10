/**
 * Document Processing Schemas
 *
 * Zod schemas for AI-extracted document data
 */

import { z } from "zod";

export const taxTypeSchema = z.enum([
  "vat",
  "sales_tax",
  "gst",
  "withholding_tax",
  "service_tax",
  "excise_tax",
  "reverse_charge",
  "custom_tax",
]);

export const invoiceSchema = z.object({
  invoice_number: z.string().nullable().describe("Unique identifier for the invoice"),
  invoice_date: z.string().nullable().describe("Date of invoice in ISO 8601 format (YYYY-MM-DD)"),
  due_date: z.string().nullable().describe("Payment due date in ISO 8601 format (YYYY-MM-DD)"),
  currency: z.string().describe("Three-letter ISO 4217 currency code (e.g., USD, EUR, RSD)"),
  total_amount: z.number().describe("Total amount for the invoice"),
  tax_amount: z.number().nullable().describe("Tax amount for the invoice"),
  tax_rate: z.number().nullable().describe("Tax rate as a percentage value (e.g., 20 for 20%)"),
  tax_type: taxTypeSchema.nullable().describe("The type of tax applied to the invoice"),
  vendor_name: z
    .string()
    .nullable()
    .describe(
      "The legal registered business name of the company issuing the invoice. Look for names that include entity types like 'Inc.', 'Ltd', 'd.o.o.', 'GmbH', 'LLC', etc."
    ),
  vendor_address: z.string().nullable().describe("Complete address of the vendor"),
  customer_name: z.string().nullable().describe("Name of the customer/buyer"),
  customer_address: z.string().nullable().describe("Complete address of the customer"),
  website: z
    .string()
    .nullable()
    .describe("The root domain name of the vendor (e.g., 'example.com', not 'www.example.com')"),
  email: z.string().nullable().describe("Email of the vendor/seller"),
  line_items: z
    .array(
      z.object({
        description: z.string().nullable().describe("Description of the item"),
        quantity: z.number().nullable().describe("Quantity of items"),
        unit_price: z.number().nullable().describe("Price per unit"),
        total_price: z.number().nullable().describe("Total price for this line item"),
      })
    )
    .describe("Array of items listed in the document"),
  payment_instructions: z.string().nullable().describe("Payment terms or instructions"),
  notes: z.string().nullable().describe("Additional notes or comments"),
  language: z
    .string()
    .nullable()
    .describe(
      "The language of the document as a PostgreSQL text search configuration name (e.g., 'english', 'serbian', 'german')"
    ),
});

export const receiptSchema = z.object({
  date: z.string().nullable().describe("Date of receipt in ISO 8601 format (YYYY-MM-DD)"),
  currency: z.string().describe("Three-letter ISO 4217 currency code (e.g., USD, EUR, RSD)"),
  total_amount: z.number().describe("Total amount including tax"),
  subtotal_amount: z.number().nullable().describe("Subtotal amount before tax"),
  tax_amount: z.number().describe("Tax amount"),
  tax_rate: z.number().optional().describe("Tax rate percentage (e.g., 20 for 20%)"),
  tax_type: taxTypeSchema.nullable().describe("The type of tax applied to the receipt"),
  store_name: z.string().nullable().describe("Name of the store/merchant"),
  website: z.string().nullable().describe("Website URL of the store/merchant"),
  payment_method: z
    .string()
    .nullable()
    .describe("Method of payment (e.g., cash, credit card, debit card)"),
  items: z
    .array(
      z.object({
        description: z.string().nullable().describe("Description of the item"),
        quantity: z.number().nullable().describe("Quantity of items"),
        unit_price: z.number().nullable().describe("Price per unit"),
        total_price: z.number().nullable().describe("Total price for this item"),
        discount: z.number().nullable().describe("Discount amount applied to this item if any"),
      })
    )
    .describe("Array of items purchased"),
  cashier_name: z.string().nullable().describe("Name or ID of the cashier"),
  email: z.string().nullable().describe("Email of the store/merchant"),
  register_number: z.string().nullable().describe("POS terminal or register number"),
  language: z
    .string()
    .nullable()
    .describe(
      "The language of the document as a PostgreSQL text search configuration name (e.g., 'english', 'serbian', 'german')"
    ),
});

export const documentClassifierSchema = z.object({
  title: z.string().nullable().describe("The title of the document."),
  summary: z
    .string()
    .nullable()
    .describe("A brief, one-sentence summary of the document's main purpose or content."),
  tags: z
    .array(z.string())
    .max(5)
    .nullable()
    .describe(
      "Up to 5 relevant keywords or phrases for classifying and searching the document (e.g., 'Invoice', 'Contract', 'Report')."
    ),
  date: z
    .string()
    .nullable()
    .describe(
      "The single most relevant date found in the document in ISO 8601 format (YYYY-MM-DD)"
    ),
  language: z
    .string()
    .nullable()
    .describe(
      "The language of the document as a PostgreSQL text search configuration name (e.g., 'english', 'serbian', 'german')"
    ),
});

export const imageClassifierSchema = z.object({
  title: z.string().nullable().describe("The title of the document."),
  summary: z
    .string()
    .nullable()
    .describe(
      "A brief, one-sentence summary identifying key business-related visual elements in the image."
    ),
  tags: z
    .array(z.string())
    .max(5)
    .nullable()
    .describe(
      "Up to 5 relevant keywords describing business-related visual content (e.g., 'Logo', 'Invoice', 'Receipt')."
    ),
  content: z.string().nullable().describe("The extracted text content of the document."),
  language: z
    .string()
    .nullable()
    .describe("The language of the document as a PostgreSQL text search configuration name"),
  date: z
    .string()
    .nullable()
    .describe(
      "The single most relevant date found in the document in ISO 8601 format (YYYY-MM-DD)"
    ),
});

export type InvoiceData = z.infer<typeof invoiceSchema>;
export type ReceiptData = z.infer<typeof receiptSchema>;
export type DocumentClassifierData = z.infer<typeof documentClassifierSchema>;
export type ImageClassifierData = z.infer<typeof imageClassifierSchema>;
