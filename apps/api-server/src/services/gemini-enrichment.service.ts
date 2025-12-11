/**
 * Gemini Enrichment Service
 *
 * Handles AI-powered transaction enrichment using Google Gemini.
 * Uses gemini-2.5-flash-lite model for merchant name extraction and categorization.
 */

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { serviceLogger } from "../lib/logger";
import {
  type EnrichmentResult,
  type BatchEnrichmentResult,
  BATCH_CONFIG,
  enrichmentSchema,
} from "../ai/enrichment/enrichment-schema";
import {
  type TransactionForEnrichment,
  generateEnrichmentPrompt,
  prepareTransactionData,
  prepareUpdateData,
  processBatch,
} from "../ai/enrichment/enrichment-helpers";

// Initialize Google Generative AI client
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
});

/**
 * Check if Gemini enrichment is configured and available
 */
export function isGeminiEnrichmentConfigured(): boolean {
  return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
}

/**
 * Enrich a batch of transactions using Gemini AI.
 * Processes transactions and returns enrichment results with confidence scores.
 */
export async function enrichTransactionsBatchWithGemini(
  transactions: TransactionForEnrichment[]
): Promise<EnrichmentResult[]> {
  if (transactions.length === 0) {
    return [];
  }

  if (!isGeminiEnrichmentConfigured()) {
    serviceLogger.warn("Gemini API key not configured, skipping AI enrichment");
    return [];
  }

  const transactionData = prepareTransactionData(transactions);
  const prompt = generateEnrichmentPrompt(transactionData, transactions);

  serviceLogger.info(
    { batchSize: transactions.length },
    "Starting Gemini transaction enrichment batch"
  );

  try {
    // Type assertion needed due to version mismatch between @ai-sdk/google and ai packages
    // Runtime behavior is compatible
    const { object } = await generateObject({
      model: google("gemini-2.5-flash-lite") as Parameters<typeof generateObject>[0]["model"],
      prompt,
      schema: enrichmentSchema,
      temperature: BATCH_CONFIG.TEMPERATURE,
    });

    // Extract results array from wrapper object (AI SDK v4.x compatibility)
    const batchResult = object as BatchEnrichmentResult;
    const results = batchResult.results || [];

    serviceLogger.info(
      {
        batchSize: transactions.length,
        resultsCount: results.length,
      },
      "Gemini enrichment batch completed"
    );

    return results;
  } catch (error) {
    serviceLogger.error(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        batchSize: transactions.length,
      },
      "Gemini enrichment batch failed"
    );
    throw error;
  }
}

/**
 * Result of processing a single transaction enrichment
 */
export interface EnrichmentProcessResult {
  transactionId: string;
  merchantName: string | null;
  categorySlug: string | null;
  updated: boolean;
  error?: string;
}

/**
 * Process enrichment results and prepare updates.
 * Applies confidence thresholds and validates results.
 */
export function processEnrichmentResults(
  transactions: TransactionForEnrichment[],
  results: EnrichmentResult[]
): EnrichmentProcessResult[] {
  const processResults: EnrichmentProcessResult[] = [];
  const resultsToProcess = Math.min(results.length, transactions.length);

  for (let i = 0; i < resultsToProcess; i++) {
    const result = results[i];
    const transaction = transactions[i];

    if (!result || !transaction) {
      if (transaction) {
        processResults.push({
          transactionId: transaction.id,
          merchantName: null,
          categorySlug: null,
          updated: false,
          error: "No result from AI",
        });
      }
      continue;
    }

    const updateData = prepareUpdateData(transaction, result);
    const hasUpdates = Boolean(updateData.merchantName || updateData.categorySlug);

    processResults.push({
      transactionId: transaction.id,
      merchantName: updateData.merchantName || null,
      categorySlug: updateData.categorySlug || null,
      updated: hasUpdates,
    });
  }

  // Handle any remaining transactions that weren't in results
  for (let i = resultsToProcess; i < transactions.length; i++) {
    const transaction = transactions[i];
    if (transaction) {
      processResults.push({
        transactionId: transaction.id,
        merchantName: null,
        categorySlug: null,
        updated: false,
        error: "Missing from AI results",
      });
    }
  }

  return processResults;
}

/**
 * Batch enrichment statistics
 */
export interface BatchEnrichmentStats {
  totalProcessed: number;
  updatesApplied: number;
  merchantsUpdated: number;
  categoriesUpdated: number;
  noUpdateNeeded: number;
  errors: number;
}

/**
 * Calculate statistics from enrichment process results
 */
export function calculateEnrichmentStats(
  results: EnrichmentProcessResult[]
): BatchEnrichmentStats {
  return {
    totalProcessed: results.length,
    updatesApplied: results.filter((r) => r.updated).length,
    merchantsUpdated: results.filter((r) => r.merchantName).length,
    categoriesUpdated: results.filter((r) => r.categorySlug).length,
    noUpdateNeeded: results.filter((r) => !r.updated && !r.error).length,
    errors: results.filter((r) => r.error).length,
  };
}

export default {
  isGeminiEnrichmentConfigured,
  enrichTransactionsBatchWithGemini,
  processEnrichmentResults,
  calculateEnrichmentStats,
};
