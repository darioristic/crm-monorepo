/**
 * Transaction Enrichment Routes
 * API endpoints for transaction enrichment, categorization, and suggestions
 */

import { errorResponse, successResponse } from "@crm/utils";
import { serviceLogger } from "../lib/logger";
import { verifyAndGetUser } from "../middleware/auth";
import type { Route } from "./helpers";
import { json } from "./helpers";
import * as enrichmentService from "../services/transaction-enrichment.service";

// ==============================================
// ROUTES
// ==============================================

export const transactionEnrichmentRoutes: Route[] = [
  // POST /api/v1/transactions/:id/enrich - Enrich a single transaction
  {
    method: "POST",
    pattern: /^\/api\/v1\/transactions\/([^/]+)\/enrich$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      const tenantId = auth.activeTenantId!;
      const paymentId = params.id;

      try {
        let useAI = false;
        try {
          const body = (await request.json()) as { useAI?: boolean };
          useAI = body?.useAI ?? false;
        } catch {
          // No body or invalid JSON, use defaults
        }

        const result = await enrichmentService.enrichAndUpdatePayment(
          paymentId,
          tenantId,
          { useAI }
        );

        if (!result) {
          return json(errorResponse("NOT_FOUND", "Transaction not found"), 404);
        }

        return json(successResponse(result));
      } catch (error) {
        serviceLogger.error({ error, paymentId }, "Failed to enrich transaction");
        return json(errorResponse("INTERNAL_ERROR", "Failed to enrich transaction"), 500);
      }
    },
    params: ["id"],
  },

  // POST /api/v1/transactions/batch-enrich - Batch enrich multiple transactions
  {
    method: "POST",
    pattern: /^\/api\/v1\/transactions\/batch-enrich$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      const tenantId = auth.activeTenantId!;

      try {
        let options = { useAI: false, limit: 100, onlyUnenriched: true };
        try {
          const body = (await request.json()) as {
            useAI?: boolean;
            limit?: number;
            onlyUnenriched?: boolean;
          };
          options = {
            useAI: body?.useAI ?? false,
            limit: body?.limit ?? 100,
            onlyUnenriched: body?.onlyUnenriched ?? true,
          };
        } catch {
          // Use defaults
        }

        const result = await enrichmentService.batchEnrichPayments(tenantId, options);

        return json(successResponse(result));
      } catch (error) {
        serviceLogger.error({ error }, "Failed to batch enrich transactions");
        return json(errorResponse("INTERNAL_ERROR", "Failed to batch enrich transactions"), 500);
      }
    },
    params: [],
  },

  // POST /api/v1/transactions/suggest-category - Get category suggestions
  {
    method: "POST",
    pattern: /^\/api\/v1\/transactions\/suggest-category$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      const tenantId = auth.activeTenantId!;

      try {
        const body = (await request.json()) as { text: string };

        if (!body?.text) {
          return json(errorResponse("VALIDATION_ERROR", "Text is required"), 400);
        }

        const suggestions = await enrichmentService.getEnrichmentSuggestions(
          body.text,
          tenantId
        );

        return json(successResponse(suggestions));
      } catch (error) {
        serviceLogger.error({ error }, "Failed to get category suggestions");
        return json(errorResponse("INTERNAL_ERROR", "Failed to get category suggestions"), 500);
      }
    },
    params: [],
  },
];

export default transactionEnrichmentRoutes;
