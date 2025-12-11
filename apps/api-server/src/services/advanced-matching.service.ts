/**
 * Advanced Inbox Matching Service
 *
 * Implements multi-tier query strategy for document-transaction matching.
 * Uses semantic embeddings, financial accuracy, and merchant pattern learning.
 *
 * Based on Midday's sophisticated matching algorithm.
 */

import { sql as db } from "../db/client";
import { serviceLogger } from "../lib/logger";
import {
  calculateAmountScore,
  calculateCurrencyScore,
  calculateDateScore,
  wasPreviouslyDismissed,
  type InboxType,
} from "../db/queries/inbox";
import {
  checkMerchantPatternEligibility,
  MERCHANT_PATTERN_CONSTANTS,
} from "../db/queries/merchant-patterns";
import { getCalibration, CALIBRATION_CONSTANTS } from "./calibration.service";
import {
  cosineSimilarity,
  generateEmbedding,
  prepareInboxText,
  prepareTransactionText,
} from "./embeddings";

// ==============================================
// TYPES
// ==============================================

export interface InboxItem {
  id: string;
  tenantId: string;
  displayName: string | null;
  website: string | null;
  description: string | null;
  amount: number | null;
  baseAmount: number | null;
  currency: string | null;
  baseCurrency: string | null;
  date: string | null;
  type: InboxType | null;
}

export interface PaymentCandidate {
  id: string;
  name: string | null;
  description: string | null;
  merchantName: string | null;
  amount: number | null;
  baseAmount: number | null;
  currency: string | null;
  baseCurrency: string | null;
  date: string | null;
  embeddingDistance?: number;
}

export interface MatchResult {
  paymentId: string;
  embeddingScore: number;
  amountScore: number;
  currencyScore: number;
  dateScore: number;
  confidenceScore: number;
  matchType: "auto_matched" | "high_confidence" | "suggested";
  isPerfectFinancialMatch: boolean;
  tier: number;
  merchantPatternEligible: boolean;
  reason?: string;
}

// ==============================================
// CONSTANTS
// ==============================================

export const TIER_CONFIG = {
  // Tier 1: Perfect financial matches
  TIER_1: {
    amountTolerance: 0.01, // Exact match (±0.01)
    sameCurrency: true,
    embeddingThreshold: 0.6, // Weak semantic required
    maxResults: 5,
  },
  // Tier 2: Base currency matches (cross-currency)
  TIER_2: {
    amountTolerance: 0.15, // 15% tolerance for base currency
    baseCurrencyMatch: true,
    embeddingThreshold: 0.6,
    maxResults: 5,
  },
  // Tier 3: Strong semantic matches
  TIER_3: {
    amountTolerance: 0.2, // 20% tolerance
    embeddingThreshold: 0.35, // Strong semantic
    maxResults: 10,
  },
  // Tier 4: Good semantic matches (fallback)
  TIER_4: {
    amountTolerance: 0.2,
    embeddingThreshold: 0.45, // Good semantic
    maxResults: 10,
  },
} as const;

// Date ranges by document type
const DATE_RANGES = {
  expense: {
    daysBefore: 93, // Receipt/expense can be up to 93 days after transaction
    daysAfter: 10,
  },
  invoice: {
    daysBefore: 10, // Invoice is usually before payment
    daysAfter: 123, // Payment can be up to ~4 months after invoice (Net 90+)
  },
  default: {
    daysBefore: 60,
    daysAfter: 30,
  },
};

// Weights for confidence scoring
const SCORING_WEIGHTS = {
  default: {
    embedding: 0.5,
    amount: 0.35,
    currency: 0.1,
    date: 0.05,
  },
  perfectFinancial: {
    // Rebalanced when amount+currency match perfectly
    embedding: 0.25,
    amount: 0.45,
    currency: 0.15,
    date: 0.15,
  },
};

// ==============================================
// MAIN FUNCTIONS
// ==============================================

/**
 * Find best payment match for an inbox item using multi-tier strategy
 */
export async function findMatchesTiered(
  tenantId: string,
  inboxId: string
): Promise<MatchResult | null> {
  try {
    // Get inbox item with embedding
    const inbox = await getInboxWithEmbedding(tenantId, inboxId);
    if (!inbox || !inbox.embedding) {
      serviceLogger.warn({ inboxId }, "No inbox item or embedding found");
      return null;
    }

    if (!inbox.date) {
      serviceLogger.warn({ inboxId }, "No date on inbox item, skipping matching");
      return null;
    }

    // Get calibrated thresholds for this tenant
    const calibration = await getCalibration(tenantId);

    // Execute tiered queries
    const candidates = await executeTieredQueries(tenantId, inbox);

    if (candidates.length === 0) {
      serviceLogger.info({ inboxId }, "No candidates found from tiered queries");
      return null;
    }

    // Score and rank candidates
    const scoredCandidates = await scoreCandidates(inbox, candidates, calibration);

    // Filter dismissed matches
    const validCandidates: Array<MatchResult & { dismissed: boolean }> = [];
    for (const candidate of scoredCandidates) {
      const dismissed = await wasPreviouslyDismissed(tenantId, inboxId, candidate.paymentId);
      validCandidates.push({ ...candidate, dismissed });
    }

    const filteredCandidates = validCandidates.filter((c) => !c.dismissed);

    if (filteredCandidates.length === 0) {
      serviceLogger.info({ inboxId }, "All candidates were previously dismissed");
      return null;
    }

    // Get best match
    const bestMatch = filteredCandidates[0];

    // Check merchant pattern eligibility for auto-match
    if (bestMatch.confidenceScore >= calibration.calibratedSuggestedThreshold) {
      const patternResult = await checkMerchantPatternEligibility(
        tenantId,
        inbox.embedding,
        await getPaymentEmbedding(tenantId, bestMatch.paymentId),
        {
          embeddingScore: bestMatch.embeddingScore,
          amountScore: bestMatch.amountScore,
          dateScore: bestMatch.dateScore,
          confidenceScore: bestMatch.confidenceScore,
          isPerfectFinancialMatch: bestMatch.isPerfectFinancialMatch,
        }
      );

      bestMatch.merchantPatternEligible = patternResult.canAutoMatch;

      // Upgrade to auto-match if pattern eligible and confidence is reasonable
      if (
        patternResult.canAutoMatch &&
        bestMatch.matchType !== "auto_matched" &&
        bestMatch.confidenceScore >= calibration.calibratedHighConfidenceThreshold
      ) {
        bestMatch.matchType = "auto_matched";
        bestMatch.reason = patternResult.reason;
      }
    }

    serviceLogger.info(
      {
        inboxId,
        paymentId: bestMatch.paymentId,
        confidence: bestMatch.confidenceScore,
        matchType: bestMatch.matchType,
        tier: bestMatch.tier,
      },
      "Best match found"
    );

    return bestMatch;
  } catch (error) {
    serviceLogger.error({ error, inboxId }, "Error in findMatchesTiered");
    return null;
  }
}

/**
 * Find inbox matches for a transaction (reverse matching)
 */
export async function findInboxMatchesForTransaction(
  tenantId: string,
  transactionId: string
): Promise<MatchResult | null> {
  try {
    // Get transaction with embedding
    const transaction = await getTransactionWithEmbedding(tenantId, transactionId);
    if (!transaction || !transaction.embedding) {
      serviceLogger.warn({ transactionId }, "No transaction or embedding found");
      return null;
    }

    // Get calibrated thresholds
    const calibration = await getCalibration(tenantId);

    // Find pending inbox items that could match
    const inboxCandidates = await findPendingInboxCandidates(tenantId, transaction);

    if (inboxCandidates.length === 0) {
      serviceLogger.info({ transactionId }, "No pending inbox candidates found");
      return null;
    }

    // Score each inbox item against the transaction
    const scoredMatches: MatchResult[] = [];

    for (const inbox of inboxCandidates) {
      // Check if previously dismissed
      const dismissed = await wasPreviouslyDismissed(tenantId, inbox.id, transactionId);
      if (dismissed) continue;

      const scores = await calculateScores(inbox, transaction, calibration);
      if (scores.confidenceScore >= calibration.calibratedSuggestedThreshold) {
        scoredMatches.push({
          ...scores,
          paymentId: inbox.id, // In this context, paymentId is actually inboxId
          tier: 1,
          merchantPatternEligible: false,
        });
      }
    }

    if (scoredMatches.length === 0) {
      return null;
    }

    // Sort by confidence and return best
    scoredMatches.sort((a, b) => b.confidenceScore - a.confidenceScore);
    return scoredMatches[0];
  } catch (error) {
    serviceLogger.error({ error, transactionId }, "Error in findInboxMatchesForTransaction");
    return null;
  }
}

// ==============================================
// TIERED QUERY EXECUTION
// ==============================================

interface InboxWithEmbedding extends InboxItem {
  embedding: number[];
}

async function executeTieredQueries(
  tenantId: string,
  inbox: InboxWithEmbedding
): Promise<PaymentCandidate[]> {
  const allCandidates: PaymentCandidate[] = [];
  const seenIds = new Set<string>();
  const dateRange = getDateRange(inbox.type, inbox.date!);
  const embeddingStr = `[${inbox.embedding.join(",")}]`;

  // Tier 1: Perfect financial matches
  const tier1 = await queryTier1(tenantId, inbox, embeddingStr, dateRange);
  for (const c of tier1) {
    if (!seenIds.has(c.id)) {
      seenIds.add(c.id);
      allCandidates.push(c);
    }
  }

  // Tier 2: Base currency matches (only if cross-currency scenario)
  if (allCandidates.length < 15 && inbox.baseCurrency) {
    const tier2 = await queryTier2(tenantId, inbox, embeddingStr, dateRange);
    for (const c of tier2) {
      if (!seenIds.has(c.id)) {
        seenIds.add(c.id);
        allCandidates.push(c);
      }
    }
  }

  // Tier 3: Strong semantic matches
  if (allCandidates.length < 15) {
    const tier3 = await queryTier3(tenantId, inbox, embeddingStr, dateRange);
    for (const c of tier3) {
      if (!seenIds.has(c.id)) {
        seenIds.add(c.id);
        allCandidates.push(c);
      }
    }
  }

  // Tier 4: Good semantic matches (fallback)
  if (allCandidates.length < 10) {
    const tier4 = await queryTier4(tenantId, inbox, embeddingStr, dateRange);
    for (const c of tier4) {
      if (!seenIds.has(c.id)) {
        seenIds.add(c.id);
        allCandidates.push(c);
      }
    }
  }

  serviceLogger.debug(
    { inboxId: inbox.id, totalCandidates: allCandidates.length },
    "Tiered query results"
  );

  return allCandidates;
}

async function queryTier1(
  tenantId: string,
  inbox: InboxWithEmbedding,
  embeddingStr: string,
  dateRange: { start: Date; end: Date }
): Promise<PaymentCandidate[]> {
  if (inbox.amount === null || inbox.currency === null) return [];

  const tolerance = TIER_CONFIG.TIER_1.amountTolerance;
  const minAmount = Math.abs(inbox.amount) * (1 - tolerance);
  const maxAmount = Math.abs(inbox.amount) * (1 + tolerance);

  const result = await db`
    SELECT
      p.id,
      p.description as name,
      p.notes as description,
      p.vendor_name as merchant_name,
      p.amount,
      p.currency,
      p.payment_date as date,
      (te.embedding <=> ${embeddingStr}::vector) as embedding_distance
    FROM payments p
    LEFT JOIN transaction_embeddings te ON te.payment_id = p.id
    WHERE p.tenant_id = ${tenantId}
      AND p.status = 'completed'
      AND p.currency = ${inbox.currency}
      AND ABS(p.amount) BETWEEN ${minAmount} AND ${maxAmount}
      AND p.payment_date BETWEEN ${dateRange.start.toISOString()} AND ${dateRange.end.toISOString()}
      AND (te.embedding IS NULL OR (te.embedding <=> ${embeddingStr}::vector) < ${TIER_CONFIG.TIER_1.embeddingThreshold})
    ORDER BY (te.embedding <=> ${embeddingStr}::vector) ASC NULLS LAST
    LIMIT ${TIER_CONFIG.TIER_1.maxResults}
  `;

  return mapPaymentResults(result);
}

async function queryTier2(
  tenantId: string,
  inbox: InboxWithEmbedding,
  embeddingStr: string,
  dateRange: { start: Date; end: Date }
): Promise<PaymentCandidate[]> {
  if (inbox.baseAmount === null || inbox.baseCurrency === null) return [];

  const tolerance = TIER_CONFIG.TIER_2.amountTolerance;
  const minAmount = Math.abs(inbox.baseAmount) * (1 - tolerance);
  const maxAmount = Math.abs(inbox.baseAmount) * (1 + tolerance);

  // Note: This assumes payments have base_amount/base_currency columns
  // If not present, this query will return empty
  try {
    const result = await db`
      SELECT
        p.id,
        p.description as name,
        p.notes as description,
        p.vendor_name as merchant_name,
        p.amount,
        p.currency,
        p.payment_date as date,
        (te.embedding <=> ${embeddingStr}::vector) as embedding_distance
      FROM payments p
      LEFT JOIN transaction_embeddings te ON te.payment_id = p.id
      WHERE p.tenant_id = ${tenantId}
        AND p.status = 'completed'
        AND p.currency != ${inbox.currency}
        AND ABS(p.amount) BETWEEN ${minAmount} AND ${maxAmount}
        AND p.payment_date BETWEEN ${dateRange.start.toISOString()} AND ${dateRange.end.toISOString()}
        AND (te.embedding IS NULL OR (te.embedding <=> ${embeddingStr}::vector) < ${TIER_CONFIG.TIER_2.embeddingThreshold})
      ORDER BY (te.embedding <=> ${embeddingStr}::vector) ASC NULLS LAST
      LIMIT ${TIER_CONFIG.TIER_2.maxResults}
    `;

    return mapPaymentResults(result);
  } catch {
    return [];
  }
}

async function queryTier3(
  tenantId: string,
  inbox: InboxWithEmbedding,
  embeddingStr: string,
  dateRange: { start: Date; end: Date }
): Promise<PaymentCandidate[]> {
  const tolerance = TIER_CONFIG.TIER_3.amountTolerance;
  const hasAmount = inbox.amount !== null;
  const minAmount = hasAmount ? Math.abs(inbox.amount!) * (1 - tolerance) : 0;
  const maxAmount = hasAmount ? Math.abs(inbox.amount!) * (1 + tolerance) : 999999999;

  const result = await db`
    SELECT
      p.id,
      p.description as name,
      p.notes as description,
      p.vendor_name as merchant_name,
      p.amount,
      p.currency,
      p.payment_date as date,
      (te.embedding <=> ${embeddingStr}::vector) as embedding_distance
    FROM payments p
    INNER JOIN transaction_embeddings te ON te.payment_id = p.id
    WHERE p.tenant_id = ${tenantId}
      AND p.status = 'completed'
      AND (te.embedding <=> ${embeddingStr}::vector) < ${TIER_CONFIG.TIER_3.embeddingThreshold}
      AND ABS(p.amount) BETWEEN ${minAmount} AND ${maxAmount}
      AND p.payment_date BETWEEN ${dateRange.start.toISOString()} AND ${dateRange.end.toISOString()}
    ORDER BY (te.embedding <=> ${embeddingStr}::vector) ASC
    LIMIT ${TIER_CONFIG.TIER_3.maxResults}
  `;

  return mapPaymentResults(result);
}

async function queryTier4(
  tenantId: string,
  inbox: InboxWithEmbedding,
  embeddingStr: string,
  dateRange: { start: Date; end: Date }
): Promise<PaymentCandidate[]> {
  const tolerance = TIER_CONFIG.TIER_4.amountTolerance;
  const hasAmount = inbox.amount !== null;
  const minAmount = hasAmount ? Math.abs(inbox.amount!) * (1 - tolerance) : 0;
  const maxAmount = hasAmount ? Math.abs(inbox.amount!) * (1 + tolerance) : 999999999;

  // Narrower date range for tier 4
  const narrowDateRange = {
    start: new Date(dateRange.start),
    end: new Date(dateRange.end),
  };
  narrowDateRange.start.setDate(narrowDateRange.start.getDate() + 30);
  narrowDateRange.end.setDate(narrowDateRange.end.getDate() - 30);

  const result = await db`
    SELECT
      p.id,
      p.description as name,
      p.notes as description,
      p.vendor_name as merchant_name,
      p.amount,
      p.currency,
      p.payment_date as date,
      (te.embedding <=> ${embeddingStr}::vector) as embedding_distance
    FROM payments p
    INNER JOIN transaction_embeddings te ON te.payment_id = p.id
    WHERE p.tenant_id = ${tenantId}
      AND p.status = 'completed'
      AND (te.embedding <=> ${embeddingStr}::vector) < ${TIER_CONFIG.TIER_4.embeddingThreshold}
      AND ABS(p.amount) BETWEEN ${minAmount} AND ${maxAmount}
      AND p.payment_date BETWEEN ${narrowDateRange.start.toISOString()} AND ${narrowDateRange.end.toISOString()}
    ORDER BY (te.embedding <=> ${embeddingStr}::vector) ASC
    LIMIT ${TIER_CONFIG.TIER_4.maxResults}
  `;

  return mapPaymentResults(result);
}

// ==============================================
// SCORING
// ==============================================

async function scoreCandidates(
  inbox: InboxWithEmbedding,
  candidates: PaymentCandidate[],
  calibration: Awaited<ReturnType<typeof getCalibration>>
): Promise<MatchResult[]> {
  const results: MatchResult[] = [];

  for (const candidate of candidates) {
    const scores = await calculateScoresForCandidate(inbox, candidate, calibration);
    if (scores) {
      results.push(scores);
    }
  }

  // Sort by confidence score descending
  results.sort((a, b) => b.confidenceScore - a.confidenceScore);

  return results;
}

async function calculateScoresForCandidate(
  inbox: InboxWithEmbedding,
  candidate: PaymentCandidate,
  calibration: Awaited<ReturnType<typeof getCalibration>>
): Promise<MatchResult | null> {
  try {
    // Get or calculate embedding score
    let embeddingScore = 0.5; // Default if no embedding
    if (candidate.embeddingDistance !== undefined) {
      embeddingScore = 1 - candidate.embeddingDistance;
    } else {
      // Generate embedding if needed
      const paymentEmbedding = await getPaymentEmbedding(inbox.tenantId, candidate.id);
      if (paymentEmbedding.length > 0) {
        embeddingScore = cosineSimilarity(inbox.embedding, paymentEmbedding);
      }
    }

    // Calculate other scores
    const amountScore = calculateAmountScore(
      { amount: inbox.amount },
      { amount: candidate.amount }
    );

    const currencyScore = calculateCurrencyScore(
      inbox.currency || undefined,
      candidate.currency || undefined
    );

    const dateScore = calculateDateScore(inbox.date, candidate.date, inbox.type);

    // Determine if perfect financial match
    const isPerfectFinancialMatch =
      inbox.amount !== null &&
      candidate.amount !== null &&
      Math.abs(Math.abs(inbox.amount) - Math.abs(candidate.amount)) < 0.01 &&
      inbox.currency === candidate.currency;

    // Select weights based on financial match
    const weights = isPerfectFinancialMatch
      ? SCORING_WEIGHTS.perfectFinancial
      : SCORING_WEIGHTS.default;

    // Calculate base confidence score
    let confidenceScore =
      embeddingScore * weights.embedding +
      amountScore * weights.amount +
      currencyScore * weights.currency +
      dateScore * weights.date;

    // Apply hybrid confidence boosts for strong matches
    confidenceScore = applyConfidenceBoosts(
      confidenceScore,
      embeddingScore,
      amountScore,
      currencyScore,
      dateScore,
      isPerfectFinancialMatch
    );

    // Determine match type based on calibrated thresholds
    let matchType: "auto_matched" | "high_confidence" | "suggested" = "suggested";
    if (confidenceScore >= calibration.calibratedAutoThreshold) {
      matchType = "auto_matched";
    } else if (confidenceScore >= calibration.calibratedHighConfidenceThreshold) {
      matchType = "high_confidence";
    } else if (confidenceScore < calibration.calibratedSuggestedThreshold) {
      return null; // Below threshold
    }

    return {
      paymentId: candidate.id,
      embeddingScore,
      amountScore,
      currencyScore,
      dateScore,
      confidenceScore: Math.min(1, Math.max(0, confidenceScore)),
      matchType,
      isPerfectFinancialMatch,
      tier: determineTier(isPerfectFinancialMatch, embeddingScore),
      merchantPatternEligible: false,
    };
  } catch (error) {
    serviceLogger.error({ error, candidateId: candidate.id }, "Error scoring candidate");
    return null;
  }
}

function applyConfidenceBoosts(
  baseScore: number,
  embedding: number,
  amount: number,
  currency: number,
  date: number,
  isPerfect: boolean
): number {
  let score = baseScore;

  // Perfect financial + strong semantic + good date
  if (isPerfect && embedding > 0.85 && date > 0.7) {
    score = Math.max(score, 0.96);
  } else if (isPerfect && embedding > 0.75 && date > 0.7) {
    score = Math.max(score, 0.94);
  } else if (isPerfect && embedding > 0.65 && date > 0.6) {
    score = Math.max(score, 0.88);
  } else if (isPerfect && embedding > 0.6 && date > 0.5) {
    score = Math.max(score, 0.9);
  } else if (isPerfect && date > 0.5) {
    score = Math.max(score, 0.88);
  }

  // Strong embedding boost
  if (embedding > 0.85) {
    score = Math.min(1, score + 0.08);
  } else if (embedding > 0.75) {
    score = Math.min(1, score + 0.05);
  }

  // Good amount + good embedding
  if (amount > 0.85 && embedding > 0.75) {
    score = Math.max(score, 0.82);
  }

  // Apply penalties for poor scores
  if (currency < 0.5 && embedding < 0.7) {
    score *= 0.95;
  }
  if (date < 0.2) {
    score *= embedding >= 0.85 ? 0.95 : 0.85;
  }

  return score;
}

// ==============================================
// HELPER FUNCTIONS
// ==============================================

async function getInboxWithEmbedding(
  tenantId: string,
  inboxId: string
): Promise<InboxWithEmbedding | null> {
  const result = await db`
    SELECT
      i.id, i.tenant_id, i.display_name, i.website, i.description,
      i.amount, i.base_amount, i.currency, i.base_currency, i.date, i.type,
      ie.embedding
    FROM inbox i
    LEFT JOIN inbox_embeddings ie ON ie.inbox_id = i.id
    WHERE i.id = ${inboxId} AND i.tenant_id = ${tenantId}
    LIMIT 1
  `;

  if (result.length === 0) return null;

  const row = result[0] as Record<string, unknown>;

  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    displayName: row.display_name as string | null,
    website: row.website as string | null,
    description: row.description as string | null,
    amount: row.amount ? Number(row.amount) : null,
    baseAmount: row.base_amount ? Number(row.base_amount) : null,
    currency: row.currency as string | null,
    baseCurrency: row.base_currency as string | null,
    date: row.date as string | null,
    type: row.type as InboxType | null,
    embedding: row.embedding ? parseEmbedding(row.embedding) : [],
  };
}

async function getTransactionWithEmbedding(
  tenantId: string,
  transactionId: string
): Promise<(PaymentCandidate & { embedding: number[] }) | null> {
  const result = await db`
    SELECT
      p.id, p.description as name, p.notes as description,
      p.vendor_name as merchant_name, p.amount, p.currency, p.payment_date as date,
      te.embedding
    FROM payments p
    LEFT JOIN transaction_embeddings te ON te.payment_id = p.id
    WHERE p.id = ${transactionId} AND p.tenant_id = ${tenantId}
    LIMIT 1
  `;

  if (result.length === 0) return null;

  const row = result[0] as Record<string, unknown>;

  return {
    id: row.id as string,
    name: row.name as string | null,
    description: row.description as string | null,
    merchantName: row.merchant_name as string | null,
    amount: row.amount ? Number(row.amount) : null,
    baseAmount: null,
    currency: row.currency as string | null,
    baseCurrency: null,
    date: row.date as string | null,
    embedding: row.embedding ? parseEmbedding(row.embedding) : [],
  };
}

async function getPaymentEmbedding(tenantId: string, paymentId: string): Promise<number[]> {
  const result = await db`
    SELECT embedding FROM transaction_embeddings
    WHERE payment_id = ${paymentId} AND tenant_id = ${tenantId}
    LIMIT 1
  `;

  if (result.length === 0) return [];
  return parseEmbedding(result[0].embedding);
}

async function findPendingInboxCandidates(
  tenantId: string,
  transaction: PaymentCandidate & { embedding: number[] }
): Promise<InboxWithEmbedding[]> {
  const dateRange = getDateRange("expense", transaction.date!);
  const embeddingStr = `[${transaction.embedding.join(",")}]`;

  const result = await db`
    SELECT
      i.id, i.tenant_id, i.display_name, i.website, i.description,
      i.amount, i.base_amount, i.currency, i.base_currency, i.date, i.type,
      ie.embedding
    FROM inbox i
    INNER JOIN inbox_embeddings ie ON ie.inbox_id = i.id
    WHERE i.tenant_id = ${tenantId}
      AND i.status IN ('pending', 'analyzing')
      AND i.transaction_id IS NULL
      AND i.date BETWEEN ${dateRange.start.toISOString()} AND ${dateRange.end.toISOString()}
      AND (ie.embedding <=> ${embeddingStr}::vector) < 0.6
    ORDER BY (ie.embedding <=> ${embeddingStr}::vector) ASC
    LIMIT 20
  `;

  return result.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    tenantId: row.tenant_id as string,
    displayName: row.display_name as string | null,
    website: row.website as string | null,
    description: row.description as string | null,
    amount: row.amount ? Number(row.amount) : null,
    baseAmount: row.base_amount ? Number(row.base_amount) : null,
    currency: row.currency as string | null,
    baseCurrency: row.base_currency as string | null,
    date: row.date as string | null,
    type: row.type as InboxType | null,
    embedding: row.embedding ? parseEmbedding(row.embedding) : [],
  }));
}

async function calculateScores(
  inbox: InboxWithEmbedding,
  transaction: PaymentCandidate & { embedding: number[] },
  calibration: Awaited<ReturnType<typeof getCalibration>>
): Promise<Omit<MatchResult, "paymentId" | "tier" | "merchantPatternEligible">> {
  const embeddingScore =
    inbox.embedding.length > 0 && transaction.embedding.length > 0
      ? cosineSimilarity(inbox.embedding, transaction.embedding)
      : 0.5;

  const amountScore = calculateAmountScore(
    { amount: inbox.amount },
    { amount: transaction.amount }
  );

  const currencyScore = calculateCurrencyScore(
    inbox.currency || undefined,
    transaction.currency || undefined
  );

  const dateScore = calculateDateScore(inbox.date, transaction.date, inbox.type);

  const isPerfectFinancialMatch =
    inbox.amount !== null &&
    transaction.amount !== null &&
    Math.abs(Math.abs(inbox.amount) - Math.abs(transaction.amount)) < 0.01 &&
    inbox.currency === transaction.currency;

  const weights = isPerfectFinancialMatch
    ? SCORING_WEIGHTS.perfectFinancial
    : SCORING_WEIGHTS.default;

  let confidenceScore =
    embeddingScore * weights.embedding +
    amountScore * weights.amount +
    currencyScore * weights.currency +
    dateScore * weights.date;

  confidenceScore = applyConfidenceBoosts(
    confidenceScore,
    embeddingScore,
    amountScore,
    currencyScore,
    dateScore,
    isPerfectFinancialMatch
  );

  let matchType: "auto_matched" | "high_confidence" | "suggested" = "suggested";
  if (confidenceScore >= calibration.calibratedAutoThreshold) {
    matchType = "auto_matched";
  } else if (confidenceScore >= calibration.calibratedHighConfidenceThreshold) {
    matchType = "high_confidence";
  }

  return {
    embeddingScore,
    amountScore,
    currencyScore,
    dateScore,
    confidenceScore: Math.min(1, Math.max(0, confidenceScore)),
    matchType,
    isPerfectFinancialMatch,
  };
}

function getDateRange(
  type: InboxType | null,
  inboxDate: string
): { start: Date; end: Date } {
  const config = type ? DATE_RANGES[type] || DATE_RANGES.default : DATE_RANGES.default;
  const baseDate = new Date(inboxDate);

  const start = new Date(baseDate);
  start.setDate(start.getDate() - config.daysBefore);

  const end = new Date(baseDate);
  end.setDate(end.getDate() + config.daysAfter);

  return { start, end };
}

function mapPaymentResults(rows: Array<Record<string, unknown>>): PaymentCandidate[] {
  return rows.map((row) => ({
    id: row.id as string,
    name: row.name as string | null,
    description: row.description as string | null,
    merchantName: row.merchant_name as string | null,
    amount: row.amount ? Number(row.amount) : null,
    baseAmount: null,
    currency: row.currency as string | null,
    baseCurrency: null,
    date: row.date as string | null,
    embeddingDistance: row.embedding_distance ? Number(row.embedding_distance) : undefined,
  }));
}

function parseEmbedding(embedding: unknown): number[] {
  if (Array.isArray(embedding)) return embedding;
  if (typeof embedding === "string") {
    try {
      return JSON.parse(embedding);
    } catch {
      // Handle pgvector format: [1,2,3,...]
      return embedding
        .replace(/[\[\]]/g, "")
        .split(",")
        .map(Number);
    }
  }
  return [];
}

function determineTier(isPerfect: boolean, embeddingScore: number): number {
  if (isPerfect) return 1;
  if (embeddingScore > 0.65) return 3;
  if (embeddingScore > 0.55) return 4;
  return 4;
}

// ==============================================
// EXPORTS
// ==============================================

export default {
  findMatchesTiered,
  findInboxMatchesForTransaction,
  TIER_CONFIG,
  SCORING_WEIGHTS,
};
