/**
 * Category Embeddings Routes
 * API endpoints for category vector embeddings and recommendations
 */

import { errorResponse, successResponse } from "@crm/utils";
import { logger } from "../lib/logger";
import { verifyAndGetUser } from "../middleware/auth";
import * as categoryEmbeddings from "../services/category-embeddings.service";
import type { Route } from "./helpers";
import { json, parseBody } from "./helpers";

export const categoryEmbeddingsRoutes: Route[] = [
  // POST /api/v1/categories/embeddings/generate - Generate embeddings for all categories
  {
    method: "POST",
    pattern: /^\/api\/v1\/categories\/embeddings\/generate$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      const tenantId = auth.activeTenantId;
      if (!tenantId) {
        return json(errorResponse("VALIDATION_ERROR", "Tenant ID required"), 400);
      }

      try {
        const result = await categoryEmbeddings.generateAllCategoryEmbeddings(tenantId);
        return json(successResponse(result));
      } catch (error) {
        logger.error({ error }, "Failed to generate category embeddings");
        return json(errorResponse("INTERNAL_ERROR", "Failed to generate embeddings"), 500);
      }
    },
    params: [],
  },

  // POST /api/v1/categories/:id/embeddings/generate - Generate embedding for single category
  {
    method: "POST",
    pattern: /^\/api\/v1\/categories\/([^/]+)\/embeddings\/generate$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      const tenantId = auth.activeTenantId;
      if (!tenantId) {
        return json(errorResponse("VALIDATION_ERROR", "Tenant ID required"), 400);
      }

      try {
        const result = await categoryEmbeddings.generateCategoryEmbedding(tenantId, params.id);
        if (!result) {
          return json(errorResponse("NOT_FOUND", "Category not found"), 404);
        }
        return json(successResponse(result));
      } catch (error) {
        logger.error({ error, categoryId: params.id }, "Failed to generate category embedding");
        return json(errorResponse("INTERNAL_ERROR", "Failed to generate embedding"), 500);
      }
    },
    params: ["id"],
  },

  // POST /api/v1/categories/recommend - Recommend category for transaction text
  {
    method: "POST",
    pattern: /^\/api\/v1\/categories\/recommend$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      const tenantId = auth.activeTenantId;
      if (!tenantId) {
        return json(errorResponse("VALIDATION_ERROR", "Tenant ID required"), 400);
      }

      try {
        const body = await parseBody<{
          text: string;
          limit?: number;
          minSimilarity?: number;
        }>(request);

        if (!body?.text) {
          return json(errorResponse("VALIDATION_ERROR", "text required"), 400);
        }

        // Check if embeddings exist, generate if not
        const hasEmbeddings = await categoryEmbeddings.hasEmbeddings(tenantId);
        if (!hasEmbeddings) {
          logger.info({ tenantId }, "Generating category embeddings on first use");
          await categoryEmbeddings.generateAllCategoryEmbeddings(tenantId);
        }

        const recommendations = await categoryEmbeddings.findSimilarCategories(
          tenantId,
          body.text,
          body.limit || 5,
          body.minSimilarity || 0.3
        );

        return json(successResponse({ recommendations }));
      } catch (error) {
        logger.error({ error }, "Failed to get category recommendations");
        return json(errorResponse("INTERNAL_ERROR", "Failed to get recommendations"), 500);
      }
    },
    params: [],
  },

  // GET /api/v1/categories/:id/related - Get related categories
  {
    method: "GET",
    pattern: /^\/api\/v1\/categories\/([^/]+)\/related$/,
    handler: async (request, url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      const tenantId = auth.activeTenantId;
      if (!tenantId) {
        return json(errorResponse("VALIDATION_ERROR", "Tenant ID required"), 400);
      }

      try {
        const limit = url.searchParams.get("limit")
          ? parseInt(url.searchParams.get("limit")!, 10)
          : 5;

        // Check if embeddings exist
        const hasEmbeddings = await categoryEmbeddings.hasEmbeddings(tenantId);
        if (!hasEmbeddings) {
          await categoryEmbeddings.generateAllCategoryEmbeddings(tenantId);
        }

        const related = await categoryEmbeddings.findRelatedCategories(tenantId, params.id, limit);

        return json(successResponse({ related }));
      } catch (error) {
        logger.error({ error, categoryId: params.id }, "Failed to get related categories");
        return json(errorResponse("INTERNAL_ERROR", "Failed to get related categories"), 500);
      }
    },
    params: ["id"],
  },

  // GET /api/v1/categories/embeddings/stats - Get embedding statistics
  {
    method: "GET",
    pattern: /^\/api\/v1\/categories\/embeddings\/stats$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      const tenantId = auth.activeTenantId;
      if (!tenantId) {
        return json(errorResponse("VALIDATION_ERROR", "Tenant ID required"), 400);
      }

      try {
        const stats = await categoryEmbeddings.getEmbeddingStats(tenantId);
        return json(successResponse(stats));
      } catch (error) {
        logger.error({ error }, "Failed to get embedding stats");
        return json(errorResponse("INTERNAL_ERROR", "Failed to get stats"), 500);
      }
    },
    params: [],
  },
];

export default categoryEmbeddingsRoutes;
