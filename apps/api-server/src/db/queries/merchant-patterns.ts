/**
 * Merchant Pattern Queries
 *
 * Implements semantic merchant pattern learning for auto-match eligibility.
 * Tracks historical match patterns by merchant embedding similarity.
 *
 * Based on Midday's merchant pattern recognition system.
 */

import { sql as db } from "../client";
import { serviceLogger } from "../../lib/logger";

// ==============================================
// TYPES
// ==============================================

export interface MerchantPatternResult {
  canAutoMatch: boolean;
  confidence: number;
  historicalAccuracy: number;
  matchCount: number;
  confirmedCount: number;
  negativeCount: number;
  avgConfidence: number;
  reason: string;
}

export interface PatternHistoryItem {
  suggestionId: string;
  status: string;
  confidenceScore: number;
  inboxSimilarity: number;
  transactionSimilarity: number;
  createdAt: string;
}

// ==============================================
// CONSTANTS
// ==============================================

export const MERCHANT_PATTERN_CONSTANTS = {
  // Similarity thresholds (cosine distance)
  SIMILARITY_THRESHOLD: 0.15, // Very similar merchants

  // Auto-match eligibility criteria
  MIN_CONFIRMED_MATCHES: 3, // Minimum confirmed matches for pattern
  MIN_ACCURACY: 0.9, // 90% accuracy required
  MAX_NEGATIVE_SIGNALS: 1, // Maximum declined/unmatched allowed
  MIN_AVG_CONFIDENCE: 0.85, // Minimum average confidence for pattern

  // Time constraints
  LOOKBACK_MONTHS: 6, // Only consider patterns from last 6 months

  // Current match requirements
  CURRENT_MIN_EMBEDDING: 0.85, // Current match must have strong embedding
  CURRENT_MIN_DATE_SCORE: 0.7, // Current match must have good date alignment
} as const;

// ==============================================
// MAIN FUNCTIONS
// ==============================================

/**
 * Check if a merchant pattern exists that allows auto-matching
 *
 * @param tenantId - Tenant ID
 * @param inboxEmbedding - 768D embedding vector for inbox item
 * @param transactionEmbedding - 768D embedding vector for transaction
 * @param currentMatch - Current match scores for validation
 */
export async function checkMerchantPatternEligibility(
  tenantId: string,
  inboxEmbedding: number[],
  transactionEmbedding: number[],
  currentMatch?: {
    embeddingScore: number;
    amountScore: number;
    dateScore: number;
    confidenceScore: number;
    isPerfectFinancialMatch: boolean;
  }
): Promise<MerchantPatternResult> {
  try {
    // Query historical patterns using database function
    const patterns = await findSimilarMerchantPatterns(
      tenantId,
      inboxEmbedding,
      transactionEmbedding
    );

    // Analyze patterns
    const analysis = analyzePatterns(patterns);

    // Check eligibility
    const eligibility = checkEligibility(analysis, currentMatch);

    serviceLogger.debug(
      {
        tenantId,
        matchCount: analysis.totalMatches,
        confirmedCount: analysis.confirmedCount,
        accuracy: analysis.accuracy,
        canAutoMatch: eligibility.canAutoMatch,
      },
      "Merchant pattern check completed"
    );

    return eligibility;
  } catch (error) {
    serviceLogger.error({ error, tenantId }, "Error checking merchant pattern");

    // Return conservative result on error
    return {
      canAutoMatch: false,
      confidence: 0,
      historicalAccuracy: 0,
      matchCount: 0,
      confirmedCount: 0,
      negativeCount: 0,
      avgConfidence: 0,
      reason: "Error checking patterns",
    };
  }
}

/**
 * Find historical match patterns for similar merchants
 */
export async function findSimilarMerchantPatterns(
  tenantId: string,
  inboxEmbedding: number[],
  transactionEmbedding: number[]
): Promise<PatternHistoryItem[]> {
  try {
    const lookbackDate = new Date();
    lookbackDate.setMonth(lookbackDate.getMonth() - MERCHANT_PATTERN_CONSTANTS.LOOKBACK_MONTHS);

    const inboxEmbeddingStr = `[${inboxEmbedding.join(",")}]`;
    const transactionEmbeddingStr = `[${transactionEmbedding.join(",")}]`;
    const threshold = MERCHANT_PATTERN_CONSTANTS.SIMILARITY_THRESHOLD;

    const result = await db`
      SELECT
        tms.id as suggestion_id,
        tms.status,
        tms.confidence_score,
        1 - (ie.embedding <=> ${inboxEmbeddingStr}::vector) as inbox_similarity,
        1 - (te.embedding <=> ${transactionEmbeddingStr}::vector) as transaction_similarity,
        tms.created_at
      FROM transaction_match_suggestions tms
      INNER JOIN inbox_embeddings ie ON tms.inbox_id = ie.inbox_id
      INNER JOIN transaction_embeddings te ON tms.transaction_id = te.payment_id
      WHERE tms.tenant_id = ${tenantId}
        AND tms.status IN ('confirmed', 'declined', 'unmatched')
        AND tms.created_at > ${lookbackDate.toISOString()}
        AND (ie.embedding <=> ${inboxEmbeddingStr}::vector) < ${threshold}
        AND (te.embedding <=> ${transactionEmbeddingStr}::vector) < ${threshold}
      ORDER BY tms.created_at DESC
      LIMIT 20
    `;

    return result.map((row: Record<string, unknown>) => ({
      suggestionId: row.suggestion_id as string,
      status: row.status as string,
      confidenceScore: Number(row.confidence_score),
      inboxSimilarity: Number(row.inbox_similarity),
      transactionSimilarity: Number(row.transaction_similarity),
      createdAt: row.created_at as string,
    }));
  } catch (error) {
    serviceLogger.error({ error, tenantId }, "Error finding merchant patterns");
    return [];
  }
}

/**
 * Get merchant pattern statistics for a tenant
 */
export async function getMerchantPatternStats(tenantId: string): Promise<{
  totalPatterns: number;
  avgAccuracy: number;
  eligibleMerchants: number;
}> {
  try {
    // This is a simplified query - in production you'd want more sophisticated analysis
    const result = await db`
      SELECT
        COUNT(DISTINCT tms.id) as total_patterns,
        AVG(CASE WHEN tms.status = 'confirmed' THEN 1.0 ELSE 0.0 END) as avg_accuracy
      FROM transaction_match_suggestions tms
      WHERE tms.tenant_id = ${tenantId}
        AND tms.status IN ('confirmed', 'declined', 'unmatched')
        AND tms.created_at > NOW() - INTERVAL '6 months'
    `;

    const row = result[0] as Record<string, unknown>;

    return {
      totalPatterns: Number(row.total_patterns) || 0,
      avgAccuracy: Number(row.avg_accuracy) || 0,
      eligibleMerchants: 0, // Would require more complex query
    };
  } catch (error) {
    serviceLogger.error({ error, tenantId }, "Error getting pattern stats");
    return { totalPatterns: 0, avgAccuracy: 0, eligibleMerchants: 0 };
  }
}

// ==============================================
// HELPER FUNCTIONS
// ==============================================

interface PatternAnalysis {
  totalMatches: number;
  confirmedCount: number;
  declinedCount: number;
  unmatchedCount: number;
  negativeCount: number;
  accuracy: number;
  avgConfidence: number;
  avgConfidenceConfirmed: number;
  recentActivity: boolean;
}

function analyzePatterns(patterns: PatternHistoryItem[]): PatternAnalysis {
  if (patterns.length === 0) {
    return {
      totalMatches: 0,
      confirmedCount: 0,
      declinedCount: 0,
      unmatchedCount: 0,
      negativeCount: 0,
      accuracy: 0,
      avgConfidence: 0,
      avgConfidenceConfirmed: 0,
      recentActivity: false,
    };
  }

  const confirmed = patterns.filter((p) => p.status === "confirmed");
  const declined = patterns.filter((p) => p.status === "declined");
  const unmatched = patterns.filter((p) => p.status === "unmatched");

  const confirmedCount = confirmed.length;
  const declinedCount = declined.length;
  const unmatchedCount = unmatched.length;
  const negativeCount = declinedCount + unmatchedCount;
  const totalMatches = patterns.length;

  const accuracy = totalMatches > 0 ? confirmedCount / totalMatches : 0;

  const avgConfidence =
    patterns.reduce((sum, p) => sum + p.confidenceScore, 0) / patterns.length;

  const avgConfidenceConfirmed =
    confirmedCount > 0
      ? confirmed.reduce((sum, p) => sum + p.confidenceScore, 0) / confirmedCount
      : 0;

  // Check for recent activity (within last month)
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const recentActivity = patterns.some((p) => new Date(p.createdAt) > oneMonthAgo);

  return {
    totalMatches,
    confirmedCount,
    declinedCount,
    unmatchedCount,
    negativeCount,
    accuracy,
    avgConfidence,
    avgConfidenceConfirmed,
    recentActivity,
  };
}

function checkEligibility(
  analysis: PatternAnalysis,
  currentMatch?: {
    embeddingScore: number;
    amountScore: number;
    dateScore: number;
    confidenceScore: number;
    isPerfectFinancialMatch: boolean;
  }
): MerchantPatternResult {
  const {
    confirmedCount,
    negativeCount,
    accuracy,
    avgConfidenceConfirmed,
    totalMatches,
  } = analysis;

  // Base result
  const result: MerchantPatternResult = {
    canAutoMatch: false,
    confidence: 0,
    historicalAccuracy: accuracy,
    matchCount: totalMatches,
    confirmedCount,
    negativeCount,
    avgConfidence: avgConfidenceConfirmed,
    reason: "",
  };

  // Check minimum confirmed matches
  if (confirmedCount < MERCHANT_PATTERN_CONSTANTS.MIN_CONFIRMED_MATCHES) {
    result.reason = `Insufficient confirmed matches (${confirmedCount}/${MERCHANT_PATTERN_CONSTANTS.MIN_CONFIRMED_MATCHES})`;
    return result;
  }

  // Check accuracy
  if (accuracy < MERCHANT_PATTERN_CONSTANTS.MIN_ACCURACY) {
    result.reason = `Accuracy too low (${(accuracy * 100).toFixed(1)}% < ${MERCHANT_PATTERN_CONSTANTS.MIN_ACCURACY * 100}%)`;
    return result;
  }

  // Check negative signals
  if (negativeCount > MERCHANT_PATTERN_CONSTANTS.MAX_NEGATIVE_SIGNALS) {
    result.reason = `Too many negative signals (${negativeCount} > ${MERCHANT_PATTERN_CONSTANTS.MAX_NEGATIVE_SIGNALS})`;
    return result;
  }

  // Check average confidence
  if (avgConfidenceConfirmed < MERCHANT_PATTERN_CONSTANTS.MIN_AVG_CONFIDENCE) {
    result.reason = `Average confidence too low (${(avgConfidenceConfirmed * 100).toFixed(1)}%)`;
    return result;
  }

  // If current match is provided, validate it meets requirements
  if (currentMatch) {
    // Must have strong embedding similarity
    if (currentMatch.embeddingScore < MERCHANT_PATTERN_CONSTANTS.CURRENT_MIN_EMBEDDING) {
      result.reason = `Current embedding score too low (${(currentMatch.embeddingScore * 100).toFixed(1)}%)`;
      return result;
    }

    // Must have good date alignment
    if (currentMatch.dateScore < MERCHANT_PATTERN_CONSTANTS.CURRENT_MIN_DATE_SCORE) {
      result.reason = `Current date score too low (${(currentMatch.dateScore * 100).toFixed(1)}%)`;
      return result;
    }

    // Must have perfect financial match or excellent cross-currency
    if (!currentMatch.isPerfectFinancialMatch && currentMatch.amountScore < 0.95) {
      result.reason = "Financial match not strong enough for pattern-based auto-match";
      return result;
    }

    // Check if confidence meets threshold (either >= 0.9 or >= historical average - 5%)
    const minConfidence = Math.min(0.9, avgConfidenceConfirmed - 0.05);
    if (currentMatch.confidenceScore < minConfidence) {
      result.reason = `Current confidence below threshold (${(currentMatch.confidenceScore * 100).toFixed(1)}% < ${(minConfidence * 100).toFixed(1)}%)`;
      return result;
    }
  }

  // All checks passed
  result.canAutoMatch = true;
  result.confidence = avgConfidenceConfirmed;
  result.reason = `Proven merchant pattern (${confirmedCount} matches, ${(accuracy * 100).toFixed(0)}% accuracy)`;

  return result;
}

// ==============================================
// EXPORTS
// ==============================================

export default {
  checkMerchantPatternEligibility,
  findSimilarMerchantPatterns,
  getMerchantPatternStats,
  MERCHANT_PATTERN_CONSTANTS,
};
