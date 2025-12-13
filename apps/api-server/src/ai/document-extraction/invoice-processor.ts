/**
 * Advanced Invoice Processor
 * 4-pass extraction strategy for high-accuracy invoice data extraction
 *
 * Pass 1: Primary Model (Gemini Flash) - Standard extraction
 * Pass 2: Fallback Model (Gemini Pro) - Chain-of-thought reasoning
 * Pass 3: Targeted Field Re-extraction - Missing/invalid fields only
 * Pass 4: Cross-field Validation - Mathematical consistency checks
 */

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { logger } from "../../lib/logger";

// Initialize Google AI
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
});

// Invoice schema
export const invoiceSchema = z.object({
  invoice_number: z.string().nullable().describe("Unique invoice identifier"),
  invoice_date: z.string().nullable().describe("Invoice date in YYYY-MM-DD format"),
  due_date: z.string().nullable().describe("Payment due date in YYYY-MM-DD format"),
  currency: z.string().describe("ISO 4217 currency code (EUR, USD, RSD, etc.)"),
  total_amount: z.number().describe("Final total amount due"),
  subtotal_amount: z.number().nullable().describe("Subtotal before tax"),
  tax_amount: z.number().nullable().describe("Tax amount"),
  tax_rate: z.number().nullable().describe("Tax rate as percentage (e.g., 20 for 20%)"),
  tax_type: z
    .enum(["vat", "sales_tax", "gst", "withholding_tax", "pdv", "other"])
    .nullable()
    .describe("Type of tax applied"),
  vendor_name: z.string().nullable().describe("Legal name of the company issuing the invoice"),
  vendor_address: z.string().nullable().describe("Complete vendor address"),
  vendor_vat_number: z.string().nullable().describe("Vendor VAT/Tax ID number"),
  customer_name: z.string().nullable().describe("Name of the customer/buyer"),
  customer_address: z.string().nullable().describe("Complete customer address"),
  customer_vat_number: z.string().nullable().describe("Customer VAT/Tax ID number"),
  website: z.string().nullable().describe("Vendor website (root domain only)"),
  email: z.string().nullable().describe("Vendor email address"),
  phone: z.string().nullable().describe("Vendor phone number"),
  line_items: z
    .array(
      z.object({
        description: z.string().nullable(),
        quantity: z.number().nullable(),
        unit_price: z.number().nullable(),
        total_price: z.number().nullable(),
      })
    )
    .describe("Array of invoice line items"),
  payment_instructions: z.string().nullable().describe("Payment terms or bank details"),
  notes: z.string().nullable().describe("Additional notes"),
  language: z.string().nullable().describe("Document language (english, serbian, german, etc.)"),
});

export type InvoiceData = z.infer<typeof invoiceSchema>;

// Field priorities (1-10 scale)
const FIELD_PRIORITIES: Record<string, number> = {
  total_amount: 10,
  currency: 10,
  vendor_name: 9,
  invoice_number: 8,
  invoice_date: 8,
  due_date: 7,
  tax_amount: 6,
  tax_rate: 5,
  customer_name: 5,
  subtotal_amount: 4,
  line_items: 4,
};

// Quality thresholds
const QUALITY_THRESHOLD = 70;
const CONFIDENCE_MERGE_THRESHOLD = 0.1;

// Prompts
const BASE_SYSTEM_PROMPT = `You are an expert invoice data extraction AI. Extract all available information from the invoice document accurately.

CRITICAL RULES:
1. Extract the VENDOR (seller/issuer) correctly - this is the company ISSUING the invoice
2. Extract the CUSTOMER (buyer/recipient) correctly - this is who receives the invoice
3. Always convert dates to YYYY-MM-DD format
4. Use ISO 4217 currency codes (EUR, USD, RSD, GBP, etc.)
5. For amounts, extract the FINAL total, not subtotals
6. Extract line items with quantity, unit price, and total price
7. If VAT/PDV is mentioned, include tax details

COMMON INVOICE NUMBER FORMATS:
- INV-2024-001, FA-123456, 2024/0001
- #12345, No. 98765, Br. 123-2024
- R24-001234, FV-2024-000123

DATE FORMATS TO CONVERT:
- DD/MM/YYYY → YYYY-MM-DD
- DD.MM.YYYY → YYYY-MM-DD
- MM/DD/YYYY → YYYY-MM-DD
- DD-MMM-YYYY → YYYY-MM-DD

CURRENCY SYMBOLS:
- € → EUR, $ → USD, £ → GBP
- RSD, din, дин → RSD
- CHF, Fr → CHF

TAX TERMS:
- VAT, PDV, IVA, TVA, MwSt → vat
- GST → gst
- Sales Tax → sales_tax`;

const CHAIN_OF_THOUGHT_PROMPT = `Analyze the invoice step-by-step:

STEP 1: DOCUMENT STRUCTURE
- Identify the document type and layout
- Note any logos, headers, or formatting

STEP 2: VENDOR INFORMATION
- Find the company ISSUING this invoice (vendor/seller)
- Look for: company name, address, VAT number, contact info
- Usually at top-left or in header

STEP 3: INVOICE METADATA
- Find invoice number (often labeled as "Invoice", "Faktura", "Račun")
- Find invoice date and due date
- Currency and total amount

STEP 4: CUSTOMER INFORMATION
- Find the RECIPIENT of this invoice (buyer/customer)
- Usually labeled as "Bill To", "Kupac", "Invoice To"

STEP 5: LINE ITEMS
- Extract each item with description, quantity, unit price, total
- Note any discounts applied

STEP 6: FINANCIAL SUMMARY
- Subtotal (before tax)
- Tax amount and rate
- Final total

STEP 7: VALIDATE
- Check: subtotal + tax ≈ total
- Verify vendor ≠ customer
- Ensure dates make sense (due_date >= invoice_date)

Now extract the data:`;

interface ExtractionResult {
  data: InvoiceData;
  quality: number;
  confidence: number;
  pass: number;
  fixes?: string[];
}

interface ProcessingOptions {
  companyContext?: string;
  maxPasses?: number;
  primaryModel?: string;
  fallbackModel?: string;
}

/**
 * Calculate quality score for extracted data
 */
function calculateQualityScore(data: Partial<InvoiceData>): number {
  let score = 100;

  // Critical fields
  if (!data.total_amount && data.total_amount !== 0) score -= 30;
  if (!data.currency) score -= 25;
  if (!data.vendor_name) score -= 20;
  if (!data.invoice_date && !data.due_date) score -= 15;
  if (!data.invoice_number) score -= 5;

  // Validation penalties
  if (data.invoice_date && !isValidDate(data.invoice_date)) score -= 5;
  if (data.due_date && !isValidDate(data.due_date)) score -= 5;
  if (data.total_amount !== undefined && data.total_amount < 0) score -= 10;

  // Date consistency
  if (data.invoice_date && data.due_date) {
    const invoiceDate = new Date(data.invoice_date);
    const dueDate = new Date(data.due_date);
    if (dueDate < invoiceDate) score -= 5;
  }

  return Math.max(0, score);
}

/**
 * Calculate confidence score for merging decisions
 */
function calculateConfidence(data: Partial<InvoiceData>, qualityScore: number): number {
  let confidence = qualityScore / 100;

  const criticalFields = ["total_amount", "currency", "vendor_name", "invoice_date"];
  const presentCritical = criticalFields.filter(
    (f) => data[f as keyof InvoiceData] !== null && data[f as keyof InvoiceData] !== undefined
  );

  if (presentCritical.length === criticalFields.length) {
    confidence += 0.1;
  } else {
    confidence -= 0.05 * (criticalFields.length - presentCritical.length);
  }

  if (data.vendor_name && data.vendor_name.length > 5) confidence += 0.05;
  if (data.invoice_number) confidence += 0.05;

  return Math.max(0, Math.min(1, confidence));
}

/**
 * Check if a date string is valid
 */
function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return !Number.isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

/**
 * Merge two extraction results using confidence-weighted field selection
 */
function mergeResults(primary: ExtractionResult, secondary: ExtractionResult): ExtractionResult {
  const confDiff = Math.abs(primary.confidence - secondary.confidence);

  // If confidence difference is large, use higher confidence result
  if (confDiff > CONFIDENCE_MERGE_THRESHOLD) {
    return primary.confidence > secondary.confidence ? primary : secondary;
  }

  // Field-specific merging rules
  const merged: InvoiceData = { ...primary.data };

  // vendor_name: prefer longer (more complete)
  if (
    secondary.data.vendor_name &&
    secondary.data.vendor_name.length > (primary.data.vendor_name?.length || 0)
  ) {
    merged.vendor_name = secondary.data.vendor_name;
  }

  // invoice_number: prefer longer
  if (
    secondary.data.invoice_number &&
    secondary.data.invoice_number.length > (primary.data.invoice_number?.length || 0)
  ) {
    merged.invoice_number = secondary.data.invoice_number;
  }

  // currency: prefer non-default if primary is USD/EUR
  if (
    secondary.data.currency &&
    secondary.data.currency !== "USD" &&
    primary.data.currency === "USD"
  ) {
    merged.currency = secondary.data.currency;
  }

  // Fill in missing fields from secondary
  const fieldsToFill = [
    "invoice_date",
    "due_date",
    "tax_amount",
    "tax_rate",
    "tax_type",
    "customer_name",
    "customer_address",
    "vendor_address",
    "email",
    "website",
    "phone",
    "payment_instructions",
  ] as const;

  for (const field of fieldsToFill) {
    if (!merged[field] && secondary.data[field]) {
      (merged as Record<string, unknown>)[field] = secondary.data[field];
    }
  }

  // Merge line items if primary has fewer
  if (secondary.data.line_items.length > merged.line_items.length) {
    merged.line_items = secondary.data.line_items;
  }

  const quality = calculateQualityScore(merged);
  const confidence = calculateConfidence(merged, quality);

  return {
    data: merged,
    quality,
    confidence,
    pass: 2,
  };
}

/**
 * Validate and fix mathematical consistency
 */
function validateAndFix(data: InvoiceData): { data: InvoiceData; fixes: string[] } {
  const fixes: string[] = [];
  const fixed = { ...data };

  // Fix 1: subtotal + tax = total
  if (fixed.subtotal_amount && fixed.tax_amount) {
    const calculatedTotal = fixed.subtotal_amount + fixed.tax_amount;
    const tolerance = 0.01;

    if (Math.abs(calculatedTotal - fixed.total_amount) > tolerance) {
      // If subtotal + tax doesn't equal total, trust the total
      if (!fixed.subtotal_amount || fixed.subtotal_amount === 0) {
        fixed.subtotal_amount = fixed.total_amount - (fixed.tax_amount || 0);
        fixes.push(`Fixed subtotal: ${fixed.subtotal_amount}`);
      }
    }
  }

  // Fix 2: Calculate tax rate if missing
  if (fixed.tax_amount && fixed.subtotal_amount && !fixed.tax_rate) {
    fixed.tax_rate = Math.round((fixed.tax_amount / fixed.subtotal_amount) * 100 * 100) / 100;
    fixes.push(`Calculated tax rate: ${fixed.tax_rate}%`);
  }

  // Fix 3: Calculate subtotal from line items if missing
  if (!fixed.subtotal_amount && fixed.line_items.length > 0) {
    const lineItemsTotal = fixed.line_items.reduce((sum, item) => sum + (item.total_price || 0), 0);
    if (lineItemsTotal > 0) {
      fixed.subtotal_amount = lineItemsTotal;
      fixes.push(`Calculated subtotal from line items: ${fixed.subtotal_amount}`);
    }
  }

  // Fix 4: Ensure dates are consistent
  if (fixed.invoice_date && fixed.due_date) {
    const invoiceDate = new Date(fixed.invoice_date);
    const dueDate = new Date(fixed.due_date);

    if (dueDate < invoiceDate) {
      // Swap dates if they're reversed
      [fixed.invoice_date, fixed.due_date] = [fixed.due_date, fixed.invoice_date];
      fixes.push("Swapped invoice_date and due_date (were reversed)");
    }
  }

  return { data: fixed, fixes };
}

/**
 * Get missing critical fields
 */
function getMissingCriticalFields(data: Partial<InvoiceData>): string[] {
  const criticalFields = [
    {
      name: "total_amount",
      check: () => data.total_amount !== undefined && data.total_amount !== null,
    },
    { name: "currency", check: () => !!data.currency },
    { name: "vendor_name", check: () => !!data.vendor_name },
    { name: "invoice_number", check: () => !!data.invoice_number },
    { name: "invoice_date", check: () => !!data.invoice_date },
  ];

  return criticalFields.filter((f) => !f.check()).map((f) => f.name);
}

/**
 * PASS 1: Primary model extraction
 */
async function pass1Extract(
  content: string | { type: "image"; data: string; mimeType: string },
  options: ProcessingOptions
): Promise<ExtractionResult> {
  const model = options.primaryModel || "gemini-2.5-flash-preview-05-20";
  const contextPrompt = options.companyContext
    ? `\n\nIMPORTANT CONTEXT: The document recipient (customer/buyer) is "${options.companyContext}". The VENDOR is the company ISSUING this invoice TO ${options.companyContext}.`
    : "";

  const prompt =
    typeof content === "string"
      ? `${BASE_SYSTEM_PROMPT}${contextPrompt}\n\nExtract invoice data from this text:\n\n${content}`
      : `${BASE_SYSTEM_PROMPT}${contextPrompt}\n\nExtract invoice data from this image.`;

  const messages =
    typeof content === "string"
      ? [{ role: "user" as const, content: prompt }]
      : [
          {
            role: "user" as const,
            content: [
              { type: "text" as const, text: prompt },
              { type: "image" as const, image: content.data, mimeType: content.mimeType },
            ],
          },
        ];

  logger.info(
    { model, hasContext: !!options.companyContext },
    "[Invoice] Pass 1: Primary extraction"
  );

  const { object } = await generateObject({
    model: google(model) as Parameters<typeof generateObject>[0]["model"],
    schema: invoiceSchema,
    messages,
    temperature: 0.1,
  });

  const data = object as InvoiceData;
  const quality = calculateQualityScore(data);
  const confidence = calculateConfidence(data, quality);

  logger.info({ quality, confidence }, "[Invoice] Pass 1 complete");

  return { data, quality, confidence, pass: 1 };
}

/**
 * PASS 2: Fallback model with chain-of-thought
 */
async function pass2Extract(
  content: string | { type: "image"; data: string; mimeType: string },
  options: ProcessingOptions
): Promise<ExtractionResult> {
  const model = options.fallbackModel || "gemini-2.5-pro-preview-05-06";
  const contextPrompt = options.companyContext
    ? `\n\nIMPORTANT CONTEXT: The document recipient is "${options.companyContext}". Extract the VENDOR (issuer) correctly.`
    : "";

  const prompt =
    typeof content === "string"
      ? `${BASE_SYSTEM_PROMPT}${contextPrompt}\n\n${CHAIN_OF_THOUGHT_PROMPT}\n\nDocument text:\n\n${content}`
      : `${BASE_SYSTEM_PROMPT}${contextPrompt}\n\n${CHAIN_OF_THOUGHT_PROMPT}`;

  const messages =
    typeof content === "string"
      ? [{ role: "user" as const, content: prompt }]
      : [
          {
            role: "user" as const,
            content: [
              { type: "text" as const, text: prompt },
              { type: "image" as const, image: content.data, mimeType: content.mimeType },
            ],
          },
        ];

  logger.info({ model }, "[Invoice] Pass 2: Chain-of-thought extraction");

  const { object } = await generateObject({
    model: google(model) as Parameters<typeof generateObject>[0]["model"],
    schema: invoiceSchema,
    messages,
    temperature: 0.1,
  });

  const data = object as InvoiceData;
  const quality = calculateQualityScore(data);
  const confidence = calculateConfidence(data, quality);

  logger.info({ quality, confidence }, "[Invoice] Pass 2 complete");

  return { data, quality, confidence, pass: 2 };
}

/**
 * PASS 3: Targeted field re-extraction
 */
async function pass3ReExtract(
  content: string | { type: "image"; data: string; mimeType: string },
  currentData: InvoiceData,
  missingFields: string[],
  options: ProcessingOptions
): Promise<InvoiceData> {
  const model = options.primaryModel || "gemini-2.5-flash-preview-05-20";

  logger.info({ missingFields }, "[Invoice] Pass 3: Re-extracting missing fields");

  // Sort by priority
  const sortedFields = missingFields.sort(
    (a, b) => (FIELD_PRIORITIES[b] || 0) - (FIELD_PRIORITIES[a] || 0)
  );

  const fieldSchemas: Record<string, z.ZodType> = {
    total_amount: z.object({ total_amount: z.number() }),
    currency: z.object({ currency: z.string() }),
    vendor_name: z.object({ vendor_name: z.string() }),
    invoice_number: z.object({ invoice_number: z.string() }),
    invoice_date: z.object({ invoice_date: z.string() }),
    due_date: z.object({ due_date: z.string() }),
    tax_amount: z.object({ tax_amount: z.number().nullable() }),
    tax_rate: z.object({ tax_rate: z.number().nullable() }),
    customer_name: z.object({ customer_name: z.string().nullable() }),
  };

  const fieldPrompts: Record<string, string> = {
    total_amount:
      "Extract ONLY the final total amount (the amount to be paid). Return as a number.",
    currency: "Extract ONLY the currency code. Return ISO 4217 code (EUR, USD, RSD, etc.).",
    vendor_name: "Extract ONLY the vendor/seller company name (who issued this invoice).",
    invoice_number:
      "Extract ONLY the invoice number/ID. Common formats: INV-2024-001, FA-123456, #12345.",
    invoice_date: "Extract ONLY the invoice date. Return in YYYY-MM-DD format.",
    due_date: "Extract ONLY the payment due date. Return in YYYY-MM-DD format.",
    tax_amount: "Extract ONLY the tax/VAT/PDV amount as a number. Return null if not found.",
    tax_rate:
      "Extract ONLY the tax rate as a percentage number (e.g., 20 for 20%). Return null if not found.",
    customer_name: "Extract ONLY the customer/buyer name (who receives this invoice).",
  };

  const updatedData = { ...currentData };

  for (const field of sortedFields) {
    if (!fieldSchemas[field] || !fieldPrompts[field]) continue;

    try {
      const fieldPrompt =
        typeof content === "string"
          ? `${fieldPrompts[field]}\n\nDocument:\n${content.substring(0, 4000)}`
          : fieldPrompts[field];

      const messages =
        typeof content === "string"
          ? [{ role: "user" as const, content: fieldPrompt }]
          : [
              {
                role: "user" as const,
                content: [
                  { type: "text" as const, text: fieldPrompt },
                  { type: "image" as const, image: content.data, mimeType: content.mimeType },
                ],
              },
            ];

      const { object } = await generateObject({
        model: google(model) as Parameters<typeof generateObject>[0]["model"],
        schema: fieldSchemas[field],
        messages,
        temperature: 0.1,
      });

      const extractedValue = (object as Record<string, unknown>)[field];
      if (extractedValue !== null && extractedValue !== undefined) {
        (updatedData as Record<string, unknown>)[field] = extractedValue;
        logger.info({ field, value: extractedValue }, "[Invoice] Pass 3: Field extracted");
      }
    } catch (error) {
      logger.warn({ field, error }, "[Invoice] Pass 3: Field extraction failed");
    }
  }

  return updatedData;
}

/**
 * PASS 4: Cross-field validation and mathematical fixes
 */
function pass4Validate(data: InvoiceData): ExtractionResult {
  logger.info("[Invoice] Pass 4: Cross-field validation");

  const { data: fixedData, fixes } = validateAndFix(data);
  const quality = calculateQualityScore(fixedData);
  const confidence = calculateConfidence(fixedData, quality);

  if (fixes.length > 0) {
    logger.info({ fixes }, "[Invoice] Pass 4: Applied fixes");
  }

  return { data: fixedData, quality, confidence, pass: 4, fixes };
}

/**
 * Main invoice processing function
 * Implements 4-pass extraction strategy
 */
export async function processInvoice(
  content: string | { type: "image"; data: string; mimeType: string },
  options: ProcessingOptions = {}
): Promise<ExtractionResult> {
  const maxPasses = options.maxPasses ?? 4;

  try {
    // PASS 1: Primary model extraction
    let result = await pass1Extract(content, options);

    if (result.quality >= QUALITY_THRESHOLD && getMissingCriticalFields(result.data).length === 0) {
      logger.info(
        { quality: result.quality },
        "[Invoice] Pass 1 sufficient, skipping additional passes"
      );
      return pass4Validate(result.data);
    }

    if (maxPasses < 2) return result;

    // PASS 2: Fallback model with chain-of-thought
    const pass2Result = await pass2Extract(content, options);
    result = mergeResults(result, pass2Result);

    if (result.quality >= QUALITY_THRESHOLD && getMissingCriticalFields(result.data).length === 0) {
      logger.info({ quality: result.quality }, "[Invoice] Pass 2 sufficient, skipping Pass 3");
      return pass4Validate(result.data);
    }

    if (maxPasses < 3) return result;

    // PASS 3: Targeted field re-extraction
    const missingFields = getMissingCriticalFields(result.data);
    if (missingFields.length > 0) {
      result.data = await pass3ReExtract(content, result.data, missingFields, options);
    }

    // PASS 4: Cross-field validation and fixes
    return pass4Validate(result.data);
  } catch (error) {
    logger.error({ error }, "[Invoice] Processing failed");
    throw error;
  }
}

export default {
  processInvoice,
  invoiceSchema,
  calculateQualityScore,
};
