/**
 * Transaction Enrichment Schema
 *
 * Defines the schema for AI-powered transaction enrichment using Gemini.
 * Based on Midday's implementation with confidence scoring.
 */

import { z } from "zod";

/**
 * Transaction categories that the LLM can assign.
 * Maps to the transaction_categories table in the database.
 */
export const transactionCategories = [
  // Income categories
  "income",
  "sales",
  "refunds-received",

  // Expense categories
  "office-supplies",
  "software",
  "travel",
  "meals",
  "utilities",
  "rent",
  "salaries",
  "marketing",
  "professional-services",
  "taxes",
  "bank-fees",
  "insurance",
  "equipment",
  "advertising",
  "contractors",
  "training",
  "shipping",
  "internet-and-telephone",

  // Fallback
  "other",
  "uncategorized",
] as const;

export type TransactionCategory = (typeof transactionCategories)[number];

/**
 * Single enrichment result schema
 */
export const singleEnrichmentSchema = z.object({
  merchant: z
    .string()
    .nullable()
    .describe("The formal legal business entity name (e.g., 'Google LLC', 'Amazon.com Inc')"),
  category: z
    .enum(transactionCategories)
    .nullable()
    .describe("The category of the transaction - only return if confidence is high"),
  categoryConfidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence score for the category assignment (0-1, where 1 is highest)"),
  merchantConfidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence score for the merchant name extraction (0-1, where 1 is highest)"),
});

export type EnrichmentResult = z.infer<typeof singleEnrichmentSchema>;

/**
 * Batch enrichment schema - wraps array of results for AI SDK v4.x compatibility
 * Used with Vercel AI SDK's generateObject
 */
export const enrichmentSchema = z.object({
  results: z
    .array(singleEnrichmentSchema)
    .describe("Array of enrichment results, one for each transaction in order"),
});

export type BatchEnrichmentResult = z.infer<typeof enrichmentSchema>;

/**
 * Transaction data prepared for LLM processing
 */
export interface TransactionData {
  description: string;
  amount: string;
  currency: string;
}

/**
 * Update data to apply to transaction after enrichment
 */
export interface UpdateData {
  merchantName?: string;
  categorySlug?: string;
}

/**
 * Confidence thresholds for accepting LLM results.
 * Only results meeting these thresholds will be applied.
 */
export const CONFIDENCE_THRESHOLDS = {
  /** Only accept category if confidence >= 70% */
  CATEGORY_MIN: 0.7,
  /** Only accept merchant if confidence >= 60% */
  MERCHANT_MIN: 0.6,
  /** Consider this high confidence for both */
  HIGH_CONFIDENCE: 0.9,
} as const;

/**
 * Batch processing configuration
 */
export const BATCH_CONFIG = {
  /** Number of transactions to process in each batch */
  BATCH_SIZE: 50,
  /** Temperature for LLM (low for consistency) */
  TEMPERATURE: 0.1,
  /** Maximum duration in seconds */
  MAX_DURATION: 300,
} as const;

/**
 * Check if category result should be used based on confidence
 */
export function shouldUseCategoryResult(result: EnrichmentResult): boolean {
  return (
    result.category !== null && result.categoryConfidence >= CONFIDENCE_THRESHOLDS.CATEGORY_MIN
  );
}

/**
 * Check if merchant result should be used based on confidence
 */
export function shouldUseMerchantResult(result: EnrichmentResult): boolean {
  return (
    result.merchant !== null && result.merchantConfidence >= CONFIDENCE_THRESHOLDS.MERCHANT_MIN
  );
}

/**
 * Check if result has high confidence for both fields
 */
export function isHighConfidenceResult(result: EnrichmentResult): boolean {
  return (
    result.categoryConfidence >= CONFIDENCE_THRESHOLDS.HIGH_CONFIDENCE &&
    result.merchantConfidence >= CONFIDENCE_THRESHOLDS.HIGH_CONFIDENCE
  );
}

/**
 * Validate if a category is in the allowed list
 */
export function isValidCategory(category: string): category is TransactionCategory {
  return transactionCategories.includes(category as TransactionCategory);
}
