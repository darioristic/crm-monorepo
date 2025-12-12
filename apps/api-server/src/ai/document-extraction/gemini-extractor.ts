/**
 * Gemini Document Extractor
 * Uses Google Gemini API directly for structured document extraction
 * Based on Midday's multi-pass extraction strategy
 */

import { serviceLogger } from "../../lib/logger";
import {
  type DocumentExtractionResult,
  documentExtractionSchema,
  EXTRACTION_CONFIG,
} from "./schema";

// API key from environment
const GOOGLE_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

/**
 * Create extraction prompt for documents
 */
function createExtractionPrompt(companyName?: string | null): string {
  const contextPart = companyName
    ? `\n\nCONTEXT: The document recipient/customer company is "${companyName}". Use this to identify which party is the vendor/seller vs the customer/buyer.`
    : "";

  return `You are an expert document data extractor specializing in invoices and receipts. Extract structured data with maximum accuracy.

CRITICAL RULES - READ CAREFULLY:

1. VENDOR NAME EXTRACTION (MOST IMPORTANT):
   - The VENDOR is the company that ISSUED/SENT the invoice (the SELLER)
   - Look for the company name in the HEADER/LETTERHEAD (usually top of document, often with a logo)
   - Extract the FULL LEGAL BUSINESS NAME including entity type (d.o.o., D.O.O., Ltd, GmbH, LLC, Inc., etc.)
   - Examples of CORRECT vendor names:
     * "Cloud Native d.o.o." ✓
     * "Red Hat Inc." ✓
     * "Microsoft Corporation" ✓
     * "Spark Analytics DOO" ✓
   - NEVER extract dates, periods, or subscription terms as vendor name
   - WRONG: "01.10.2025 do 30.09.2026" ✗ (this is a date range, NOT a company name)
   - WRONG: "2025-00014" ✗ (this is an invoice number, NOT a company name)
   - If document header shows "Cloud Native d.o.o." with address/PIB, that's the vendor

2. TOTAL AMOUNT EXTRACTION:
   - Find the FINAL TOTAL amount (the amount to be paid)
   - Serbian invoices: Look for "UKUPNO", "Za uplatu", "SVEGA", "Ukupno za plaćanje"
   - The total is usually the LARGEST amount at the bottom of the document
   - Handle European format: 86.964,06 → 86964.06 (dot as thousands separator, comma as decimal)
   - Handle Serbian format: 86964,06 RSD → 86964.06
   - Return as a NUMBER without currency symbol

3. CURRENCY DETECTION:
   - Serbian Dinar: RSD (look for "RSD", "din", "dinara")
   - Euro: EUR (look for "€", "EUR")
   - Dollar: USD (look for "$", "USD")

4. DATE EXTRACTION:
   - Extract the INVOICE DATE (when the invoice was issued)
   - Serbian format: DD.MM.YYYY (e.g., "07.10.2025" → "2025-10-07")
   - Look for: "Datum", "Datum fakture", "Beograd, dana"
   - Return in ISO format: YYYY-MM-DD

5. WEBSITE EXTRACTION:
   - Look for domain in email address (e.g., office@cloudnative.rs → cloudnative.rs)
   - Look for website URL in footer/header
   - Return just the domain (e.g., "cloudnative.rs", not "www.cloudnative.rs")${contextPart}

Extract the data from the document. Return null for fields that cannot be determined.

IMPORTANT: Return ONLY a valid JSON object with the following structure:
{
  "vendor_name": string | null,
  "vendor_address": string | null,
  "website": string | null,
  "email": string | null,
  "invoice_number": string | null,
  "date": string | null (YYYY-MM-DD format),
  "due_date": string | null (YYYY-MM-DD format),
  "currency": string (ISO 4217 code, required),
  "total_amount": number (required),
  "subtotal_amount": number | null,
  "tax_amount": number | null,
  "tax_rate": number | null,
  "tax_type": "vat" | "sales_tax" | "gst" | null,
  "document_type": "invoice" | "receipt" | "expense" | "other",
  "customer_name": string | null,
  "customer_address": string | null,
  "payment_method": string | null,
  "iban": string | null,
  "reference_number": string | null,
  "notes": string | null,
  "language": string | null
}`;
}

/**
 * Retry helper for API calls
 */
async function retryCall<T>(
  fn: () => Promise<T>,
  retries: number,
  delayMs: number = 2000
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (i < retries) {
        serviceLogger.warn(
          { attempt: i + 1, maxRetries: retries + 1, error: lastError.message },
          "Extraction attempt failed, retrying"
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs * (i + 1)));
      }
    }
  }

  throw lastError;
}

/**
 * Call Gemini API directly for document extraction
 */
async function callGeminiAPI(
  model: string,
  prompt: string,
  base64Data: string,
  mimeType: string
): Promise<DocumentExtractionResult> {
  if (!GOOGLE_API_KEY) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
  }

  // Build the request body for Gemini
  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: EXTRACTION_CONFIG.temperature,
      responseMimeType: "application/json",
    },
  };

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(EXTRACTION_CONFIG.timeout),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
    error?: { message: string };
  };

  if (data.error) {
    throw new Error(`Gemini API error: ${data.error.message}`);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("No text response from Gemini API");
  }

  // Parse JSON response
  try {
    // Clean up the response - remove markdown code blocks if present
    let cleanJson = text.trim();
    if (cleanJson.startsWith("```json")) {
      cleanJson = cleanJson.slice(7);
    }
    if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.slice(3);
    }
    if (cleanJson.endsWith("```")) {
      cleanJson = cleanJson.slice(0, -3);
    }
    cleanJson = cleanJson.trim();

    const parsed = JSON.parse(cleanJson);

    // Validate with Zod schema
    const validated = documentExtractionSchema.parse(parsed);

    return validated;
  } catch (parseError) {
    serviceLogger.error(
      { error: parseError, responseText: text.substring(0, 500) },
      "Failed to parse Gemini response as JSON"
    );
    throw new Error(
      `Failed to parse Gemini response: ${parseError instanceof Error ? parseError.message : "Unknown"}`
    );
  }
}

/**
 * Extract document data using Gemini AI
 */
export async function extractDocumentWithGemini(
  fileBuffer: Buffer,
  mimeType: string,
  options?: {
    companyName?: string | null;
  }
): Promise<DocumentExtractionResult> {
  const { companyName } = options || {};
  const prompt = createExtractionPrompt(companyName);

  serviceLogger.info({ mimeType, companyName }, "Starting Gemini document extraction");

  // Convert buffer to base64
  const base64Data = fileBuffer.toString("base64");

  try {
    // Pass 1: Primary model extraction
    serviceLogger.info(
      { model: EXTRACTION_CONFIG.primaryModel },
      "Pass 1: Extracting with primary model"
    );

    const result = await retryCall(
      () => callGeminiAPI(EXTRACTION_CONFIG.primaryModel, prompt, base64Data, mimeType),
      EXTRACTION_CONFIG.retries,
      2000
    );

    // Check quality
    const qualityScore = calculateQualityScore(result);

    serviceLogger.info(
      {
        qualityScore: qualityScore.score,
        missingFields: qualityScore.missingCriticalFields,
        vendorName: result.vendor_name,
        amount: result.total_amount,
        currency: result.currency,
      },
      "Pass 1 extraction complete"
    );

    // If quality is good, return result
    if (
      qualityScore.score >= EXTRACTION_CONFIG.qualityThreshold &&
      qualityScore.missingCriticalFields.length === 0
    ) {
      return result;
    }

    // Pass 2: Try fallback model with chain-of-thought
    serviceLogger.info(
      { model: EXTRACTION_CONFIG.fallbackModel },
      "Pass 2: Quality poor, trying fallback model"
    );

    const enhancedPrompt = `${prompt}

CHAIN OF THOUGHT INSTRUCTIONS:
Before extracting each field, think step by step:
1. Identify all text blocks in the document
2. Locate the vendor/seller information (usually at the top)
3. Find the total amount - look for the largest/final amount
4. Identify the currency from symbols or text
5. Extract the document date
6. Determine the document type based on format and content

Now extract the data carefully and return ONLY the JSON object:`;

    try {
      const fallbackResult = await retryCall(
        () => callGeminiAPI(EXTRACTION_CONFIG.fallbackModel, enhancedPrompt, base64Data, mimeType),
        1,
        2000
      );

      // Merge results - prefer non-null values from fallback for missing critical fields
      const mergedData = mergeExtractionResults(result, fallbackResult);

      serviceLogger.info(
        {
          vendorName: mergedData.vendor_name,
          amount: mergedData.total_amount,
          currency: mergedData.currency,
        },
        "Pass 2 complete, merged results"
      );

      return mergedData;
    } catch (fallbackError) {
      serviceLogger.warn(
        { error: fallbackError instanceof Error ? fallbackError.message : "Unknown" },
        "Fallback model failed, returning primary result"
      );
      return result;
    }
  } catch (error) {
    serviceLogger.error(
      { error: error instanceof Error ? error.message : "Unknown" },
      "Gemini document extraction failed"
    );
    throw error;
  }
}

/**
 * Calculate quality score for extraction result
 */
function calculateQualityScore(result: DocumentExtractionResult): {
  score: number;
  missingCriticalFields: string[];
  issues: string[];
} {
  const issues: string[] = [];
  const missingCriticalFields: string[] = [];
  let score = 100;

  // Check critical fields
  if (!result.total_amount || result.total_amount <= 0) {
    missingCriticalFields.push("total_amount");
    score -= 25;
  }

  if (!result.currency) {
    missingCriticalFields.push("currency");
    score -= 20;
  }

  if (!result.vendor_name) {
    missingCriticalFields.push("vendor_name");
    score -= 20;
  }

  if (!result.date) {
    missingCriticalFields.push("date");
    score -= 15;
  }

  // Additional quality checks
  if (result.currency && result.currency.length !== 3) {
    issues.push("Invalid currency code length");
    score -= 10;
  }

  if (result.date && !/^\d{4}-\d{2}-\d{2}$/.test(result.date)) {
    issues.push("Date not in ISO format");
    score -= 5;
  }

  if (result.tax_rate && (result.tax_rate < 0 || result.tax_rate > 100)) {
    issues.push("Invalid tax rate");
    score -= 5;
  }

  return {
    score: Math.max(0, score) / 100,
    missingCriticalFields,
    issues,
  };
}

/**
 * Merge two extraction results, preferring non-null values
 */
function mergeExtractionResults(
  primary: DocumentExtractionResult,
  secondary: DocumentExtractionResult
): DocumentExtractionResult {
  const merged = { ...primary };

  // For critical fields, prefer secondary if primary is missing
  if (!primary.vendor_name && secondary.vendor_name) {
    merged.vendor_name = secondary.vendor_name;
  }
  if ((!primary.total_amount || primary.total_amount <= 0) && secondary.total_amount > 0) {
    merged.total_amount = secondary.total_amount;
  }
  if (!primary.currency && secondary.currency) {
    merged.currency = secondary.currency;
  }
  if (!primary.date && secondary.date) {
    merged.date = secondary.date;
  }

  // For other fields, fill in gaps
  if (!primary.website && secondary.website) {
    merged.website = secondary.website;
  }
  if (!primary.invoice_number && secondary.invoice_number) {
    merged.invoice_number = secondary.invoice_number;
  }
  if (!primary.tax_amount && secondary.tax_amount) {
    merged.tax_amount = secondary.tax_amount;
  }
  if (!primary.tax_rate && secondary.tax_rate) {
    merged.tax_rate = secondary.tax_rate;
  }
  if (!primary.iban && secondary.iban) {
    merged.iban = secondary.iban;
  }

  return merged;
}

export default {
  extractDocumentWithGemini,
};
