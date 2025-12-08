/**
 * Tenant Admin API Routes
 * Accessible only to tenant_admin role users within their tenant
 */

import { errorResponse, successResponse } from "@crm/utils";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { locations, tenantAccounts, users, userTenantRoles } from "../db/schema/index";
import { logger } from "../lib/logger";
import { requireAuth } from "../middleware/auth";
import { requireTenantContext } from "../system/tenant-context/middleware";
import { json, RouteBuilder } from "./helpers";

const router = new RouteBuilder();

// ============================================
// Users Management
// ============================================

// List users in tenant
router.get(
  "/api/tenant-admin/users",
  requireAuth(
    requireTenantContext(async (_request, _url, _params, _auth, tenantContext) => {
      try {
        const tenantUsers = await db
          .select()
          .from(users)
          .where(eq(users.tenantId, tenantContext.tenantId));

        return json(successResponse(tenantUsers));
      } catch (error) {
        logger.error({ error }, "Error listing tenant users");
        return json(errorResponse("INTERNAL_ERROR", "Failed to list users"), 500);
      }
    })
  )
);

// Get user by ID
router.get(
  "/api/tenant-admin/users/:id",
  requireAuth(
    requireTenantContext(async (_request, _url, params, _auth, tenantContext) => {
      try {
        const user = await db
          .select()
          .from(users)
          .where(and(eq(users.id, params.id), eq(users.tenantId, tenantContext.tenantId)))
          .limit(1);

        if (user.length === 0) {
          return json(errorResponse("NOT_FOUND", "User not found"), 404);
        }

        return json(successResponse(user[0]));
      } catch (error) {
        logger.error({ error }, "Error getting user");
        return json(errorResponse("INTERNAL_ERROR", "Failed to get user"), 500);
      }
    })
  )
);

// Create user in tenant
router.post(
  "/api/tenant-admin/users",
  requireAuth(
    requireTenantContext(async (request, _url, _params, _auth, tenantContext) => {
      try {
        const body = (await request.json()) as {
          firstName: string;
          lastName: string;
          email: string;
          password?: string;
          role?: "tenant_admin" | "crm_user";
          phone?: string;
        };

        if (!body.firstName || !body.lastName || !body.email) {
          return json(
            errorResponse("VALIDATION_ERROR", "First name, last name, and email are required"),
            400
          );
        }

        // Check if user with email already exists
        const existingUser = await db
          .select()
          .from(users)
          .where(eq(users.email, body.email))
          .limit(1);

        if (existingUser.length > 0) {
          return json(errorResponse("CONFLICT", "User with this email already exists"), 409);
        }

        // Import auth service for user creation
        const { authService } = await import("../services/auth.service");

        const registerResult = await authService.registerUser({
          firstName: body.firstName,
          lastName: body.lastName,
          email: body.email,
          password: body.password || crypto.randomUUID(), // Generate random password if not provided
          role: body.role || "crm_user",
        });

        if (!registerResult.success || !registerResult.data) {
          return json(
            errorResponse(
              "INTERNAL_ERROR",
              registerResult.error?.message || "Failed to create user"
            ),
            500
          );
        }

        // Update user with tenantId
        await db
          .update(users)
          .set({ tenantId: tenantContext.tenantId })
          .where(eq(users.id, registerResult.data.id));

        // Create user-tenant role relationship
        await db.insert(userTenantRoles).values({
          id: crypto.randomUUID(),
          userId: registerResult.data.id,
          tenantId: tenantContext.tenantId,
          role: "user",
          permissions: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Fetch the created user with tenantId
        const [createdUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, registerResult.data.id))
          .limit(1);

        return json(successResponse(createdUser), 201);
      } catch (error) {
        logger.error({ error }, "Error creating user");
        return json(errorResponse("INTERNAL_ERROR", "Failed to create user"), 500);
      }
    })
  )
);

// Update user in tenant
router.put(
  "/api/tenant-admin/users/:id",
  requireAuth(
    requireTenantContext(async (request, _url, params, _auth, tenantContext) => {
      try {
        const body = (await request.json()) as {
          firstName?: string;
          lastName?: string;
          email?: string;
          phone?: string;
          role?: "tenant_admin" | "crm_user";
          status?: string;
        };

        // Verify user belongs to tenant
        const existingUser = await db
          .select()
          .from(users)
          .where(and(eq(users.id, params.id), eq(users.tenantId, tenantContext.tenantId)))
          .limit(1);

        if (existingUser.length === 0) {
          return json(errorResponse("NOT_FOUND", "User not found"), 404);
        }

        // Check if email is being changed and if it's already taken
        if (body.email && body.email !== existingUser[0].email) {
          const emailExists = await db
            .select()
            .from(users)
            .where(eq(users.email, body.email))
            .limit(1);

          if (emailExists.length > 0) {
            return json(errorResponse("CONFLICT", "Email already in use"), 409);
          }
        }

        // Update user
        const updateData: Record<string, unknown> = {
          updatedAt: new Date(),
        };

        if (body.firstName !== undefined) updateData.firstName = body.firstName;
        if (body.lastName !== undefined) updateData.lastName = body.lastName;
        if (body.email !== undefined) updateData.email = body.email;
        if (body.phone !== undefined) updateData.phone = body.phone;
        if (body.role !== undefined) updateData.role = body.role;
        if (body.status !== undefined) updateData.status = body.status;

        await db.update(users).set(updateData).where(eq(users.id, params.id));

        // Update user-tenant role if role changed
        if (body.role !== undefined) {
          await db
            .update(userTenantRoles)
            .set({
              role:
                body.role === "tenant_admin" ? "admin" : body.role === "crm_user" ? "user" : "user",
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(userTenantRoles.userId, params.id),
                eq(userTenantRoles.tenantId, tenantContext.tenantId)
              )
            );
        }

        // Fetch updated user
        const [updatedUser] = await db.select().from(users).where(eq(users.id, params.id)).limit(1);

        return json(successResponse(updatedUser));
      } catch (error) {
        logger.error({ error }, "Error updating user");
        return json(errorResponse("INTERNAL_ERROR", "Failed to update user"), 500);
      }
    })
  )
);

// Delete user from tenant
router.delete(
  "/api/tenant-admin/users/:id",
  requireAuth(
    requireTenantContext(async (_request, _url, params, auth, tenantContext) => {
      try {
        // Verify user belongs to tenant
        const existingUser = await db
          .select()
          .from(users)
          .where(and(eq(users.id, params.id), eq(users.tenantId, tenantContext.tenantId)))
          .limit(1);

        if (existingUser.length === 0) {
          return json(errorResponse("NOT_FOUND", "User not found"), 404);
        }

        // Prevent deleting yourself
        if (params.id === auth.userId) {
          return json(errorResponse("FORBIDDEN", "Cannot delete your own account"), 403);
        }

        // Delete user-tenant role relationship
        await db
          .delete(userTenantRoles)
          .where(
            and(
              eq(userTenantRoles.userId, params.id),
              eq(userTenantRoles.tenantId, tenantContext.tenantId)
            )
          );

        // Soft delete user (set tenantId to null instead of hard delete)
        await db
          .update(users)
          .set({ tenantId: null, updatedAt: new Date() })
          .where(eq(users.id, params.id));

        return json(successResponse({ message: "User deleted successfully" }));
      } catch (error) {
        logger.error({ error }, "Error deleting user");
        return json(errorResponse("INTERNAL_ERROR", "Failed to delete user"), 500);
      }
    })
  )
);

// ============================================
// Companies Management
// ============================================

// List companies in tenant
router.get(
  "/api/tenant-admin/companies",
  requireAuth(
    requireTenantContext(async (_request, _url, _params, _auth, tenantContext) => {
      try {
        const rows = await db
          .select()
          .from(tenantAccounts)
          .where(eq(tenantAccounts.tenantId, tenantContext.tenantId));

        return json(successResponse(rows));
      } catch (error) {
        logger.error({ error }, "Error listing tenant companies");
        return json(errorResponse("INTERNAL_ERROR", "Failed to list companies"), 500);
      }
    })
  )
);

// Get company by ID
router.get(
  "/api/tenant-admin/companies/:id",
  requireAuth(
    requireTenantContext(async (_request, _url, params, _auth, tenantContext) => {
      try {
        const company = await db
          .select()
          .from(tenantAccounts)
          .where(
            and(
              eq(tenantAccounts.id, params.id),
              eq(tenantAccounts.tenantId, tenantContext.tenantId)
            )
          )
          .limit(1);

        if (company.length === 0) {
          return json(errorResponse("NOT_FOUND", "Company not found"), 404);
        }

        return json(successResponse(company[0]));
      } catch (error) {
        logger.error({ error }, "Error getting company");
        return json(errorResponse("INTERNAL_ERROR", "Failed to get company"), 500);
      }
    })
  )
);

// Create company in tenant
router.post(
  "/api/tenant-admin/companies",
  requireAuth(
    requireTenantContext(async (request, _url, _params, auth, tenantContext) => {
      // Allow tenant_admin and admin roles to create companies in their tenant
      if (auth.role !== "tenant_admin" && auth.role !== "admin") {
        return json(
          errorResponse(
            "FORBIDDEN",
            "Tenant admin or admin access required to create tenant companies"
          ),
          403
        );
      }
      try {
        const body = (await request.json()) as {
          name: string;
          industry: string;
          address: string;
          locationId?: string;
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
          note?: string;
        };

        if (!body.name || !body.industry || !body.address) {
          return json(
            errorResponse("VALIDATION_ERROR", "Name, industry, and address are required"),
            400
          );
        }

        // Validate locationId if provided
        if (body.locationId) {
          const location = await db
            .select()
            .from(locations)
            .where(
              and(eq(locations.id, body.locationId), eq(locations.tenantId, tenantContext.tenantId))
            )
            .limit(1);

          if (location.length === 0) {
            return json(errorResponse("NOT_FOUND", "Location not found"), 404);
          }
        }

        let duplicate: (typeof tenantAccounts.$inferSelect)[] = [];
        if (body.vatNumber && body.vatNumber.trim().length > 0) {
          duplicate = await db
            .select()
            .from(tenantAccounts)
            .where(
              and(
                eq(tenantAccounts.tenantId, tenantContext.tenantId),
                eq(tenantAccounts.vatNumber, body.vatNumber)
              )
            )
            .limit(1);
        }
        if (duplicate.length > 0) {
          return json(
            errorResponse("DUPLICATE", "Company with same PIB/VAT already exists in this tenant"),
            400
          );
        }

        const [newCompany] = await db
          .insert(tenantAccounts)
          .values({
            id: crypto.randomUUID(),
            tenantId: tenantContext.tenantId,
            locationId: body.locationId || null,
            name: body.name,
            industry: body.industry,
            address: body.address,
            email: body.email || null,
            phone: body.phone || null,
            website: body.website || null,
            contact: body.contact || null,
            city: body.city || null,
            zip: body.zip || null,
            country: body.country || null,
            countryCode: body.countryCode || null,
            vatNumber: body.vatNumber || null,
            companyNumber: body.companyNumber || null,
            logoUrl: body.logoUrl || null,
            note: body.note || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        return json(successResponse(newCompany), 201);
      } catch (error) {
        logger.error({ error }, "Error creating company");
        return json(errorResponse("INTERNAL_ERROR", "Failed to create company"), 500);
      }
    })
  )
);

// Update company in tenant
router.put(
  "/api/tenant-admin/companies/:id",
  requireAuth(
    requireTenantContext(async (request, _url, params, _auth, tenantContext) => {
      try {
        const body = (await request.json()) as {
          name?: string;
          industry?: string;
          address?: string;
          locationId?: string;
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
          note?: string;
        };

        // Verify company belongs to tenant
        const existingCompany = await db
          .select()
          .from(tenantAccounts)
          .where(
            and(
              eq(tenantAccounts.id, params.id),
              eq(tenantAccounts.tenantId, tenantContext.tenantId)
            )
          )
          .limit(1);

        if (existingCompany.length === 0) {
          return json(errorResponse("NOT_FOUND", "Company not found"), 404);
        }

        // Validate locationId if provided
        if (body.locationId) {
          const location = await db
            .select()
            .from(locations)
            .where(
              and(eq(locations.id, body.locationId), eq(locations.tenantId, tenantContext.tenantId))
            )
            .limit(1);

          if (location.length === 0) {
            return json(errorResponse("NOT_FOUND", "Location not found"), 404);
          }
        }

        // Build update data
        const updateData: Record<string, unknown> = {
          updatedAt: new Date(),
        };

        if (body.name !== undefined) updateData.name = body.name;
        if (body.industry !== undefined) updateData.industry = body.industry;
        if (body.address !== undefined) updateData.address = body.address;
        if (body.locationId !== undefined) updateData.locationId = body.locationId || null;
        if (body.email !== undefined) updateData.email = body.email || null;
        if (body.phone !== undefined) updateData.phone = body.phone || null;
        if (body.website !== undefined) updateData.website = body.website || null;
        if (body.contact !== undefined) updateData.contact = body.contact || null;
        if (body.city !== undefined) updateData.city = body.city || null;
        if (body.zip !== undefined) updateData.zip = body.zip || null;
        if (body.country !== undefined) updateData.country = body.country || null;
        if (body.countryCode !== undefined) updateData.countryCode = body.countryCode || null;
        if (body.vatNumber !== undefined) updateData.vatNumber = body.vatNumber || null;
        if (body.companyNumber !== undefined) updateData.companyNumber = body.companyNumber || null;
        if (body.logoUrl !== undefined) updateData.logoUrl = body.logoUrl || null;
        if (body.note !== undefined) updateData.note = body.note || null;

        await db.update(tenantAccounts).set(updateData).where(eq(tenantAccounts.id, params.id));

        // Fetch updated company
        const [updatedCompany] = await db
          .select()
          .from(tenantAccounts)
          .where(eq(tenantAccounts.id, params.id))
          .limit(1);

        return json(successResponse(updatedCompany));
      } catch (error) {
        logger.error({ error }, "Error updating company");
        return json(errorResponse("INTERNAL_ERROR", "Failed to update company"), 500);
      }
    })
  )
);

// Delete company from tenant
router.delete(
  "/api/tenant-admin/companies/:id",
  requireAuth(
    requireTenantContext(async (_request, _url, params, _auth, tenantContext) => {
      try {
        // Verify company belongs to tenant
        const existingCompany = await db
          .select()
          .from(tenantAccounts)
          .where(
            and(
              eq(tenantAccounts.id, params.id),
              eq(tenantAccounts.tenantId, tenantContext.tenantId)
            )
          )
          .limit(1);

        if (existingCompany.length === 0) {
          return json(errorResponse("NOT_FOUND", "Company not found"), 404);
        }

        // Soft delete company (cascade will handle related records)
        await db.delete(tenantAccounts).where(eq(tenantAccounts.id, params.id));

        return json(successResponse({ message: "Company deleted successfully" }));
      } catch (error) {
        logger.error({ error }, "Error deleting company");
        return json(errorResponse("INTERNAL_ERROR", "Failed to delete company"), 500);
      }
    })
  )
);

// ============================================
// Locations Management
// ============================================

// List locations in tenant
router.get(
  "/api/tenant-admin/locations",
  requireAuth(
    requireTenantContext(async (_request, _url, _params, _auth, tenantContext) => {
      try {
        const tenantLocations = await db
          .select()
          .from(locations)
          .where(eq(locations.tenantId, tenantContext.tenantId));

        return json(successResponse(tenantLocations));
      } catch (error) {
        logger.error({ error }, "Error listing tenant locations");
        return json(errorResponse("INTERNAL_ERROR", "Failed to list locations"), 500);
      }
    })
  )
);

// Get location by ID
router.get(
  "/api/tenant-admin/locations/:id",
  requireAuth(
    requireTenantContext(async (_request, _url, params, _auth, tenantContext) => {
      try {
        const location = await db
          .select()
          .from(locations)
          .where(and(eq(locations.id, params.id), eq(locations.tenantId, tenantContext.tenantId)))
          .limit(1);

        if (location.length === 0) {
          return json(errorResponse("NOT_FOUND", "Location not found"), 404);
        }

        return json(successResponse(location[0]));
      } catch (error) {
        logger.error({ error }, "Error getting location");
        return json(errorResponse("INTERNAL_ERROR", "Failed to get location"), 500);
      }
    })
  )
);

// Create location
router.post(
  "/api/tenant-admin/locations",
  requireAuth(
    requireTenantContext(async (request, _url, _params, _auth, tenantContext) => {
      try {
        const body = (await request.json()) as {
          name: string;
          code?: string;
          metadata?: Record<string, unknown>;
        };

        if (!body.name) {
          return json(errorResponse("VALIDATION_ERROR", "Location name is required"), 400);
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
        return json(errorResponse("INTERNAL_ERROR", "Failed to create location"), 500);
      }
    })
  )
);

// ============================================
// Tenant Settings (placeholder)
// ============================================

router.get(
  "/api/tenant-admin/settings",
  requireAuth(
    requireTenantContext(async (_request, _url, _params, _auth, tenantContext) => {
      try {
        // Placeholder - can be extended with actual settings
        return json(
          successResponse({
            tenantId: tenantContext.tenantId,
            settings: {},
            message: "Settings retrieval not yet implemented",
          })
        );
      } catch (error) {
        logger.error({ error }, "Error getting tenant settings");
        return json(errorResponse("INTERNAL_ERROR", "Failed to get settings"), 500);
      }
    })
  )
);

export const tenantAdminRoutes = router.getRoutes();
