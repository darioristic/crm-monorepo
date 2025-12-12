/**
 * Document Extraction Schema
 * Zod schemas for structured document extraction with Gemini AI
 * Based on Midday's implementation
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

/**
 * Invoice/Receipt extraction schema
 * Combined schema for both invoices and receipts
 */
export const documentExtractionSchema = z.object({
  // Vendor/Store information
  vendor_name: z
    .string()
    .nullable()
    .describe(
      "The legal registered business name of the company issuing the document. Look for names that include entity types like 'Inc.', 'Ltd', 'd.o.o.', 'GmbH', 'LLC', etc. This name is typically found in the letterhead, header, or footer. Do not extract brands, divisions, or 'Trading as' names unless no legal name is visible."
    ),
  vendor_address: z.string().nullable().describe("Complete address of the vendor/store"),
  website: z
    .string()
    .nullable()
    .describe(
      "The root domain name of the vendor (e.g., 'example.com', not 'www.example.com'). If not explicitly mentioned, try to infer it from the vendor's email address. Prioritize the root domain without www or subdomains."
    ),
  email: z.string().nullable().describe("Email address of the vendor/seller"),

  // Document identification
  invoice_number: z
    .string()
    .nullable()
    .describe("Unique identifier for the invoice/receipt (e.g., 'INV-2024-001', 'FAK-123/2024')"),
  date: z
    .string()
    .nullable()
    .describe(
      "Date of the document in ISO 8601 format (YYYY-MM-DD). Convert from any format (DD.MM.YYYY, DD/MM/YYYY, etc.) to YYYY-MM-DD."
    ),
  due_date: z.string().nullable().describe("Payment due date in ISO 8601 format (YYYY-MM-DD)"),

  // Financial information
  currency: z
    .string()
    .describe(
      "Three-letter ISO 4217 currency code (e.g., USD, EUR, RSD, GBP). Infer from currency symbols: € = EUR, $ = USD, £ = GBP, RSD/din = RSD"
    ),
  total_amount: z
    .number()
    .describe(
      "Total amount for the document. For European format (1.234,56), convert to standard decimal (1234.56). Always use positive numbers."
    ),
  subtotal_amount: z.number().nullable().describe("Subtotal amount before tax"),
  tax_amount: z.number().nullable().describe("Tax/VAT/PDV amount"),
  tax_rate: z.number().nullable().describe("Tax rate as a percentage value (e.g., 20 for 20%)"),
  tax_type: taxTypeSchema
    .nullable()
    .describe(
      "The type of tax applied (VAT, GST, Sales Tax, etc.). In EU/Serbia, this is typically 'vat' or PDV."
    ),

  // Document type
  document_type: z
    .enum(["invoice", "receipt", "expense", "other"])
    .describe(
      "Type of document: 'invoice' for formal invoices/bills, 'receipt' for point-of-sale receipts, 'expense' for expense reports"
    ),

  // Customer information (for invoices)
  customer_name: z.string().nullable().describe("Name of the customer/buyer (for invoices)"),
  customer_address: z.string().nullable().describe("Complete address of the customer"),

  // Line items (optional)
  line_items: z
    .array(
      z.object({
        description: z.string().nullable().describe("Description of the item"),
        quantity: z.number().nullable().describe("Quantity of items"),
        unit_price: z.number().nullable().describe("Price per unit"),
        total_price: z.number().nullable().describe("Total price for this line item"),
      })
    )
    .optional()
    .describe("Array of items listed in the document (extract if clearly visible)"),

  // Payment information
  payment_method: z
    .string()
    .nullable()
    .describe("Method of payment (e.g., bank_transfer, credit_card, cash)"),
  iban: z.string().nullable().describe("IBAN for bank transfer payments"),
  reference_number: z.string().nullable().describe("Payment reference number"),

  // Additional metadata
  notes: z.string().nullable().describe("Any additional notes or comments on the document"),
  language: z
    .string()
    .nullable()
    .describe("The language of the document (e.g., 'english', 'serbian', 'german')"),
});

export type DocumentExtractionResult = z.infer<typeof documentExtractionSchema>;

/**
 * Extraction configuration
 */
export const EXTRACTION_CONFIG = {
  primaryModel: "gemini-2.0-flash-exp",
  fallbackModel: "gemini-1.5-flash",
  timeout: 60000, // 60 seconds
  retries: 2,
  temperature: 0.1,
  qualityThreshold: 0.7,
  criticalFields: ["total_amount", "currency", "vendor_name", "date"],
} as const;
