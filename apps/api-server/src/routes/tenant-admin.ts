/**
 * Tenant Admin API Routes
 * Accessible only to tenant_admin role users within their tenant
 */

import { successResponse, errorResponse } from "@crm/utils";
import { RouteBuilder, json } from "./helpers";
import { requireAuth } from "../middleware/auth";
import { requireTenantContext } from "../system/tenant-context/middleware";
import { db } from "../db/client";
import { users, companies, locations, userTenantRoles } from "../db/schema/index";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = new RouteBuilder();

// ============================================
// Users Management
// ============================================

// List users in tenant
router.get(
	"/api/tenant-admin/users",
	requireAuth(
		requireTenantContext(async (request, url, params, auth, tenantContext) => {
			try {
				const tenantUsers = await db
					.select()
					.from(users)
					.where(eq(users.tenantId, tenantContext.tenantId));

				return json(successResponse(tenantUsers));
			} catch (error) {
				logger.error({ error }, "Error listing tenant users");
				return json(
					errorResponse("INTERNAL_ERROR", "Failed to list users"),
					500,
				);
			}
		}),
	),
);

// Get user by ID
router.get(
	"/api/tenant-admin/users/:id",
	requireAuth(
		requireTenantContext(async (request, url, params, auth, tenantContext) => {
			try {
				const user = await db
					.select()
					.from(users)
					.where(
						and(
							eq(users.id, params.id),
							eq(users.tenantId, tenantContext.tenantId),
						),
					)
					.limit(1);

				if (user.length === 0) {
					return json(errorResponse("NOT_FOUND", "User not found"), 404);
				}

				return json(successResponse(user[0]));
			} catch (error) {
				logger.error({ error }, "Error getting user");
				return json(
					errorResponse("INTERNAL_ERROR", "Failed to get user"),
					500,
				);
			}
		}),
	),
);

// ============================================
// Companies Management
// ============================================

// List companies in tenant
router.get(
	"/api/tenant-admin/companies",
	requireAuth(
		requireTenantContext(async (request, url, params, auth, tenantContext) => {
			try {
				const tenantCompanies = await db
					.select()
					.from(companies)
					.where(eq(companies.tenantId, tenantContext.tenantId));

				return json(successResponse(tenantCompanies));
			} catch (error) {
				logger.error({ error }, "Error listing tenant companies");
				return json(
					errorResponse("INTERNAL_ERROR", "Failed to list companies"),
					500,
				);
			}
		}),
	),
);

// Get company by ID
router.get(
	"/api/tenant-admin/companies/:id",
	requireAuth(
		requireTenantContext(async (request, url, params, auth, tenantContext) => {
			try {
				const company = await db
					.select()
					.from(companies)
					.where(
						and(
							eq(companies.id, params.id),
							eq(companies.tenantId, tenantContext.tenantId),
						),
					)
					.limit(1);

				if (company.length === 0) {
					return json(errorResponse("NOT_FOUND", "Company not found"), 404);
				}

				return json(successResponse(company[0]));
			} catch (error) {
				logger.error({ error }, "Error getting company");
				return json(
					errorResponse("INTERNAL_ERROR", "Failed to get company"),
					500,
				);
			}
		}),
	),
);

// ============================================
// Locations Management
// ============================================

// List locations in tenant
router.get(
	"/api/tenant-admin/locations",
	requireAuth(
		requireTenantContext(async (request, url, params, auth, tenantContext) => {
			try {
				const tenantLocations = await db
					.select()
					.from(locations)
					.where(eq(locations.tenantId, tenantContext.tenantId));

				return json(successResponse(tenantLocations));
			} catch (error) {
				logger.error({ error }, "Error listing tenant locations");
				return json(
					errorResponse("INTERNAL_ERROR", "Failed to list locations"),
					500,
				);
			}
		}),
	),
);

// Get location by ID
router.get(
	"/api/tenant-admin/locations/:id",
	requireAuth(
		requireTenantContext(async (request, url, params, auth, tenantContext) => {
			try {
				const location = await db
					.select()
					.from(locations)
					.where(
						and(
							eq(locations.id, params.id),
							eq(locations.tenantId, tenantContext.tenantId),
						),
					)
					.limit(1);

				if (location.length === 0) {
					return json(errorResponse("NOT_FOUND", "Location not found"), 404);
				}

				return json(successResponse(location[0]));
			} catch (error) {
				logger.error({ error }, "Error getting location");
				return json(
					errorResponse("INTERNAL_ERROR", "Failed to get location"),
					500,
				);
			}
		}),
	),
);

// Create location
router.post(
	"/api/tenant-admin/locations",
	requireAuth(
		requireTenantContext(async (request, url, params, auth, tenantContext) => {
			try {
				const body = (await request.json()) as {
					name: string;
					code?: string;
					metadata?: Record<string, unknown>;
				};

				if (!body.name) {
					return json(
						errorResponse("VALIDATION_ERROR", "Location name is required"),
						400,
					);
				}

				const [newLocation] = await db
					.insert(locations)
					.values({
						id: crypto.randomUUID(),
						tenantId: tenantContext.tenantId,
						name: body.name,
						code: body.code || null,
						metadata: body.metadata || null,
						createdAt: new Date(),
						updatedAt: new Date(),
					})
					.returning();

				return json(successResponse(newLocation), 201);
			} catch (error) {
				logger.error({ error }, "Error creating location");
				return json(
					errorResponse("INTERNAL_ERROR", "Failed to create location"),
					500,
				);
			}
		}),
	),
);

// ============================================
// Tenant Settings (placeholder)
// ============================================

router.get(
	"/api/tenant-admin/settings",
	requireAuth(
		requireTenantContext(async (request, url, params, auth, tenantContext) => {
			try {
				// Placeholder - can be extended with actual settings
				return json(
					successResponse({
						tenantId: tenantContext.tenantId,
						settings: {},
						message: "Settings retrieval not yet implemented",
					}),
				);
			} catch (error) {
				logger.error({ error }, "Error getting tenant settings");
				return json(
					errorResponse("INTERNAL_ERROR", "Failed to get settings"),
					500,
				);
			}
		}),
	),
);

export const tenantAdminRoutes = router.getRoutes();
