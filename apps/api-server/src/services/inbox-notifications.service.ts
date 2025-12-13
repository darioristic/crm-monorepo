/**
 * Inbox Notifications Service
 *
 * Handles notifications for inbox matching events:
 * - inbox_auto_matched: Document automatically matched to transaction
 * - inbox_needs_review: Match suggestion needs user review
 */

import { sql as db } from "../db/client";
import { getInboxById } from "../db/queries/inbox";
import { serviceLogger } from "../lib/logger";
import type { MatchResult } from "./advanced-matching.service";
import { notificationsService } from "./notifications.service";

// ==============================================
// TYPES
// ==============================================

export interface AutoMatchNotificationParams {
  tenantId: string;
  userId: string;
  inboxId: string;
  transactionId: string;
  confidence: number;
  matchType: "auto_matched";
  merchantPatternEligible?: boolean;
}

export interface NeedsReviewNotificationParams {
  tenantId: string;
  userId: string;
  inboxId: string;
  transactionId: string;
  confidence: number;
  matchType: "high_confidence" | "suggested";
  isCrossCurrency?: boolean;
}

// ==============================================
// NOTIFICATION FUNCTIONS
// ==============================================

/**
 * Send notification for automatic match
 */
export async function notifyAutoMatch(params: AutoMatchNotificationParams): Promise<void> {
  const { tenantId, userId, inboxId, transactionId, confidence, merchantPatternEligible } = params;

  try {
    // Get inbox and transaction details
    const [inbox, transaction] = await Promise.all([
      getInboxById(inboxId, tenantId),
      getTransactionDetails(tenantId, transactionId),
    ]);

    if (!inbox || !transaction) {
      serviceLogger.warn({ inboxId, transactionId }, "Could not find items for notification");
      return;
    }

    const documentName = inbox.displayName || inbox.fileName || "Document";
    const transactionName = transaction.description || transaction.vendorName || "Transaction";
    const amount = formatAmount(transaction.amount, transaction.currency);

    const title = "Document Automatically Matched";
    let message = `"${documentName}" was matched to "${transactionName}" (${amount})`;

    if (merchantPatternEligible) {
      message += " based on your confirmed matching patterns.";
    } else {
      message += ` with ${Math.round(confidence * 100)}% confidence.`;
    }

    await notificationsService.createNotification({
      userId,
      type: "inbox_matched",
      channel: "in_app",
      title,
      message,
      link: `/dashboard/inbox/${inboxId}`,
      entityType: "inbox",
      entityId: inboxId,
      metadata: {
        transactionId,
        confidence,
        matchType: "auto_matched",
        merchantPatternEligible,
      },
    });

    serviceLogger.info({ inboxId, transactionId, userId }, "Auto-match notification sent");
  } catch (error) {
    serviceLogger.error({ error, inboxId }, "Error sending auto-match notification");
  }
}

/**
 * Send notification for match suggestion needing review
 */
export async function notifyNeedsReview(params: NeedsReviewNotificationParams): Promise<void> {
  const { tenantId, userId, inboxId, transactionId, confidence, matchType, isCrossCurrency } =
    params;

  try {
    // Get inbox and transaction details
    const [inbox, transaction] = await Promise.all([
      getInboxById(inboxId, tenantId),
      getTransactionDetails(tenantId, transactionId),
    ]);

    if (!inbox || !transaction) {
      serviceLogger.warn({ inboxId, transactionId }, "Could not find items for notification");
      return;
    }

    const documentName = inbox.displayName || inbox.fileName || "Document";
    const transactionName = transaction.description || transaction.vendorName || "Transaction";
    const amount = formatAmount(transaction.amount, transaction.currency);
    const confidencePercent = Math.round(confidence * 100);

    let title: string;
    let message: string;

    if (matchType === "high_confidence") {
      title = "High Confidence Match Found";
      message = `"${documentName}" may match "${transactionName}" (${amount}) with ${confidencePercent}% confidence.`;
    } else {
      title = "Match Suggestion Needs Review";
      message = `"${documentName}" might match "${transactionName}" (${amount}).`;
    }

    if (isCrossCurrency) {
      message += " Note: This is a cross-currency match.";
    }

    await notificationsService.createNotification({
      userId,
      type: "inbox_needs_review",
      channel: "in_app",
      title,
      message,
      link: `/dashboard/inbox/${inboxId}`,
      entityType: "inbox",
      entityId: inboxId,
      metadata: {
        transactionId,
        confidence,
        matchType,
        isCrossCurrency,
      },
    });

    serviceLogger.info(
      { inboxId, transactionId, userId, matchType },
      "Needs-review notification sent"
    );
  } catch (error) {
    serviceLogger.error({ error, inboxId }, "Error sending needs-review notification");
  }
}

/**
 * Send matching notification based on match result
 */
export async function sendMatchingNotification(params: {
  tenantId: string;
  userId: string;
  inboxId: string;
  matchResult: MatchResult;
  isCrossCurrency?: boolean;
}): Promise<void> {
  const { tenantId, userId, inboxId, matchResult, isCrossCurrency } = params;

  if (matchResult.matchType === "auto_matched") {
    await notifyAutoMatch({
      tenantId,
      userId,
      inboxId,
      transactionId: matchResult.paymentId,
      confidence: matchResult.confidenceScore,
      matchType: "auto_matched",
      merchantPatternEligible: matchResult.merchantPatternEligible,
    });
  } else {
    await notifyNeedsReview({
      tenantId,
      userId,
      inboxId,
      transactionId: matchResult.paymentId,
      confidence: matchResult.confidenceScore,
      matchType: matchResult.matchType,
      isCrossCurrency,
    });
  }
}

/**
 * Notify when a match is confirmed by user
 */
export async function notifyMatchConfirmed(params: {
  tenantId: string;
  userId: string;
  inboxId: string;
  transactionId: string;
}): Promise<void> {
  const { tenantId, userId, inboxId, transactionId } = params;

  try {
    const [inbox, transaction] = await Promise.all([
      getInboxById(inboxId, tenantId),
      getTransactionDetails(tenantId, transactionId),
    ]);

    if (!inbox || !transaction) return;

    const documentName = inbox.displayName || inbox.fileName || "Document";
    const amount = formatAmount(transaction.amount, transaction.currency);

    await notificationsService.createNotification({
      userId,
      type: "inbox_matched",
      channel: "in_app",
      title: "Match Confirmed",
      message: `"${documentName}" has been linked to the ${amount} transaction.`,
      link: `/dashboard/inbox/${inboxId}`,
      entityType: "inbox",
      entityId: inboxId,
    });
  } catch (error) {
    serviceLogger.error({ error, inboxId }, "Error sending match-confirmed notification");
  }
}

// ==============================================
// HELPER FUNCTIONS
// ==============================================

interface TransactionDetails {
  id: string;
  description: string | null;
  vendorName: string | null;
  amount: number | null;
  currency: string | null;
}

async function getTransactionDetails(
  tenantId: string,
  transactionId: string
): Promise<TransactionDetails | null> {
  try {
    const result = await db`
      SELECT id, description, vendor_name, amount, currency
      FROM payments
      WHERE id = ${transactionId} AND tenant_id = ${tenantId}
      LIMIT 1
    `;

    if (result.length === 0) return null;

    const row = result[0] as Record<string, unknown>;
    return {
      id: row.id as string,
      description: row.description as string | null,
      vendorName: row.vendor_name as string | null,
      amount: row.amount ? Number(row.amount) : null,
      currency: row.currency as string | null,
    };
  } catch (error) {
    serviceLogger.error({ error, transactionId }, "Error getting transaction details");
    return null;
  }
}

function formatAmount(amount: number | null, currency: string | null): string {
  if (amount === null) return "Unknown amount";

  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "EUR",
    minimumFractionDigits: 2,
  });

  return formatter.format(Math.abs(amount));
}

// ==============================================
// EXPORTS
// ==============================================

export default {
  notifyAutoMatch,
  notifyNeedsReview,
  sendMatchingNotification,
  notifyMatchConfirmed,
};
