/**
 * Transaction Tags API Routes
 * RESTful endpoints for tag management and transaction-tag assignments
 */

import { errorResponse, successResponse } from "@crm/utils";
import {
  addTagToTransaction,
  createTag,
  deleteTag,
  getTagById,
  getTagBySlug,
  getTags,
  getTagUsage,
  getTransactionsByTag,
  getTransactionTags,
  removeTagFromTransaction,
  setTransactionTags,
  updateTag,
} from "../db/queries/transaction-tags";
import { logger } from "../lib/logger";
import { verifyAndGetUser } from "../middleware/auth";
import type { Route } from "./helpers";
import { json } from "./helpers";

// ==============================================
// TAG ROUTES
// ==============================================

export const transactionTagRoutes: Route[] = [
  // GET /api/v1/tags - List all tags
  {
    method: "GET",
    pattern: /^\/api\/v1\/tags$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const tags = await getTags(auth.activeTenantId!);
        return json(successResponse({ tags }));
      } catch (error) {
        logger.error({ error }, "Error fetching tags");
        return json(errorResponse("INTERNAL_ERROR", "Failed to fetch tags"), 500);
      }
    },
    params: [],
  },

  // GET /api/v1/tags/usage - Get tag usage statistics
  {
    method: "GET",
    pattern: /^\/api\/v1\/tags\/usage$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const usage = await getTagUsage(auth.activeTenantId!);
        return json(successResponse({ usage }));
      } catch (error) {
        logger.error({ error }, "Error fetching tag usage");
        return json(errorResponse("INTERNAL_ERROR", "Failed to fetch usage"), 500);
      }
    },
    params: [],
  },

  // GET /api/v1/tags/slug/:slug - Get tag by slug
  {
    method: "GET",
    pattern: /^\/api\/v1\/tags\/slug\/([^/]+)$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const tag = await getTagBySlug(auth.activeTenantId!, params.slug);
        if (!tag) {
          return json(errorResponse("NOT_FOUND", "Tag not found"), 404);
        }

        return json(successResponse({ tag }));
      } catch (error) {
        logger.error({ error }, "Error fetching tag");
        return json(errorResponse("INTERNAL_ERROR", "Failed to fetch tag"), 500);
      }
    },
    params: ["slug"],
  },

  // GET /api/v1/tags/:id - Get tag by ID
  {
    method: "GET",
    pattern: /^\/api\/v1\/tags\/([^/]+)$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const tag = await getTagById(auth.activeTenantId!, params.id);
        if (!tag) {
          return json(errorResponse("NOT_FOUND", "Tag not found"), 404);
        }

        return json(successResponse({ tag }));
      } catch (error) {
        logger.error({ error }, "Error fetching tag");
        return json(errorResponse("INTERNAL_ERROR", "Failed to fetch tag"), 500);
      }
    },
    params: ["id"],
  },

  // POST /api/v1/tags - Create a new tag
  {
    method: "POST",
    pattern: /^\/api\/v1\/tags$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const body = (await request.json()) as {
          name: string;
          color?: string;
        };

        if (!body.name || !body.name.trim()) {
          return json(errorResponse("VALIDATION_ERROR", "Name is required"), 400);
        }

        const tag = await createTag({
          tenantId: auth.activeTenantId!,
          name: body.name.trim(),
          color: body.color,
        });

        return json(successResponse({ tag }), 201);
      } catch (error) {
        const err = error as Error;
        // Handle unique constraint violation
        if (err.message?.includes("duplicate") || err.message?.includes("unique")) {
          return json(errorResponse("CONFLICT", "Tag with this name already exists"), 409);
        }
        logger.error({ error }, "Error creating tag");
        return json(errorResponse("INTERNAL_ERROR", "Failed to create tag"), 500);
      }
    },
    params: [],
  },

  // PATCH /api/v1/tags/:id - Update a tag
  {
    method: "PATCH",
    pattern: /^\/api\/v1\/tags\/([^/]+)$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const body = (await request.json()) as {
          name?: string;
          color?: string;
        };

        const tag = await updateTag(auth.activeTenantId!, params.id, {
          name: body.name?.trim(),
          color: body.color,
        });

        if (!tag) {
          return json(errorResponse("NOT_FOUND", "Tag not found"), 404);
        }

        return json(successResponse({ tag }));
      } catch (error) {
        const err = error as Error;
        if (err.message?.includes("duplicate") || err.message?.includes("unique")) {
          return json(errorResponse("CONFLICT", "Tag with this name already exists"), 409);
        }
        logger.error({ error }, "Error updating tag");
        return json(errorResponse("INTERNAL_ERROR", "Failed to update tag"), 500);
      }
    },
    params: ["id"],
  },

  // DELETE /api/v1/tags/:id - Delete a tag
  {
    method: "DELETE",
    pattern: /^\/api\/v1\/tags\/([^/]+)$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const deleted = await deleteTag(auth.activeTenantId!, params.id);
        if (!deleted) {
          return json(errorResponse("NOT_FOUND", "Tag not found"), 404);
        }

        return json(successResponse({ message: "Tag deleted" }));
      } catch (error) {
        logger.error({ error }, "Error deleting tag");
        return json(errorResponse("INTERNAL_ERROR", "Failed to delete tag"), 500);
      }
    },
    params: ["id"],
  },

  // GET /api/v1/tags/:id/transactions - Get transactions by tag
  {
    method: "GET",
    pattern: /^\/api\/v1\/tags\/([^/]+)\/transactions$/,
    handler: async (request, url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const searchParams = new URL(url).searchParams;
        const limit = parseInt(searchParams.get("limit") || "50", 10);
        const offset = parseInt(searchParams.get("offset") || "0", 10);

        const result = await getTransactionsByTag(auth.activeTenantId!, params.id, {
          limit,
          offset,
        });

        return json(
          successResponse({
            paymentIds: result.paymentIds,
            total: result.total,
            limit,
            offset,
          })
        );
      } catch (error) {
        logger.error({ error }, "Error fetching transactions by tag");
        return json(errorResponse("INTERNAL_ERROR", "Failed to fetch transactions"), 500);
      }
    },
    params: ["id"],
  },

  // ==============================================
  // TRANSACTION TAG ASSIGNMENT ROUTES
  // ==============================================

  // GET /api/v1/payments/:paymentId/tags - Get tags for a transaction
  {
    method: "GET",
    pattern: /^\/api\/v1\/payments\/([^/]+)\/tags$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const tags = await getTransactionTags(auth.activeTenantId!, params.paymentId);
        return json(successResponse({ tags }));
      } catch (error) {
        logger.error({ error }, "Error fetching transaction tags");
        return json(errorResponse("INTERNAL_ERROR", "Failed to fetch tags"), 500);
      }
    },
    params: ["paymentId"],
  },

  // POST /api/v1/payments/:paymentId/tags - Add a tag to a transaction
  {
    method: "POST",
    pattern: /^\/api\/v1\/payments\/([^/]+)\/tags$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const body = (await request.json()) as { tagId: string };

        if (!body.tagId) {
          return json(errorResponse("VALIDATION_ERROR", "tagId is required"), 400);
        }

        // Verify tag exists
        const tag = await getTagById(auth.activeTenantId!, body.tagId);
        if (!tag) {
          return json(errorResponse("NOT_FOUND", "Tag not found"), 404);
        }

        const transactionTag = await addTagToTransaction(
          auth.activeTenantId!,
          params.paymentId,
          body.tagId
        );

        return json(successResponse({ transactionTag }), 201);
      } catch (error) {
        logger.error({ error }, "Error adding tag to transaction");
        return json(errorResponse("INTERNAL_ERROR", "Failed to add tag"), 500);
      }
    },
    params: ["paymentId"],
  },

  // PUT /api/v1/payments/:paymentId/tags - Set tags for a transaction (replace all)
  {
    method: "PUT",
    pattern: /^\/api\/v1\/payments\/([^/]+)\/tags$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const body = (await request.json()) as { tagIds: string[] };

        if (!Array.isArray(body.tagIds)) {
          return json(errorResponse("VALIDATION_ERROR", "tagIds must be an array"), 400);
        }

        const tags = await setTransactionTags(auth.activeTenantId!, params.paymentId, body.tagIds);

        return json(successResponse({ tags }));
      } catch (error) {
        logger.error({ error }, "Error setting transaction tags");
        return json(errorResponse("INTERNAL_ERROR", "Failed to set tags"), 500);
      }
    },
    params: ["paymentId"],
  },

  // DELETE /api/v1/payments/:paymentId/tags/:tagId - Remove a tag from a transaction
  {
    method: "DELETE",
    pattern: /^\/api\/v1\/payments\/([^/]+)\/tags\/([^/]+)$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const removed = await removeTagFromTransaction(
          auth.activeTenantId!,
          params.paymentId,
          params.tagId
        );

        if (!removed) {
          return json(errorResponse("NOT_FOUND", "Tag assignment not found"), 404);
        }

        return json(successResponse({ message: "Tag removed from transaction" }));
      } catch (error) {
        logger.error({ error }, "Error removing tag from transaction");
        return json(errorResponse("INTERNAL_ERROR", "Failed to remove tag"), 500);
      }
    },
    params: ["paymentId", "tagId"],
  },
];
