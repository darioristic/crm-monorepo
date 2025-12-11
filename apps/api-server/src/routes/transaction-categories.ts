/**
 * Transaction Categories API Routes
 * RESTful endpoints for category management
 */

import { errorResponse, successResponse } from "@crm/utils";
import {
  createCategory,
  deleteCategory,
  getCategories,
  getCategoryById,
  getCategoryBySlug,
  getCategoryUsage,
  seedDefaultCategories,
  updateCategory,
} from "../db/queries/transaction-categories";
import { logger } from "../lib/logger";
import { verifyAndGetUser } from "../middleware/auth";
import type { Route } from "./helpers";
import { json } from "./helpers";

// ==============================================
// TRANSACTION CATEGORIES ROUTES
// ==============================================

export const transactionCategoryRoutes: Route[] = [
  // GET /api/v1/transaction-categories - List all categories
  {
    method: "GET",
    pattern: /^\/api\/v1\/transaction-categories$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const categories = await getCategories(auth.activeTenantId!);
        return json(successResponse({ categories }));
      } catch (error) {
        logger.error({ error }, "Error fetching categories");
        return json(errorResponse("INTERNAL_ERROR", "Failed to fetch categories"), 500);
      }
    },
    params: [],
  },

  // GET /api/v1/transaction-categories/usage - Get category usage statistics
  {
    method: "GET",
    pattern: /^\/api\/v1\/transaction-categories\/usage$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const usage = await getCategoryUsage(auth.activeTenantId!);
        return json(successResponse({ usage }));
      } catch (error) {
        logger.error({ error }, "Error fetching category usage");
        return json(errorResponse("INTERNAL_ERROR", "Failed to fetch usage"), 500);
      }
    },
    params: [],
  },

  // POST /api/v1/transaction-categories/seed - Seed default categories
  {
    method: "POST",
    pattern: /^\/api\/v1\/transaction-categories\/seed$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        await seedDefaultCategories(auth.activeTenantId!);
        const categories = await getCategories(auth.activeTenantId!);
        return json(successResponse({ message: "Default categories seeded", categories }));
      } catch (error) {
        logger.error({ error }, "Error seeding categories");
        return json(errorResponse("INTERNAL_ERROR", "Failed to seed categories"), 500);
      }
    },
    params: [],
  },

  // GET /api/v1/transaction-categories/slug/:slug - Get category by slug
  {
    method: "GET",
    pattern: /^\/api\/v1\/transaction-categories\/slug\/([^/]+)$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const category = await getCategoryBySlug(auth.activeTenantId!, params.slug);
        if (!category) {
          return json(errorResponse("NOT_FOUND", "Category not found"), 404);
        }

        return json(successResponse({ category }));
      } catch (error) {
        logger.error({ error }, "Error fetching category");
        return json(errorResponse("INTERNAL_ERROR", "Failed to fetch category"), 500);
      }
    },
    params: ["slug"],
  },

  // GET /api/v1/transaction-categories/:id - Get category by ID
  {
    method: "GET",
    pattern: /^\/api\/v1\/transaction-categories\/([^/]+)$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const category = await getCategoryById(auth.activeTenantId!, params.id);
        if (!category) {
          return json(errorResponse("NOT_FOUND", "Category not found"), 404);
        }

        return json(successResponse({ category }));
      } catch (error) {
        logger.error({ error }, "Error fetching category");
        return json(errorResponse("INTERNAL_ERROR", "Failed to fetch category"), 500);
      }
    },
    params: ["id"],
  },

  // POST /api/v1/transaction-categories - Create a new category
  {
    method: "POST",
    pattern: /^\/api\/v1\/transaction-categories$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const body = (await request.json()) as {
          slug: string;
          name: string;
          description?: string;
          color?: string;
          icon?: string;
          parentSlug?: string;
          vatRate?: number;
          embeddingText?: string;
        };

        if (!body.slug || !body.name) {
          return json(errorResponse("VALIDATION_ERROR", "Slug and name are required"), 400);
        }

        // Validate slug format
        if (!/^[a-z0-9-]+$/.test(body.slug)) {
          return json(
            errorResponse(
              "VALIDATION_ERROR",
              "Slug must only contain lowercase letters, numbers, and hyphens"
            ),
            400
          );
        }

        // Check if slug already exists
        const existing = await getCategoryBySlug(auth.activeTenantId!, body.slug);
        if (existing) {
          return json(errorResponse("CONFLICT", "Category with this slug already exists"), 409);
        }

        const category = await createCategory({
          tenantId: auth.activeTenantId!,
          slug: body.slug,
          name: body.name,
          description: body.description,
          color: body.color,
          icon: body.icon,
          parentSlug: body.parentSlug,
          vatRate: body.vatRate,
          embeddingText: body.embeddingText,
        });

        return json(successResponse({ category }), 201);
      } catch (error) {
        logger.error({ error }, "Error creating category");
        return json(errorResponse("INTERNAL_ERROR", "Failed to create category"), 500);
      }
    },
    params: [],
  },

  // PATCH /api/v1/transaction-categories/:id - Update a category
  {
    method: "PATCH",
    pattern: /^\/api\/v1\/transaction-categories\/([^/]+)$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const body = (await request.json()) as {
          name?: string;
          description?: string;
          color?: string;
          icon?: string;
          parentSlug?: string;
          vatRate?: number;
          embeddingText?: string;
        };

        const category = await updateCategory(auth.activeTenantId!, params.id, body);
        if (!category) {
          return json(
            errorResponse("NOT_FOUND", "Category not found or is a system category"),
            404
          );
        }

        return json(successResponse({ category }));
      } catch (error) {
        logger.error({ error }, "Error updating category");
        return json(errorResponse("INTERNAL_ERROR", "Failed to update category"), 500);
      }
    },
    params: ["id"],
  },

  // DELETE /api/v1/transaction-categories/:id - Delete a category
  {
    method: "DELETE",
    pattern: /^\/api\/v1\/transaction-categories\/([^/]+)$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const deleted = await deleteCategory(auth.activeTenantId!, params.id);
        if (!deleted) {
          return json(
            errorResponse("NOT_FOUND", "Category not found or is a system category"),
            404
          );
        }

        return json(successResponse({ message: "Category deleted" }));
      } catch (error) {
        logger.error({ error }, "Error deleting category");
        return json(errorResponse("INTERNAL_ERROR", "Failed to delete category"), 500);
      }
    },
    params: ["id"],
  },
];
