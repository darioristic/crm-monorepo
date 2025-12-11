/**
 * Matching Jobs Service
 *
 * Handles bidirectional inbox-transaction matching jobs.
 * Integrates with the simple-queue service for background processing.
 */

import { serviceLogger } from "../lib/logger";
import { getPendingInboxForMatching } from "../db/queries/inbox";
import {
  processInboxMatching,
  processTransactionMatching,
  batchProcessMatching,
} from "./inbox-matching";
import { updateCalibration } from "./calibration.service";

// ==============================================
// TYPES
// ==============================================

export interface BidirectionalMatchingParams {
  tenantId: string;
  transactionIds: string[];
}

export interface BatchInboxMatchingParams {
  tenantId: string;
  inboxIds: string[];
}

export interface MatchingJobResult {
  processed: number;
  autoMatched: number;
  suggestions: number;
  noMatches: number;
  errors: number;
}

// ==============================================
// JOB HANDLERS
// ==============================================

/**
 * Handle bidirectional matching job
 *
 * Phase 1 (Forward): For each new transaction, find matching inbox items
 * Phase 2 (Reverse): For pending inbox items, find matching transactions
 */
export async function handleBidirectionalMatching(
  params: BidirectionalMatchingParams
): Promise<MatchingJobResult> {
  const { tenantId, transactionIds } = params;
  const result: MatchingJobResult = {
    processed: 0,
    autoMatched: 0,
    suggestions: 0,
    noMatches: 0,
    errors: 0,
  };

  const processedInboxIds = new Set<string>();

  serviceLogger.info(
    { tenantId, transactionCount: transactionIds.length },
    "Starting bidirectional matching"
  );

  // Phase 1: Forward matching (transactions -> inbox)
  for (const transactionId of transactionIds) {
    try {
      const matchResult = await processTransactionMatching(tenantId, transactionId);
      result.processed++;

      if (matchResult.matched) {
        if (matchResult.inboxId) {
          processedInboxIds.add(matchResult.inboxId);
        }

        if (matchResult.matchResult?.matchType === "auto_matched") {
          result.autoMatched++;
        } else {
          result.suggestions++;
        }
      } else {
        result.noMatches++;
      }
    } catch (error) {
      serviceLogger.error({ error, transactionId }, "Error in forward matching");
      result.errors++;
    }
  }

  serviceLogger.info(
    {
      tenantId,
      forwardMatches: result.autoMatched + result.suggestions,
      processedInboxIds: processedInboxIds.size,
    },
    "Forward matching completed"
  );

  // Phase 2: Reverse matching (inbox -> transactions)
  // Get pending inbox items that weren't matched in Phase 1
  try {
    const pendingInbox = await getPendingInboxForMatching(tenantId, 50);
    const unprocessedInbox = pendingInbox.filter(
      (item: { id: string }) => !processedInboxIds.has(item.id)
    );

    if (unprocessedInbox.length > 0) {
      serviceLogger.info(
        { tenantId, pendingCount: unprocessedInbox.length },
        "Starting reverse matching"
      );

      // Process in batches of 10
      const BATCH_SIZE = 10;
      for (let i = 0; i < unprocessedInbox.length; i += BATCH_SIZE) {
        const batch = unprocessedInbox.slice(i, i + BATCH_SIZE);
        const batchIds = batch.map((item: { id: string }) => item.id);

        const batchResult = await batchProcessMatching(tenantId, batchIds);
        result.processed += batchResult.processed;
        result.autoMatched += batchResult.autoMatched;
        result.suggestions += batchResult.suggestions - batchResult.autoMatched;
      }
    }
  } catch (error) {
    serviceLogger.error({ error, tenantId }, "Error in reverse matching phase");
    result.errors++;
  }

  // Update calibration in background
  updateCalibration(tenantId).catch((err) => {
    serviceLogger.error({ error: err, tenantId }, "Failed to update calibration after matching");
  });

  serviceLogger.info(
    {
      tenantId,
      ...result,
    },
    "Bidirectional matching completed"
  );

  return result;
}

/**
 * Handle batch inbox matching job
 * Processes specific inbox items for matching
 */
export async function handleBatchInboxMatching(
  params: BatchInboxMatchingParams
): Promise<MatchingJobResult> {
  const { tenantId, inboxIds } = params;
  const result: MatchingJobResult = {
    processed: 0,
    autoMatched: 0,
    suggestions: 0,
    noMatches: 0,
    errors: 0,
  };

  serviceLogger.info(
    { tenantId, itemCount: inboxIds.length },
    "Starting batch inbox matching"
  );

  // Process in batches of 5
  const BATCH_SIZE = 5;

  for (let i = 0; i < inboxIds.length; i += BATCH_SIZE) {
    const batch = inboxIds.slice(i, i + BATCH_SIZE);

    // Process batch in parallel using Promise.allSettled
    const results = await Promise.allSettled(
      batch.map((inboxId) => processInboxMatching(tenantId, inboxId))
    );

    for (const settledResult of results) {
      if (settledResult.status === "fulfilled") {
        const matchResult = settledResult.value;
        result.processed++;

        if (matchResult.autoMatched) {
          result.autoMatched++;
        } else if (matchResult.matches > 0) {
          result.suggestions++;
        } else {
          result.noMatches++;
        }
      } else {
        result.errors++;
        serviceLogger.error(
          { error: settledResult.reason },
          "Error processing inbox item in batch"
        );
      }
    }
  }

  // Update calibration in background
  updateCalibration(tenantId).catch((err) => {
    serviceLogger.error({ error: err, tenantId }, "Failed to update calibration after batch matching");
  });

  serviceLogger.info(
    {
      tenantId,
      ...result,
    },
    "Batch inbox matching completed"
  );

  return result;
}

/**
 * Smart matching dispatcher
 * Routes to the most efficient matching approach based on input
 */
export async function smartMatching(params: {
  tenantId: string;
  inboxIds?: string[];
  transactionIds?: string[];
}): Promise<MatchingJobResult> {
  const { tenantId, inboxIds, transactionIds } = params;

  // If specific inbox IDs provided, use batch processing
  if (inboxIds && inboxIds.length > 0) {
    return handleBatchInboxMatching({ tenantId, inboxIds });
  }

  // If transaction IDs provided, use bidirectional matching
  if (transactionIds && transactionIds.length > 0) {
    return handleBidirectionalMatching({ tenantId, transactionIds });
  }

  // Default: process all pending inbox items
  const pendingInbox = await getPendingInboxForMatching(tenantId, 100);
  if (pendingInbox.length === 0) {
    return {
      processed: 0,
      autoMatched: 0,
      suggestions: 0,
      noMatches: 0,
      errors: 0,
    };
  }

  const pendingIds = pendingInbox.map((item: { id: string }) => item.id);
  return handleBatchInboxMatching({ tenantId, inboxIds: pendingIds });
}

// ==============================================
// QUEUE INTEGRATION
// ==============================================

// Job type definitions for queue registration
export const MATCHING_JOB_TYPES = {
  BIDIRECTIONAL: "inbox-bidirectional-matching",
  BATCH_INBOX: "inbox-batch-matching",
  SMART: "inbox-smart-matching",
} as const;

// Job handler map for queue workers
export const matchingJobHandlers = {
  [MATCHING_JOB_TYPES.BIDIRECTIONAL]: handleBidirectionalMatching,
  [MATCHING_JOB_TYPES.BATCH_INBOX]: handleBatchInboxMatching,
  [MATCHING_JOB_TYPES.SMART]: smartMatching,
};

// ==============================================
// EXPORTS
// ==============================================

export default {
  handleBidirectionalMatching,
  handleBatchInboxMatching,
  smartMatching,
  MATCHING_JOB_TYPES,
  matchingJobHandlers,
};
