/**
 * Transaction Matching API Routes
 * RESTful endpoints for bidirectional inbox-transaction matching
 */

import { errorResponse, successResponse } from "@crm/utils";
import { logger } from "../lib/logger";
import { verifyAndGetUser } from "../middleware/auth";
import {
  batchProcessMatching,
  processInboxMatching,
  processTransactionMatching,
} from "../services/inbox-matching";
import type { Route } from "./helpers";
import { json } from "./helpers";

// ==============================================
// TRANSACTION MATCHING ROUTES
// ==============================================

export const transactionMatchingRoutes: Route[] = [
  // POST /api/v1/matching/inbox/:inboxId - Find matches for an inbox item
  {
    method: "POST",
    pattern: /^\/api\/v1\/matching\/inbox\/([^/]+)$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const result = await processInboxMatching(auth.activeTenantId!, params.inboxId);

        return json(
          successResponse({
            matches: result.matches,
            autoMatched: result.autoMatched,
            matchResult: result.matchResult || null,
          })
        );
      } catch (error) {
        logger.error({ error }, "Error processing inbox matching");
        return json(errorResponse("INTERNAL_ERROR", "Failed to process matching"), 500);
      }
    },
    params: ["inboxId"],
  },

  // POST /api/v1/matching/transaction/:transactionId - Find matches for a transaction
  {
    method: "POST",
    pattern: /^\/api\/v1\/matching\/transaction\/([^/]+)$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const result = await processTransactionMatching(auth.activeTenantId!, params.transactionId);

        return json(
          successResponse({
            matched: result.matched,
            inboxId: result.inboxId || null,
            matchResult: result.matchResult || null,
          })
        );
      } catch (error) {
        logger.error({ error }, "Error processing transaction matching");
        return json(errorResponse("INTERNAL_ERROR", "Failed to process matching"), 500);
      }
    },
    params: ["transactionId"],
  },

  // POST /api/v1/matching/batch - Batch process matching for multiple inbox items
  {
    method: "POST",
    pattern: /^\/api\/v1\/matching\/batch$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const body = (await request.json()) as { inboxIds: string[] };

        if (!Array.isArray(body.inboxIds) || body.inboxIds.length === 0) {
          return json(errorResponse("VALIDATION_ERROR", "inboxIds must be a non-empty array"), 400);
        }

        // Limit batch size to prevent timeouts
        if (body.inboxIds.length > 50) {
          return json(errorResponse("VALIDATION_ERROR", "Maximum 50 inbox items per batch"), 400);
        }

        const result = await batchProcessMatching(auth.activeTenantId!, body.inboxIds);

        return json(
          successResponse({
            processed: result.processed,
            autoMatched: result.autoMatched,
            suggestions: result.suggestions,
          })
        );
      } catch (error) {
        logger.error({ error }, "Error processing batch matching");
        return json(errorResponse("INTERNAL_ERROR", "Failed to process batch matching"), 500);
      }
    },
    params: [],
  },
];
