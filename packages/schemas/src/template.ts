import { z } from "zod";

/**
 * EditorDoc type for rich text editor content
 */
export type EditorDoc = {
  type: string;
  content?: EditorDoc[];
  [key: string]: unknown;
};

/**
 * Configuration options for creating a document template schema
 */
export type TemplateSchemaConfig = {
  /** Default title for the document (e.g., "Invoice", "Quote", "Order") */
  defaultTitle: string;
  /** Label for the document number field (e.g., "Invoice No", "Quote No") */
  documentNumberLabel: string;
  /** Optional: Label for the due/valid date field */
  dueDateLabel?: string;
};

/**
 * Creates a document template schema with configurable labels
 * This schema is used across Invoice, Quote, and Order templates
 */
export function createTemplateSchema(config: TemplateSchemaConfig) {
  const baseSchema = {
    title: z.string().optional().default(config.defaultTitle),
    customerLabel: z.string().default("Bill to"),
    fromLabel: z.string().default("From"),
    [config.documentNumberLabel.toLowerCase().replace(/\s+/g, "")]: z
      .string()
      .default(config.documentNumberLabel),
    issueDateLabel: z.string().default("Issue Date"),
    descriptionLabel: z.string().default("Description"),
    priceLabel: z.string().default("Price"),
    quantityLabel: z.string().default("Quantity"),
    totalLabel: z.string().default("Total"),
    totalSummaryLabel: z.string().optional().default("Total"),
    vatLabel: z.string().optional().default("VAT"),
    subtotalLabel: z.string().optional().default("Subtotal"),
    taxLabel: z.string().optional().default("Tax"),
    discountLabel: z.string().optional().default("Discount"),
    paymentLabel: z.string().default("Payment Details"),
    noteLabel: z.string().default("Note"),
    logoUrl: z.string().optional().nullable(),
    currency: z.string().default("EUR"),
    paymentDetails: z.custom<EditorDoc | string | null>().nullable().optional(),
    fromDetails: z.custom<EditorDoc | string | null>().nullable().optional(),
    noteDetails: z.custom<EditorDoc | string | null>().nullable().optional(),
    size: z.enum(["a4", "letter"]).default("a4"),
    includeVat: z.boolean().optional().default(true),
    includeTax: z.boolean().optional().default(false),
    includeDiscount: z.boolean().optional().default(true),
    includeDecimals: z.boolean().optional().default(true),
    includePdf: z.boolean().optional().default(true),
    includeUnits: z.boolean().optional().default(false),
    includeQr: z.boolean().optional().default(false),
    taxRate: z.number().min(0).max(100).optional().default(0),
    vatRate: z.number().min(0).max(100).optional().default(20),
    dateFormat: z
      .enum(["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd", "dd.MM.yyyy"])
      .default("dd.MM.yyyy"),
    deliveryType: z.enum(["create", "create_and_send", "scheduled"]).default("create"),
    locale: z.string().optional().default("sr-RS"),
    timezone: z.string().optional().default("Europe/Belgrade"),
  };

  // Add due date label if provided
  if (config.dueDateLabel) {
    return z.object({
      ...baseSchema,
      [config.dueDateLabel.toLowerCase().replace(/\s+/g, "")]: z
        .string()
        .default(config.dueDateLabel),
    });
  }

  return z.object(baseSchema);
}

/**
 * Pre-configured template schemas for common document types
 */
export const invoiceTemplateSchema = z.object({
  title: z.string().optional().default("Invoice"),
  customerLabel: z.string().default("Bill to"),
  fromLabel: z.string().default("From"),
  invoiceNoLabel: z.string().default("Invoice No"),
  issueDateLabel: z.string().default("Issue Date"),
  dueDateLabel: z.string().default("Due Date"),
  descriptionLabel: z.string().default("Description"),
  priceLabel: z.string().default("Price"),
  quantityLabel: z.string().default("Quantity"),
  totalLabel: z.string().default("Total"),
  totalSummaryLabel: z.string().optional().default("Total"),
  vatLabel: z.string().optional().default("VAT"),
  subtotalLabel: z.string().optional().default("Subtotal"),
  taxLabel: z.string().optional().default("Tax"),
  discountLabel: z.string().optional().default("Discount"),
  paymentLabel: z.string().default("Payment Details"),
  noteLabel: z.string().default("Note"),
  logoUrl: z.string().optional().nullable(),
  currency: z.string().default("EUR"),
  paymentDetails: z.custom<EditorDoc | string | null>().nullable().optional(),
  fromDetails: z.custom<EditorDoc | string | null>().nullable().optional(),
  noteDetails: z.custom<EditorDoc | string | null>().nullable().optional(),
  size: z.enum(["a4", "letter"]).default("a4"),
  includeVat: z.boolean().optional().default(true),
  includeTax: z.boolean().optional().default(false),
  includeDiscount: z.boolean().optional().default(true),
  includeDecimals: z.boolean().optional().default(true),
  includePdf: z.boolean().optional().default(true),
  includeUnits: z.boolean().optional().default(false),
  includeQr: z.boolean().optional().default(false),
  taxRate: z.number().min(0).max(100).optional().default(0),
  vatRate: z.number().min(0).max(100).optional().default(20),
  dateFormat: z
    .enum(["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd", "dd.MM.yyyy"])
    .default("dd.MM.yyyy"),
  deliveryType: z.enum(["create", "create_and_send", "scheduled"]).default("create"),
  locale: z.string().optional().default("sr-RS"),
  timezone: z.string().optional().default("Europe/Belgrade"),
});

export const quoteTemplateSchema = z.object({
  title: z.string().optional().default("Quote"),
  customerLabel: z.string().default("Bill to"),
  fromLabel: z.string().default("From"),
  quoteNoLabel: z.string().default("Quote No"),
  issueDateLabel: z.string().default("Issue Date"),
  validUntilLabel: z.string().default("Valid Until"),
  descriptionLabel: z.string().default("Description"),
  priceLabel: z.string().default("Price"),
  quantityLabel: z.string().default("Quantity"),
  totalLabel: z.string().default("Total"),
  totalSummaryLabel: z.string().optional().default("Total"),
  vatLabel: z.string().optional().default("VAT"),
  subtotalLabel: z.string().optional().default("Subtotal"),
  taxLabel: z.string().optional().default("Tax"),
  discountLabel: z.string().optional().default("Discount"),
  paymentLabel: z.string().default("Payment Details"),
  noteLabel: z.string().default("Note"),
  logoUrl: z.string().optional().nullable(),
  currency: z.string().default("EUR"),
  paymentDetails: z.custom<EditorDoc | string | null>().nullable().optional(),
  fromDetails: z.custom<EditorDoc | string | null>().nullable().optional(),
  noteDetails: z.custom<EditorDoc | string | null>().nullable().optional(),
  size: z.enum(["a4", "letter"]).default("a4"),
  includeVat: z.boolean().optional().default(true),
  includeTax: z.boolean().optional().default(false),
  includeDiscount: z.boolean().optional().default(true),
  includeDecimals: z.boolean().optional().default(true),
  includePdf: z.boolean().optional().default(true),
  includeUnits: z.boolean().optional().default(false),
  includeQr: z.boolean().optional().default(false),
  taxRate: z.number().min(0).max(100).optional().default(0),
  vatRate: z.number().min(0).max(100).optional().default(20),
  dateFormat: z
    .enum(["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd", "dd.MM.yyyy"])
    .default("dd.MM.yyyy"),
  deliveryType: z.enum(["create", "create_and_send", "scheduled"]).default("create"),
  locale: z.string().optional().default("sr-RS"),
  timezone: z.string().optional().default("Europe/Belgrade"),
});

export const orderTemplateSchema = z.object({
  title: z.string().optional().default("Order"),
  customerLabel: z.string().default("Bill to"),
  fromLabel: z.string().default("From"),
  orderNoLabel: z.string().default("Order No"),
  issueDateLabel: z.string().default("Issue Date"),
  descriptionLabel: z.string().default("Description"),
  priceLabel: z.string().default("Price"),
  quantityLabel: z.string().default("Quantity"),
  totalLabel: z.string().default("Total"),
  totalSummaryLabel: z.string().optional().default("Total"),
  vatLabel: z.string().optional().default("VAT"),
  subtotalLabel: z.string().optional().default("Subtotal"),
  taxLabel: z.string().optional().default("Tax"),
  discountLabel: z.string().optional().default("Discount"),
  paymentLabel: z.string().default("Payment Details"),
  noteLabel: z.string().default("Note"),
  logoUrl: z.string().optional().nullable(),
  currency: z.string().default("EUR"),
  paymentDetails: z.custom<EditorDoc | string | null>().nullable().optional(),
  fromDetails: z.custom<EditorDoc | string | null>().nullable().optional(),
  noteDetails: z.custom<EditorDoc | string | null>().nullable().optional(),
  size: z.enum(["a4", "letter"]).default("a4"),
  includeVat: z.boolean().optional().default(true),
  includeTax: z.boolean().optional().default(false),
  includeDiscount: z.boolean().optional().default(true),
  includeDecimals: z.boolean().optional().default(true),
  includePdf: z.boolean().optional().default(true),
  includeUnits: z.boolean().optional().default(false),
  includeQr: z.boolean().optional().default(false),
  taxRate: z.number().min(0).max(100).optional().default(0),
  vatRate: z.number().min(0).max(100).optional().default(20),
  dateFormat: z
    .enum(["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd", "dd.MM.yyyy"])
    .default("dd.MM.yyyy"),
  deliveryType: z.enum(["create", "create_and_send", "scheduled"]).default("create"),
  locale: z.string().optional().default("sr-RS"),
  timezone: z.string().optional().default("Europe/Belgrade"),
});

export type InvoiceTemplate = z.infer<typeof invoiceTemplateSchema>;
export type QuoteTemplate = z.infer<typeof quoteTemplateSchema>;
export type OrderTemplate = z.infer<typeof orderTemplateSchema>;
