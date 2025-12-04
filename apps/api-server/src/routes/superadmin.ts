/**
 * Superadmin API Routes
 * Only accessible to users with superadmin role
 */

import { successResponse, errorResponse } from "@crm/utils";
import { RouteBuilder, json } from "./helpers";
import { requireAdmin } from "../middleware/auth";
import { db } from "../db/client";
import { tenants } from "../db/schema/index";
import { eq, isNull, ne } from "drizzle-orm";
import { users, companies } from "../db/schema/index";
import { cache } from "../cache/redis";
import { provisioningService } from "../system/provisioning/provisioning.service";
import { logger } from "../lib/logger";
import type { ProvisioningRequest } from "../system/provisioning/types";

const router = new RouteBuilder();

// ============================================
// Tenants CRUD
// ============================================

// List all tenants
router.get(
	"/api/superadmin/tenants",
	requireAdmin(async (request, url, params, auth) => {
		try {
			const allTenants = await db.select().from(tenants);
			return json(successResponse(allTenants));
		} catch (error) {
			logger.error({ error }, "Error listing tenants");
			return json(
				errorResponse("INTERNAL_ERROR", "Failed to list tenants"),
				500,
			);
		}
	}),
);

// Get tenant by ID
router.get(
	"/api/superadmin/tenants/:id",
	requireAdmin(async (request, url, params, auth) => {
		try {
			const tenant = await db
				.select()
				.from(tenants)
				.where(eq(tenants.id, params.id))
				.limit(1);

			if (tenant.length === 0) {
				return json(errorResponse("NOT_FOUND", "Tenant not found"), 404);
			}

			return json(successResponse(tenant[0]));
		} catch (error) {
			logger.error({ error, tenantId: params.id }, "Error getting tenant");
			return json(
				errorResponse("INTERNAL_ERROR", "Failed to get tenant"),
				500,
			);
		}
	}),
);

// Update tenant
router.put(
	"/api/superadmin/tenants/:id",
	requireAdmin(async (request, url, params, auth) => {
		try {
			const body = (await request.json()) as {
				name?: string;
				status?: "active" | "suspended" | "deleted";
				metadata?: Record<string, unknown>;
			};

			const [updated] = await db
				.update(tenants)
				.set({
					...(body.name && { name: body.name }),
					...(body.status && { status: body.status }),
					...(body.metadata && { metadata: body.metadata }),
					updatedAt: new Date(),
				})
				.where(eq(tenants.id, params.id))
				.returning();

			if (!updated) {
				return json(errorResponse("NOT_FOUND", "Tenant not found"), 404);
			}

			return json(successResponse(updated));
		} catch (error) {
			logger.error({ error, tenantId: params.id }, "Error updating tenant");
			return json(
				errorResponse("INTERNAL_ERROR", "Failed to update tenant"),
				500,
			);
		}
	}),
);

// Delete tenant (soft delete)
router.delete(
	"/api/superadmin/tenants/:id",
	requireAdmin(async (request, url, params, auth) => {
		try {
			const [deleted] = await db
				.update(tenants)
				.set({
					status: "deleted",
					deletedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(tenants.id, params.id))
				.returning();

			if (!deleted) {
				return json(errorResponse("NOT_FOUND", "Tenant not found"), 404);
			}

			return json(successResponse({ message: "Tenant deleted" }));
		} catch (error) {
			logger.error({ error, tenantId: params.id }, "Error deleting tenant");
			return json(
				errorResponse("INTERNAL_ERROR", "Failed to delete tenant"),
				500,
			);
		}
	}),
);

// ============================================
// Tenant Health
// ============================================

router.get(
	"/api/superadmin/tenants/:id/health",
	requireAdmin(async (request, url, params, auth) => {
		try {
			// Basic health check - can be extended with actual health metrics
			const tenant = await db
				.select()
				.from(tenants)
				.where(eq(tenants.id, params.id))
				.limit(1);

			if (tenant.length === 0) {
				return json(errorResponse("NOT_FOUND", "Tenant not found"), 404);
			}

			const health = {
				tenantId: tenant[0].id,
				status: tenant[0].status,
				isActive: tenant[0].status === "active" && !tenant[0].deletedAt,
				timestamp: new Date().toISOString(),
			};

			return json(successResponse(health));
		} catch (error) {
			logger.error({ error, tenantId: params.id }, "Error getting tenant health");
			return json(
				errorResponse("INTERNAL_ERROR", "Failed to get tenant health"),
				500,
			);
		}
	}),
);

// ============================================
// Tenant Logs (placeholder)
// ============================================

router.get(
	"/api/superadmin/tenants/:id/logs",
	requireAdmin(async (request, url, params, auth) => {
		try {
			// Placeholder - can be extended with actual log retrieval
			return json(
				successResponse({
					tenantId: params.id,
					logs: [],
					message: "Log retrieval not yet implemented",
				}),
			);
		} catch (error) {
			logger.error({ error, tenantId: params.id }, "Error getting tenant logs");
			return json(
				errorResponse("INTERNAL_ERROR", "Failed to get tenant logs"),
				500,
			);
		}
	}),
);

// ============================================
// Tenant Metrics (placeholder)
// ============================================

router.get(
	"/api/superadmin/tenants/:id/metrics",
	requireAdmin(async (request, url, params, auth) => {
		try {
			// Placeholder - can be extended with actual metrics
			return json(
				successResponse({
					tenantId: params.id,
					metrics: {
						users: 0,
						companies: 0,
						documents: 0,
					},
					message: "Metrics retrieval not yet implemented",
				}),
			);
		} catch (error) {
			logger.error(
				{ error, tenantId: params.id },
				"Error getting tenant metrics",
			);
			return json(
				errorResponse("INTERNAL_ERROR", "Failed to get tenant metrics"),
				500,
			);
		}
	}),
);

// ============================================
// Provisioning
// ============================================

router.post(
	"/api/superadmin/provision",
	requireAdmin(async (request, url, params, auth) => {
		try {
			const body = (await request.json()) as ProvisioningRequest;

			// Validate required fields
			if (!body.name || !body.slug || !body.adminEmail || !body.adminPassword) {
				return json(
					errorResponse(
						"VALIDATION_ERROR",
						"Missing required fields: name, slug, adminEmail, adminPassword",
					),
					400,
				);
			}

			const result = await provisioningService.provision(body);

			if (!result.success) {
				return json(result, result.error?.code === "CONFLICT" ? 409 : 500);
			}

			return json(result, 201);
		} catch (error) {
			logger.error({ error }, "Error provisioning tenant");
			return json(
				errorResponse("INTERNAL_ERROR", "Failed to provision tenant"),
				500,
			);
		}
	}),
);

// Get provisioning status
router.get(
	"/api/superadmin/provision/:tenantId/status",
	requireAdmin(async (request, url, params, auth) => {
		try {
			const status = await provisioningService.getStatus(params.tenantId);

			if (!status) {
				return json(
					errorResponse("NOT_FOUND", "Provisioning status not found"),
					404,
				);
			}

			return json(successResponse(status));
		} catch (error) {
			logger.error(
				{ error, tenantId: params.tenantId },
				"Error getting provisioning status",
			);
			return json(
				errorResponse(
					"INTERNAL_ERROR",
					"Failed to get provisioning status",
				),
				500,
			);
		}
	}),
);

// ============================================
// Admin Setup: Initialize Default Tenant
// ============================================

router.post(
  "/api/superadmin/setup/init-default-tenant",
  requireAdmin(async (_request, _url, _params, _auth) => {
    try {
      // Check if any tenant exists
      const existing = await db.select().from(tenants).limit(1);
      if (existing.length > 0) {
        return json(
          successResponse({
            tenantId: existing[0].id,
            created: false,
            message: "Tenant already exists",
          }),
        );
      }

      // Create default tenant
      const [createdTenant] = await db
        .insert(tenants)
        .values({
          name: "Default Tenant",
          slug: "default",
          status: "active",
          metadata: { initializedBy: "superadmin", timestamp: new Date().toISOString() },
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      const defaultTenantId = createdTenant.id;

      // Assign tenantId to companies without tenantId
      const companiesUpdated = await db
        .update(companies)
        .set({ tenantId: defaultTenantId, updatedAt: new Date() })
        .where(isNull(companies.tenantId))
        .returning({ id: companies.id });

      // Assign tenantId to users without tenantId (excluding superadmin)
      const usersUpdated = await db
        .update(users)
        .set({ tenantId: defaultTenantId, updatedAt: new Date() })
        .where(isNull(users.tenantId))
        .returning({ id: users.id, role: users.role });

      // Invalidate caches
      await cache.invalidatePattern("users:*");
      await cache.invalidatePattern("companies:*");

      return json(
        successResponse({
          tenantId: defaultTenantId,
          created: true,
          companiesUpdated: companiesUpdated.length,
          usersUpdated: usersUpdated.length,
        }),
        201,
      );
    } catch (error) {
      logger.error({ error }, "Error initializing default tenant");
      return json(
        errorResponse("INTERNAL_ERROR", "Failed to initialize default tenant"),
        500,
      );
    }
  }),
);

export const superadminRoutes = router.getRoutes();
