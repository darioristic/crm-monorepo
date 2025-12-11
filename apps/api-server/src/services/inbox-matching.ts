/**
 * Inbox Matching Service
 *
 * Provides document-to-transaction matching with:
 * - Multi-tier query strategy
 * - Semantic embeddings
 * - Per-tenant calibration
 * - Merchant pattern learning
 *
 * Adapted from Midday's matching system.
 */

import { sql as db } from "../db/client";
import {
  calculateAmountScore,
  calculateCurrencyScore,
  calculateDateScore,
  createMatchSuggestion,
  type InboxType,
} from "../db/queries/inbox";
import { serviceLogger } from "../lib/logger";
import {
  cosineSimilarity,
  generateEmbedding,
  prepareInboxText,
  prepareTransactionText,
} from "./embeddings";
import {
  findMatchesTiered,
  findInboxMatchesForTransaction,
  type MatchResult,
} from "./advanced-matching.service";
import { getCalibration, updateCalibration } from "./calibration.service";

// ==============================================
// THRESHOLDS & WEIGHTS
// ==============================================

export const EMBEDDING_THRESHOLDS = {
  PERFECT_MATCH: 0.15, // Very similar (cosine distance)
  STRONG_MATCH: 0.35, // Strong semantic similarity
  GOOD_MATCH: 0.45, // Moderate similarity
  WEAK_MATCH: 0.6, // Weak but possible match
} as const;

export const CONFIDENCE_THRESHOLDS = {
  AUTO_MATCH: 0.9, // Auto-link without user confirmation
  HIGH_CONFIDENCE: 0.72, // High confidence suggestion
  SUGGESTED: 0.6, // Regular suggestion
} as const;

// Weighted scoring configuration
const DEFAULT_WEIGHTS = {
  embeddingWeight: 0.5, // 50% - Semantic similarity
  amountWeight: 0.35, // 35% - Financial accuracy
  currencyWeight: 0.1, // 10% - Currency alignment
  dateWeight: 0.05, // 5% - Temporal alignment
};

// ==============================================
// TYPES
// ==============================================

interface InboxItem {
  id: string;
  displayName: string | null;
  website: string | null;
  description: string | null;
  amount: number | null;
  currency: string | null;
  date: string | null;
  type: InboxType | null;
}

interface PaymentItem {
  id: string;
  name: string | null;
  description: string | null;
  merchantName: string | null;
  amount: number | null;
  currency: string | null;
  date: string | null;
}

interface MatchCandidate {
  paymentId: string;
  embeddingScore: number;
  amountScore: number;
  currencyScore: number;
  dateScore: number;
  confidenceScore: number;
  matchType: "auto_matched" | "high_confidence" | "suggested";
}

// ==============================================
// MATCHING FUNCTIONS
// ==============================================

/**
 * Find best payment matches for an inbox item
 */
export async function findMatchesForInbox(
  tenantId: string,
  inboxItem: InboxItem
): Promise<MatchCandidate[]> {
  try {
    // Get potential payment candidates (recent unmatched payments)
    const candidates = await getPaymentCandidates(tenantId, inboxItem);

    if (candidates.length === 0) {
      serviceLogger.info({ inboxId: inboxItem.id }, "No payment candidates found");
      return [];
    }

    // Generate embedding for inbox item
    const inboxText = prepareInboxText({
      displayName: inboxItem.displayName,
      website: inboxItem.website,
      description: inboxItem.description,
    });

    const { embedding: inboxEmbedding } = await generateEmbedding(inboxText);

    // Score all candidates
    const scoredCandidates: MatchCandidate[] = [];

    for (const payment of candidates) {
      const scores = await calculateMatchScores(inboxItem, payment, inboxEmbedding);

      if (scores.confidenceScore >= CONFIDENCE_THRESHOLDS.SUGGESTED) {
        scoredCandidates.push({
          paymentId: payment.id,
          ...scores,
        });
      }
    }

    // Sort by confidence score
    scoredCandidates.sort((a, b) => b.confidenceScore - a.confidenceScore);

    // Return top matches (limit to 5)
    return scoredCandidates.slice(0, 5);
  } catch (error) {
    serviceLogger.error({ error, inboxId: inboxItem.id }, "Error finding matches");
    return [];
  }
}

/**
 * Calculate all match scores between inbox and payment
 */
async function calculateMatchScores(
  inbox: InboxItem,
  payment: PaymentItem,
  inboxEmbedding: number[]
): Promise<Omit<MatchCandidate, "paymentId">> {
  // Generate payment embedding
  const paymentText = prepareTransactionText({
    name: payment.name,
    description: payment.description,
    merchantName: payment.merchantName,
  });

  const { embedding: paymentEmbedding } = await generateEmbedding(paymentText);

  // Calculate individual scores
  const embeddingScore = cosineSimilarity(inboxEmbedding, paymentEmbedding);

  const amountScore = calculateAmountScore({ amount: inbox.amount }, { amount: payment.amount });

  const currencyScore = calculateCurrencyScore(
    inbox.currency || undefined,
    payment.currency || undefined
  );

  const dateScore = calculateDateScore(inbox.date, payment.date, inbox.type);

  // Calculate weighted confidence score
  let confidenceScore =
    embeddingScore * DEFAULT_WEIGHTS.embeddingWeight +
    amountScore * DEFAULT_WEIGHTS.amountWeight +
    currencyScore * DEFAULT_WEIGHTS.currencyWeight +
    dateScore * DEFAULT_WEIGHTS.dateWeight;

  // Perfect financial match bonus
  const isPerfectFinancialMatch =
    inbox.amount !== null &&
    payment.amount !== null &&
    Math.abs(Math.abs(inbox.amount) - Math.abs(payment.amount)) < 0.01 &&
    inbox.currency === payment.currency;

  if (isPerfectFinancialMatch && embeddingScore > 0.85 && dateScore > 0.7) {
    confidenceScore = Math.max(confidenceScore, 0.96);
  } else if (isPerfectFinancialMatch && embeddingScore > 0.75 && dateScore > 0.7) {
    confidenceScore = Math.max(confidenceScore, 0.94);
  } else if (isPerfectFinancialMatch && embeddingScore > 0.65 && dateScore > 0.6) {
    confidenceScore = Math.max(confidenceScore, 0.88);
  }

  // Determine match type
  let matchType: "auto_matched" | "high_confidence" | "suggested" = "suggested";

  if (confidenceScore >= CONFIDENCE_THRESHOLDS.AUTO_MATCH) {
    matchType = "auto_matched";
  } else if (confidenceScore >= CONFIDENCE_THRESHOLDS.HIGH_CONFIDENCE) {
    matchType = "high_confidence";
  }

  return {
    embeddingScore,
    amountScore,
    currencyScore,
    dateScore,
    confidenceScore,
    matchType,
  };
}

/**
 * Get potential payment candidates for matching
 */
async function getPaymentCandidates(tenantId: string, inbox: InboxItem): Promise<PaymentItem[]> {
  try {
    // Get payments from the last 90 days that aren't already matched
    const inboxDate = inbox.date ? new Date(inbox.date) : new Date();
    const startDate = new Date(inboxDate);
    startDate.setDate(startDate.getDate() - 60);
    const endDate = new Date(inboxDate);
    endDate.setDate(endDate.getDate() + 30);

    // Query payments table
    const result = await db`
      SELECT
        id,
        description as name,
        notes as description,
        vendor_name as merchant_name,
        amount,
        currency,
        payment_date as date
      FROM payments
      WHERE tenant_id = ${tenantId}
        AND status = 'completed'
        AND payment_date BETWEEN ${startDate.toISOString()} AND ${endDate.toISOString()}
      ORDER BY payment_date DESC
      LIMIT 100
    `;

    return result.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      name: row.name as string | null,
      description: row.description as string | null,
      merchantName: row.merchant_name as string | null,
      amount: row.amount ? Number(row.amount) : null,
      currency: row.currency as string | null,
      date: row.date as string | null,
    }));
  } catch (error) {
    serviceLogger.error({ error }, "Error getting payment candidates");
    return [];
  }
}

/**
 * Process matching for an inbox item using advanced tiered strategy
 */
export async function processInboxMatching(
  tenantId: string,
  inboxId: string
): Promise<{
  matches: number;
  autoMatched: boolean;
  matchResult?: MatchResult;
}> {
  try {
    // Use advanced tiered matching
    const match = await findMatchesTiered(tenantId, inboxId);

    if (!match) {
      // Update inbox status to no_match
      await db`
        UPDATE inbox
        SET status = 'no_match', updated_at = NOW()
        WHERE id = ${inboxId} AND tenant_id = ${tenantId}
      `;
      return { matches: 0, autoMatched: false };
    }

    // Create match suggestion
    await createMatchSuggestion({
      tenantId,
      inboxId,
      transactionId: match.paymentId,
      confidenceScore: match.confidenceScore,
      amountScore: match.amountScore,
      currencyScore: match.currencyScore,
      dateScore: match.dateScore,
      embeddingScore: match.embeddingScore,
      matchType: match.matchType,
      matchDetails: {
        tier: match.tier,
        isPerfectFinancialMatch: match.isPerfectFinancialMatch,
        merchantPatternEligible: match.merchantPatternEligible,
        reason: match.reason,
      },
    });

    let autoMatched = false;

    // Auto-match if confidence is high enough
    if (match.matchType === "auto_matched") {
      await db`
        UPDATE inbox
        SET status = 'done', transaction_id = ${match.paymentId}, updated_at = NOW()
        WHERE id = ${inboxId} AND tenant_id = ${tenantId}
      `;
      autoMatched = true;
    } else {
      // Update inbox status to suggested_match
      await db`
        UPDATE inbox
        SET status = 'suggested_match', updated_at = NOW()
        WHERE id = ${inboxId} AND tenant_id = ${tenantId}
      `;
    }

    serviceLogger.info(
      {
        inboxId,
        paymentId: match.paymentId,
        confidence: match.confidenceScore,
        matchType: match.matchType,
        tier: match.tier,
        autoMatched,
      },
      "Inbox matching completed"
    );

    return { matches: 1, autoMatched, matchResult: match };
  } catch (error) {
    serviceLogger.error({ error, inboxId }, "Error processing inbox matching");
    return { matches: 0, autoMatched: false };
  }
}

/**
 * Process matching for a transaction (reverse direction)
 * Finds inbox items that match a given transaction
 */
export async function processTransactionMatching(
  tenantId: string,
  transactionId: string
): Promise<{
  matched: boolean;
  inboxId?: string;
  matchResult?: MatchResult;
}> {
  try {
    const match = await findInboxMatchesForTransaction(tenantId, transactionId);

    if (!match) {
      return { matched: false };
    }

    // In reverse matching, paymentId is actually the inboxId
    const inboxId = match.paymentId;

    // Create match suggestion
    await createMatchSuggestion({
      tenantId,
      inboxId,
      transactionId,
      confidenceScore: match.confidenceScore,
      amountScore: match.amountScore,
      currencyScore: match.currencyScore,
      dateScore: match.dateScore,
      embeddingScore: match.embeddingScore,
      matchType: match.matchType,
      matchDetails: {
        direction: "transaction_to_inbox",
        tier: match.tier,
        isPerfectFinancialMatch: match.isPerfectFinancialMatch,
      },
    });

    let autoMatched = false;

    if (match.matchType === "auto_matched") {
      await db`
        UPDATE inbox
        SET status = 'done', transaction_id = ${transactionId}, updated_at = NOW()
        WHERE id = ${inboxId} AND tenant_id = ${tenantId}
      `;
      autoMatched = true;
    } else {
      await db`
        UPDATE inbox
        SET status = 'suggested_match', updated_at = NOW()
        WHERE id = ${inboxId} AND tenant_id = ${tenantId}
      `;
    }

    serviceLogger.info(
      {
        transactionId,
        inboxId,
        confidence: match.confidenceScore,
        matchType: match.matchType,
        autoMatched,
      },
      "Transaction matching completed"
    );

    return { matched: true, inboxId, matchResult: match };
  } catch (error) {
    serviceLogger.error({ error, transactionId }, "Error processing transaction matching");
    return { matched: false };
  }
}

/**
 * Batch process matching for multiple inbox items
 */
export async function batchProcessMatching(
  tenantId: string,
  inboxIds: string[]
): Promise<{
  processed: number;
  autoMatched: number;
  suggestions: number;
}> {
  let processed = 0;
  let autoMatched = 0;
  let suggestions = 0;

  for (const inboxId of inboxIds) {
    const result = await processInboxMatching(tenantId, inboxId);
    processed++;
    if (result.autoMatched) {
      autoMatched++;
    }
    suggestions += result.matches;
  }

  return { processed, autoMatched, suggestions };
}

export default {
  findMatchesForInbox,
  processInboxMatching,
  batchProcessMatching,
  EMBEDDING_THRESHOLDS,
  CONFIDENCE_THRESHOLDS,
};
