/**
 * Recurring Transactions Routes
 * API endpoints for recurring transaction detection and management
 */

import { errorResponse, successResponse } from "@crm/utils";
import { serviceLogger } from "../lib/logger";
import { verifyAndGetUser } from "../middleware/auth";
import type { Route } from "./helpers";
import { json } from "./helpers";
import * as recurringService from "../services/recurring-detection.service";

// ==============================================
// ROUTES
// ==============================================

export const recurringTransactionRoutes: Route[] = [
  // GET /api/v1/recurring/patterns - Get detected recurring patterns
  {
    method: "GET",
    pattern: /^\/api\/v1\/recurring\/patterns$/,
    handler: async (request, url) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      const tenantId = auth.activeTenantId!;

      try {
        const lookbackDays = parseInt(url.searchParams.get("lookbackDays") || "365", 10);
        const minTransactions = parseInt(url.searchParams.get("minTransactions") || "2", 10);

        const result = await recurringService.detectRecurringPatterns(tenantId, {
          lookbackDays,
          minTransactions,
        });

        return json(successResponse(result));
      } catch (error) {
        serviceLogger.error({ error }, "Failed to get recurring patterns");
        return json(errorResponse("INTERNAL_ERROR", "Failed to get recurring patterns"), 500);
      }
    },
    params: [],
  },

  // POST /api/v1/recurring/detect - Run recurring detection and mark transactions
  {
    method: "POST",
    pattern: /^\/api\/v1\/recurring\/detect$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      const tenantId = auth.activeTenantId!;

      try {
        let minConfidence: number | undefined;
        try {
          const body = (await request.json()) as { minConfidence?: number };
          minConfidence = body?.minConfidence;
        } catch {
          // No body
        }

        const result = await recurringService.markTransactionsAsRecurring(tenantId, {
          minConfidence,
        });

        return json(successResponse(result));
      } catch (error) {
        serviceLogger.error({ error }, "Failed to detect recurring transactions");
        return json(errorResponse("INTERNAL_ERROR", "Failed to detect recurring transactions"), 500);
      }
    },
    params: [],
  },

  // GET /api/v1/recurring/upcoming - Get upcoming expected recurring transactions
  {
    method: "GET",
    pattern: /^\/api\/v1\/recurring\/upcoming$/,
    handler: async (request, url) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      const tenantId = auth.activeTenantId!;

      try {
        const daysAhead = parseInt(url.searchParams.get("daysAhead") || "30", 10);

        const upcoming = await recurringService.getUpcomingRecurring(tenantId, daysAhead);

        return json(successResponse(upcoming));
      } catch (error) {
        serviceLogger.error({ error }, "Failed to get upcoming recurring");
        return json(errorResponse("INTERNAL_ERROR", "Failed to get upcoming recurring transactions"), 500);
      }
    },
    params: [],
  },

  // POST /api/v1/recurring/match - Check if a transaction matches recurring pattern
  {
    method: "POST",
    pattern: /^\/api\/v1\/recurring\/match$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      const tenantId = auth.activeTenantId!;

      try {
        const body = (await request.json()) as {
          amount: number;
          currency: string;
          merchantName?: string;
          vendorName?: string;
        };

        if (!body?.amount || !body?.currency) {
          return json(errorResponse("VALIDATION_ERROR", "Amount and currency are required"), 400);
        }

        const match = await recurringService.matchToRecurringPattern(tenantId, body);

        return json(successResponse({
          isRecurring: match !== null,
          pattern: match,
        }));
      } catch (error) {
        serviceLogger.error({ error }, "Failed to match recurring pattern");
        return json(errorResponse("INTERNAL_ERROR", "Failed to match recurring pattern"), 500);
      }
    },
    params: [],
  },
];

export default recurringTransactionRoutes;
