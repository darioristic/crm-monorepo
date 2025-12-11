/**
 * Recurring Transaction Detection Service
 * Analyzes transaction history to identify recurring payment patterns
 * Detects subscriptions, regular bills, and other periodic payments
 */

import { sql as db } from "../db/client";
import { serviceLogger } from "../lib/logger";

// ==============================================
// TYPES
// ==============================================

export type TransactionFrequency = "weekly" | "biweekly" | "monthly" | "annually" | "unknown";

export interface RecurringPattern {
  merchantName: string | null;
  vendorName: string | null;
  categorySlug: string | null;
  averageAmount: number;
  currency: string;
  frequency: TransactionFrequency;
  confidence: number;
  transactionCount: number;
  firstSeen: string;
  lastSeen: string;
  nextExpected: string | null;
  transactionIds: string[];
}

export interface RecurringDetectionResult {
  patterns: RecurringPattern[];
  totalRecurring: number;
  monthlyTotal: number;
  analyzedTransactions: number;
}

interface TransactionForAnalysis {
  id: string;
  amount: number;
  currency: string;
  paymentDate: Date;
  merchantName: string | null;
  vendorName: string | null;
  categorySlug: string | null;
  reference: string | null;
}

// ==============================================
// CONFIGURATION
// ==============================================

const DETECTION_CONFIG = {
  // Minimum transactions to consider a pattern
  minTransactions: 2,

  // Amount tolerance for matching (percentage)
  amountTolerancePercent: 5,

  // Time windows for frequency detection (in days)
  frequencyWindows: {
    weekly: { min: 5, max: 9, expected: 7 },
    biweekly: { min: 12, max: 16, expected: 14 },
    monthly: { min: 26, max: 35, expected: 30 },
    annually: { min: 350, max: 380, expected: 365 },
  },

  // Minimum confidence threshold
  minConfidence: 0.6,

  // Maximum days to look back
  lookbackDays: 365,
};

// ==============================================
// HELPER FUNCTIONS
// ==============================================

/**
 * Calculate the average interval between dates
 */
function calculateAverageInterval(dates: Date[]): number {
  if (dates.length < 2) return 0;

  const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
  let totalDays = 0;

  for (let i = 1; i < sortedDates.length; i++) {
    const diffMs = sortedDates[i].getTime() - sortedDates[i - 1].getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    totalDays += diffDays;
  }

  return totalDays / (sortedDates.length - 1);
}

/**
 * Detect frequency from average interval
 */
function detectFrequency(avgInterval: number): {
  frequency: TransactionFrequency;
  confidence: number;
} {
  const { frequencyWindows } = DETECTION_CONFIG;

  // Check each frequency window
  for (const [freq, window] of Object.entries(frequencyWindows) as Array<
    [TransactionFrequency, { min: number; max: number; expected: number }]
  >) {
    if (avgInterval >= window.min && avgInterval <= window.max) {
      // Calculate confidence based on how close to expected
      const deviation = Math.abs(avgInterval - window.expected);
      const maxDeviation = (window.max - window.min) / 2;
      const confidence = 1 - deviation / maxDeviation;

      return {
        frequency: freq,
        confidence: Math.max(0.5, Math.min(1, confidence)),
      };
    }
  }

  return {
    frequency: "unknown",
    confidence: 0.3,
  };
}

/**
 * Check if two amounts are within tolerance
 */
function amountsMatch(amount1: number, amount2: number): boolean {
  const tolerance = DETECTION_CONFIG.amountTolerancePercent / 100;
  const diff = Math.abs(amount1 - amount2);
  const avg = (amount1 + amount2) / 2;

  return diff / avg <= tolerance;
}

/**
 * Generate a grouping key for transactions
 */
function getGroupingKey(tx: TransactionForAnalysis): string {
  // Group by merchant/vendor name and approximate amount
  const name = tx.merchantName || tx.vendorName || tx.categorySlug || "unknown";
  const amountBucket = Math.round(tx.amount / 10) * 10; // Round to nearest 10

  return `${name.toLowerCase()}_${tx.currency}_${amountBucket}`;
}

/**
 * Calculate next expected payment date
 */
function calculateNextExpected(lastDate: Date, frequency: TransactionFrequency): Date | null {
  if (frequency === "unknown") return null;

  const nextDate = new Date(lastDate);

  switch (frequency) {
    case "weekly":
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case "biweekly":
      nextDate.setDate(nextDate.getDate() + 14);
      break;
    case "monthly":
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case "annually":
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
  }

  return nextDate;
}

// ==============================================
// MAIN DETECTION FUNCTIONS
// ==============================================

/**
 * Detect recurring patterns for a tenant
 */
export async function detectRecurringPatterns(
  tenantId: string,
  options?: {
    lookbackDays?: number;
    minTransactions?: number;
  }
): Promise<RecurringDetectionResult> {
  const lookbackDays = options?.lookbackDays || DETECTION_CONFIG.lookbackDays;
  const minTransactions = options?.minTransactions || DETECTION_CONFIG.minTransactions;

  serviceLogger.info({ tenantId, lookbackDays }, "Detecting recurring patterns");

  // Fetch transactions for analysis
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

  const transactions = await db`
    SELECT
      p.id,
      p.amount::numeric as amount,
      p.currency,
      p.payment_date as "paymentDate",
      p.merchant_name as "merchantName",
      p.vendor_name as "vendorName",
      p.category_slug as "categorySlug",
      p.reference
    FROM payments p
    LEFT JOIN invoices i ON p.invoice_id = i.id
    WHERE i.tenant_id = ${tenantId}
      AND p.payment_date >= ${cutoffDate}
      AND p.status = 'completed'
    ORDER BY p.payment_date DESC
  `;

  const txList: TransactionForAnalysis[] = transactions.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    amount: parseFloat(row.amount as string) || 0,
    currency: row.currency as string,
    paymentDate: new Date(row.paymentDate as string),
    merchantName: row.merchantName as string | null,
    vendorName: row.vendorName as string | null,
    categorySlug: row.categorySlug as string | null,
    reference: row.reference as string | null,
  }));

  // Group transactions by key
  const groups = new Map<string, TransactionForAnalysis[]>();

  for (const tx of txList) {
    const key = getGroupingKey(tx);
    const group = groups.get(key) || [];
    group.push(tx);
    groups.set(key, group);
  }

  // Analyze each group for patterns
  const patterns: RecurringPattern[] = [];

  for (const [_, group] of groups) {
    if (group.length < minTransactions) continue;

    // Sort by date
    group.sort((a, b) => a.paymentDate.getTime() - b.paymentDate.getTime());

    // Calculate average interval
    const dates = group.map((tx) => tx.paymentDate);
    const avgInterval = calculateAverageInterval(dates);

    // Detect frequency
    const { frequency, confidence } = detectFrequency(avgInterval);

    // Skip if confidence is too low or frequency unknown (unless many transactions)
    if (confidence < DETECTION_CONFIG.minConfidence && group.length < 4) continue;

    // Calculate average amount
    const avgAmount = group.reduce((sum, tx) => sum + tx.amount, 0) / group.length;

    // Get first/last transaction
    const firstTx = group[0];
    const lastTx = group[group.length - 1];

    // Calculate next expected
    const nextExpected = calculateNextExpected(lastTx.paymentDate, frequency);

    patterns.push({
      merchantName: firstTx.merchantName,
      vendorName: firstTx.vendorName,
      categorySlug: firstTx.categorySlug,
      averageAmount: Math.round(avgAmount * 100) / 100,
      currency: firstTx.currency,
      frequency,
      confidence,
      transactionCount: group.length,
      firstSeen: firstTx.paymentDate.toISOString(),
      lastSeen: lastTx.paymentDate.toISOString(),
      nextExpected: nextExpected?.toISOString() || null,
      transactionIds: group.map((tx) => tx.id),
    });
  }

  // Sort patterns by confidence and amount
  patterns.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return b.averageAmount - a.averageAmount;
  });

  // Calculate monthly total
  const monthlyTotal = patterns.reduce((total, pattern) => {
    let monthlyAmount = pattern.averageAmount;

    switch (pattern.frequency) {
      case "weekly":
        monthlyAmount *= 4.33;
        break;
      case "biweekly":
        monthlyAmount *= 2.17;
        break;
      case "monthly":
        // Already monthly
        break;
      case "annually":
        monthlyAmount /= 12;
        break;
      default:
        monthlyAmount = 0;
    }

    return total + monthlyAmount;
  }, 0);

  const result: RecurringDetectionResult = {
    patterns,
    totalRecurring: patterns.length,
    monthlyTotal: Math.round(monthlyTotal * 100) / 100,
    analyzedTransactions: txList.length,
  };

  serviceLogger.info(
    {
      tenantId,
      patternsFound: patterns.length,
      monthlyTotal,
      analyzedTransactions: txList.length,
    },
    "Recurring pattern detection completed"
  );

  return result;
}

/**
 * Update transactions with recurring status
 */
export async function markTransactionsAsRecurring(
  tenantId: string,
  options?: { minConfidence?: number }
): Promise<{ updated: number }> {
  const minConfidence = options?.minConfidence || DETECTION_CONFIG.minConfidence;

  // Detect patterns
  const { patterns } = await detectRecurringPatterns(tenantId);

  let totalUpdated = 0;

  // Update transactions for each pattern
  for (const pattern of patterns) {
    if (pattern.confidence < minConfidence) continue;

    const result = await db`
      UPDATE payments
      SET
        is_recurring = true,
        frequency = ${pattern.frequency}::transaction_frequency,
        updated_at = NOW()
      WHERE id = ANY(${pattern.transactionIds})
        AND (is_recurring = false OR is_recurring IS NULL)
    `;

    totalUpdated += result.count;
  }

  serviceLogger.info({ tenantId, updated: totalUpdated }, "Transactions marked as recurring");

  return { updated: totalUpdated };
}

/**
 * Get upcoming recurring transactions
 */
export async function getUpcomingRecurring(
  tenantId: string,
  daysAhead: number = 30
): Promise<
  Array<{
    merchantName: string | null;
    vendorName: string | null;
    expectedAmount: number;
    currency: string;
    expectedDate: string;
    frequency: TransactionFrequency;
  }>
> {
  const { patterns } = await detectRecurringPatterns(tenantId);

  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + daysAhead);

  const upcoming: Array<{
    merchantName: string | null;
    vendorName: string | null;
    expectedAmount: number;
    currency: string;
    expectedDate: string;
    frequency: TransactionFrequency;
  }> = [];

  for (const pattern of patterns) {
    if (!pattern.nextExpected) continue;

    const nextDate = new Date(pattern.nextExpected);

    if (nextDate >= now && nextDate <= cutoff) {
      upcoming.push({
        merchantName: pattern.merchantName,
        vendorName: pattern.vendorName,
        expectedAmount: pattern.averageAmount,
        currency: pattern.currency,
        expectedDate: pattern.nextExpected,
        frequency: pattern.frequency,
      });
    }
  }

  // Sort by date
  upcoming.sort((a, b) => new Date(a.expectedDate).getTime() - new Date(b.expectedDate).getTime());

  return upcoming;
}

/**
 * Check if a new transaction matches an existing recurring pattern
 */
export async function matchToRecurringPattern(
  tenantId: string,
  transaction: {
    amount: number;
    currency: string;
    merchantName?: string | null;
    vendorName?: string | null;
  }
): Promise<RecurringPattern | null> {
  const { patterns } = await detectRecurringPatterns(tenantId);

  const name = transaction.merchantName || transaction.vendorName || "";

  for (const pattern of patterns) {
    const patternName = pattern.merchantName || pattern.vendorName || "";

    // Check if names match (case-insensitive)
    if (name.toLowerCase() !== patternName.toLowerCase()) continue;

    // Check if currency matches
    if (transaction.currency !== pattern.currency) continue;

    // Check if amount is within tolerance
    if (amountsMatch(transaction.amount, pattern.averageAmount)) {
      return pattern;
    }
  }

  return null;
}

export default {
  detectRecurringPatterns,
  markTransactionsAsRecurring,
  getUpcomingRecurring,
  matchToRecurringPattern,
};
