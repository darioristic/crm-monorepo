/**
 * Superadmin API Routes
 * Only accessible to users with superadmin role
 */

import { errorResponse, successResponse } from "@crm/utils";
import { eq, isNull } from "drizzle-orm";
import { cache } from "../cache/redis";
import { db } from "../db/client";
import { companies, tenants, users } from "../db/schema/index";
import { logger } from "../lib/logger";
import { requireAdmin } from "../middleware/auth";
import { provisioningService } from "../system/provisioning/provisioning.service";
import type { ProvisioningRequest } from "../system/provisioning/types";
import { json, RouteBuilder } from "./helpers";

const router = new RouteBuilder();

// ============================================
// Tenants CRUD
// ============================================

// List all tenants
router.get(
  "/api/superadmin/tenants",
  requireAdmin(async (_request, _url, _params, _auth) => {
    try {
      const allTenants = await db.select().from(tenants);
      return json(successResponse(allTenants));
    } catch (error) {
      logger.error({ error }, "Error listing tenants");
      return json(errorResponse("INTERNAL_ERROR", "Failed to list tenants"), 500);
    }
  })
);

// Get tenant by ID
router.get(
  "/api/superadmin/tenants/:id",
  requireAdmin(async (_request, _url, params, _auth) => {
    try {
      const tenant = await db.select().from(tenants).where(eq(tenants.id, params.id)).limit(1);

      if (tenant.length === 0) {
        return json(errorResponse("NOT_FOUND", "Tenant not found"), 404);
      }

      return json(successResponse(tenant[0]));
    } catch (error) {
      logger.error({ error, tenantId: params.id }, "Error getting tenant");
      return json(errorResponse("INTERNAL_ERROR", "Failed to get tenant"), 500);
    }
  })
);

// Update tenant
router.put(
  "/api/superadmin/tenants/:id",
  requireAdmin(async (request, _url, params, _auth) => {
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
      return json(errorResponse("INTERNAL_ERROR", "Failed to update tenant"), 500);
    }
  })
);

// Delete tenant (soft delete)
router.delete(
  "/api/superadmin/tenants/:id",
  requireAdmin(async (_request, _url, params, _auth) => {
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
      return json(errorResponse("INTERNAL_ERROR", "Failed to delete tenant"), 500);
    }
  })
);

// ============================================
// Tenant Health
// ============================================

router.get(
  "/api/superadmin/tenants/:id/health",
  requireAdmin(async (_request, _url, params, _auth) => {
    try {
      // Basic health check - can be extended with actual health metrics
      const tenant = await db.select().from(tenants).where(eq(tenants.id, params.id)).limit(1);

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
      return json(errorResponse("INTERNAL_ERROR", "Failed to get tenant health"), 500);
    }
  })
);

// ============================================
// Tenant Logs (placeholder)
// ============================================

router.get(
  "/api/superadmin/tenants/:id/logs",
  requireAdmin(async (_request, _url, params, _auth) => {
    try {
      // Placeholder - can be extended with actual log retrieval
      return json(
        successResponse({
          tenantId: params.id,
          logs: [],
          message: "Log retrieval not yet implemented",
        })
      );
    } catch (error) {
      logger.error({ error, tenantId: params.id }, "Error getting tenant logs");
      return json(errorResponse("INTERNAL_ERROR", "Failed to get tenant logs"), 500);
    }
  })
);

// ============================================
// Tenant Metrics (placeholder)
// ============================================

router.get(
  "/api/superadmin/tenants/:id/metrics",
  requireAdmin(async (_request, _url, params, _auth) => {
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
        })
      );
    } catch (error) {
      logger.error({ error, tenantId: params.id }, "Error getting tenant metrics");
      return json(errorResponse("INTERNAL_ERROR", "Failed to get tenant metrics"), 500);
    }
  })
);

// ============================================
// Provisioning
// ============================================

router.post(
  "/api/superadmin/provision",
  requireAdmin(async (request, _url, _params, _auth) => {
    try {
      const body = (await request.json()) as ProvisioningRequest;

      // Validate required fields
      if (!body.name || !body.slug || !body.adminEmail || !body.adminPassword) {
        return json(
          errorResponse(
            "VALIDATION_ERROR",
            "Missing required fields: name, slug, adminEmail, adminPassword"
          ),
          400
        );
      }

      const result = await provisioningService.provision(body);

      if (!result.success) {
        return json(result, result.error?.code === "CONFLICT" ? 409 : 500);
      }

      return json(result, 201);
    } catch (error) {
      logger.error({ error }, "Error provisioning tenant");
      return json(errorResponse("INTERNAL_ERROR", "Failed to provision tenant"), 500);
    }
  })
);

// Get provisioning status
router.get(
  "/api/superadmin/provision/:tenantId/status",
  requireAdmin(async (_request, _url, params, _auth) => {
    try {
      const status = await provisioningService.getStatus(params.tenantId);

      if (!status) {
        return json(errorResponse("NOT_FOUND", "Provisioning status not found"), 404);
      }

      return json(successResponse(status));
    } catch (error) {
      logger.error({ error, tenantId: params.tenantId }, "Error getting provisioning status");
      return json(errorResponse("INTERNAL_ERROR", "Failed to get provisioning status"), 500);
    }
  })
);

// ============================================
// Admin Setup: Initialize Default Tenant
// ============================================

router.get(
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
          })
        );
      }

      // Create default tenant
      const [createdTenant] = await db
        .insert(tenants)
        .values({
          name: "Default Tenant",
          slug: "default",
          status: "active",
          metadata: {
            initializedBy: "superadmin",
            timestamp: new Date().toISOString(),
          },
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
        201
      );
    } catch (error) {
      logger.error({ error }, "Error initializing default tenant");
      return json(errorResponse("INTERNAL_ERROR", "Failed to initialize default tenant"), 500);
    }
  })
);

// ============================================
// Detailed System Report
// ============================================

router.get(
  "/api/superadmin/reports/detailed",
  requireAdmin(async (_request) => {
    try {
      const userRows = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: users.role,
        })
        .from(users);

      const tenantRows = await db
        .select({
          id: tenants.id,
          name: tenants.name,
          createdAt: tenants.createdAt,
          status: tenants.status,
        })
        .from(tenants);

      const report = {
        users: userRows.map((u) => ({
          id: u.id,
          name: `${u.firstName || ""} ${u.lastName || ""}`.trim(),
          email: u.email,
          role: u.role,
        })),
        tenants: tenantRows.map((t) => ({
          id: t.id,
          name: t.name,
          createdAt: new Date(t.createdAt).toISOString(),
          status: t.status,
        })),
      };

      return json(successResponse(report));
    } catch (error) {
      logger.error({ error }, "Error generating detailed report");
      return json(errorResponse("INTERNAL_ERROR", "Failed to generate detailed report"), 500);
    }
  })
);

// ============================================
// Tenant Users Management
// ============================================

// List users for a tenant
router.get(
  "/api/superadmin/tenants/:id/users",
  requireAdmin(async (_request, _url, params) => {
    try {
      const rows = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: users.role,
          status: users.status,
          phone: users.phone,
          avatarUrl: users.avatarUrl,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.tenantId, params.id));
      return json(successResponse(rows));
    } catch (error) {
      logger.error({ error, tenantId: params.id }, "Error listing tenant users");
      return json(errorResponse("INTERNAL_ERROR", "Failed to list users"), 500);
    }
  })
);

// Create user under a tenant
router.post(
  "/api/superadmin/tenants/:id/users",
  requireAdmin(async (request, _url, params) => {
    try {
      const body = (await request.json()) as {
        firstName: string;
        lastName: string;
        email: string;
        password: string;
        role?: "tenant_admin" | "crm_user";
        phone?: string;
        avatarUrl?: string;
      };

      if (!body?.firstName || !body?.lastName || !body?.email || !body?.password) {
        return json(
          errorResponse("VALIDATION_ERROR", "firstName, lastName, email and password are required"),
          400
        );
      }

      // Check if user with this email already exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, body.email))
        .limit(1);

      if (existingUser.length > 0) {
        return json(errorResponse("VALIDATION_ERROR", "User with this email already exists"), 409);
      }

      // Hash password
      const hashedPassword = await Bun.password.hash(body.password);

      const [created] = await db
        .insert(users)
        .values({
          tenantId: params.id,
          firstName: body.firstName,
          lastName: body.lastName,
          email: body.email,
          passwordHash: hashedPassword,
          role: body.role || "crm_user",
          status: "active",
          phone: body.phone,
          avatarUrl: body.avatarUrl,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: users.role,
          status: users.status,
          phone: users.phone,
          avatarUrl: users.avatarUrl,
          createdAt: users.createdAt,
        });

      // Invalidate cache
      await cache.invalidatePattern("users:*");

      return json(successResponse(created), 201);
    } catch (error) {
      logger.error({ error, tenantId: params.id }, "Error creating tenant user");
      return json(errorResponse("INTERNAL_ERROR", "Failed to create user"), 500);
    }
  })
);

// Update user
router.put(
  "/api/superadmin/tenants/:id/users/:userId",
  requireAdmin(async (request, _url, params) => {
    try {
      const body = (await request.json()) as {
        firstName?: string;
        lastName?: string;
        email?: string;
        role?: "tenant_admin" | "crm_user";
        status?: string;
        phone?: string;
        avatarUrl?: string;
      };

      const [updated] = await db
        .update(users)
        .set({
          ...(body.firstName && { firstName: body.firstName }),
          ...(body.lastName && { lastName: body.lastName }),
          ...(body.email && { email: body.email }),
          ...(body.role && { role: body.role }),
          ...(body.status && { status: body.status }),
          ...(body.phone !== undefined && { phone: body.phone }),
          ...(body.avatarUrl !== undefined && { avatarUrl: body.avatarUrl }),
          updatedAt: new Date(),
        })
        .where(eq(users.id, params.userId))
        .returning({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: users.role,
          status: users.status,
          phone: users.phone,
          avatarUrl: users.avatarUrl,
        });

      if (!updated) {
        return json(errorResponse("NOT_FOUND", "User not found"), 404);
      }

      // Invalidate cache
      await cache.invalidatePattern("users:*");

      return json(successResponse(updated));
    } catch (error) {
      logger.error({ error, userId: params.userId }, "Error updating user");
      return json(errorResponse("INTERNAL_ERROR", "Failed to update user"), 500);
    }
  })
);

// Delete user (soft delete by setting status to inactive)
router.delete(
  "/api/superadmin/tenants/:id/users/:userId",
  requireAdmin(async (_request, _url, params) => {
    try {
      const [deleted] = await db
        .update(users)
        .set({
          status: "inactive",
          updatedAt: new Date(),
        })
        .where(eq(users.id, params.userId))
        .returning({ id: users.id });

      if (!deleted) {
        return json(errorResponse("NOT_FOUND", "User not found"), 404);
      }

      // Invalidate cache
      await cache.invalidatePattern("users:*");

      return json(successResponse({ message: "User deleted" }));
    } catch (error) {
      logger.error({ error, userId: params.userId }, "Error deleting user");
      return json(errorResponse("INTERNAL_ERROR", "Failed to delete user"), 500);
    }
  })
);

export const superadminRoutes = router.getRoutes();

// ============================================
// Tenant Companies Management
// ============================================

// List companies for a tenant
router.get(
  "/api/superadmin/tenants/:id/companies",
  requireAdmin(async (_request, _url, params) => {
    try {
      const rows = await db.select().from(companies).where(eq(companies.tenantId, params.id));
      return json(successResponse(rows));
    } catch (error) {
      logger.error({ error, tenantId: params.id }, "Error listing tenant companies");
      return json(errorResponse("INTERNAL_ERROR", "Failed to list companies"), 500);
    }
  })
);

// Create company under a tenant
router.post(
  "/api/superadmin/tenants/:id/companies",
  requireAdmin(async (request, _url, params) => {
    try {
      const body = (await request.json()) as {
        name: string;
        industry: string;
        address: string;
        email?: string;
        phone?: string;
        website?: string;
        contact?: string;
        city?: string;
        zip?: string;
        country?: string;
        countryCode?: string;
        vatNumber?: string;
        companyNumber?: string;
        logoUrl?: string;
        source?: string;
        companyType?: "seller" | "customer";
        note?: string;
        metadata?: Record<string, unknown>;
      };

      if (!body?.name || !body?.industry || !body?.address) {
        return json(
          errorResponse("VALIDATION_ERROR", "name, industry and address are required"),
          400
        );
      }

      const [created] = await db
        .insert(companies)
        .values({
          tenantId: params.id,
          name: body.name,
          industry: body.industry,
          address: body.address,
          email: body.email,
          phone: body.phone,
          website: body.website,
          contact: body.contact,
          city: body.city,
          zip: body.zip,
          country: body.country,
          countryCode: body.countryCode,
          vatNumber: body.vatNumber,
          companyNumber: body.companyNumber,
          logoUrl: body.logoUrl,
          source: body.source,
          companyType: body.companyType || (body.source === "account" ? "seller" : "customer"),
          note: body.note,
          metadata: body.metadata,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return json(successResponse(created), 201);
    } catch (error) {
      logger.error({ error, tenantId: params.id }, "Error creating tenant company");
      return json(errorResponse("INTERNAL_ERROR", "Failed to create company"), 500);
    }
  })
);

// Delete company under a tenant
router.delete(
  "/api/superadmin/tenants/:id/companies/:companyId",
  requireAdmin(async (_request, _url, params) => {
    try {
      const existing = await db
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.id, params.companyId))
        .limit(1);

      if (existing.length === 0) {
        return json(errorResponse("NOT_FOUND", "Company not found"), 404);
      }

      await db.delete(companies).where(eq(companies.id, params.companyId));

      await cache.invalidatePattern("companies:*");

      return json(successResponse({ message: "Company deleted" }));
    } catch (error) {
      logger.error({ error, companyId: params.companyId }, "Error deleting company");
      return json(errorResponse("INTERNAL_ERROR", "Failed to delete company"), 500);
    }
  })
);

// Update company under a tenant
router.put(
  "/api/superadmin/tenants/:id/companies/:companyId",
  requireAdmin(async (request, _url, params) => {
    try {
      const body = (await request.json()) as {
        name?: string;
        industry?: string;
        address?: string;
        email?: string;
        phone?: string;
        website?: string;
        contact?: string;
        city?: string;
        zip?: string;
        country?: string;
        countryCode?: string;
        vatNumber?: string;
        companyNumber?: string;
        logoUrl?: string;
        source?: string;
        companyType?: "seller" | "customer";
        note?: string;
        metadata?: Record<string, unknown>;
      };

      const [updated] = await db
        .update(companies)
        .set({
          ...(body.name !== undefined && { name: body.name }),
          ...(body.industry !== undefined && { industry: body.industry }),
          ...(body.address !== undefined && { address: body.address }),
          ...(body.email !== undefined && { email: body.email }),
          ...(body.phone !== undefined && { phone: body.phone }),
          ...(body.website !== undefined && { website: body.website }),
          ...(body.contact !== undefined && { contact: body.contact }),
          ...(body.city !== undefined && { city: body.city }),
          ...(body.zip !== undefined && { zip: body.zip }),
          ...(body.country !== undefined && { country: body.country }),
          ...(body.countryCode !== undefined && { countryCode: body.countryCode }),
          ...(body.vatNumber !== undefined && { vatNumber: body.vatNumber }),
          ...(body.companyNumber !== undefined && { companyNumber: body.companyNumber }),
          ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl }),
          ...(body.source !== undefined && { source: body.source }),
          ...(body.companyType !== undefined && { companyType: body.companyType }),
          ...(body.note !== undefined && { note: body.note }),
          ...(body.metadata !== undefined && { metadata: body.metadata }),
          updatedAt: new Date(),
        })
        .where(eq(companies.id, params.companyId))
        .returning();

      if (!updated) {
        return json(errorResponse("NOT_FOUND", "Company not found"), 404);
      }

      await cache.invalidatePattern("companies:*");

      return json(successResponse(updated));
    } catch (error) {
      logger.error({ error, companyId: params.companyId }, "Error updating company");
      return json(errorResponse("INTERNAL_ERROR", "Failed to update company"), 500);
    }
  })
);
