/**
 * User Routes
 */

import { errorResponse, successResponse } from "@crm/utils";
import { usersService } from "../services/users.service";
import {
  RouteBuilder,
  withAuth,
  withAdminAuth,
  parseBody,
  parsePagination,
  parseFilters,
} from "./helpers";
import type { CreateUserRequest, UpdateUserRequest, UserRole } from "@crm/types";
import { hasCompanyAccess } from "../db/queries/companies-members";
import { userQueries } from "../db/queries/users";
import { sql } from "../db/client";

const router = new RouteBuilder();

// ============================================
// List Users
// ============================================

router.get("/api/v1/users", async (request, url) => {
  return withAuth(request, async () => {
    const pagination = parsePagination(url);
    const filters = parseFilters(url);
    return usersService.getUsers(pagination, filters);
  });
});

// ============================================
// Get User by ID
// ============================================

router.get("/api/v1/users/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    return usersService.getUserById(params.id);
  });
});

// ============================================
// Create User (Admin only)
// ============================================

router.post("/api/v1/users", async (request) => {
  return withAdminAuth(
    request,
    async () => {
      const body = await parseBody<CreateUserRequest>(request);
      if (!body) {
        return errorResponse("VALIDATION_ERROR", "Invalid request body");
      }
      return usersService.createUser(body);
    },
    201
  );
});

// ============================================
// Update Current User (for company switching)
// MUST be before /api/v1/users/:id to avoid route conflict
// ============================================

router.put("/api/v1/users/me", async (request) => {
  console.log("🔄 PUT /api/v1/users/me - Company switch request received");
  return withAuth(request, async (auth) => {
    try {
      const body = await parseBody<{ companyId?: string }>(request);
      console.log("📦 Request body:", body);
      console.log("👤 Auth user:", { userId: auth.userId, role: auth.role });
      
      if (!body) {
        console.error("❌ Invalid request body");
        return errorResponse("VALIDATION_ERROR", "Invalid request body");
      }

      // If companyId is being updated, verify user has access to that company
      // Admin can switch to any company (for testing/admin purposes, similar to midday team switching)
      if (body.companyId !== undefined && body.companyId !== null && body.companyId !== "") {
        console.log("✅ CompanyId provided:", body.companyId);
        
        if (auth.role === "admin") {
          // Admin can switch to any company - verify it exists
          console.log("🔍 Admin user - verifying company exists");
          const companyExists = await sql`
            SELECT id FROM companies WHERE id = ${body.companyId}
          `;
          if (companyExists.length === 0) {
            console.error("❌ Company not found:", body.companyId);
            return errorResponse("NOT_FOUND", "Company not found");
          }
          console.log("✅ Company exists");
        } else {
          // Regular users can only switch to companies they're members of
          console.log("🔍 Regular user - checking company access");
          const hasAccess = await hasCompanyAccess(body.companyId, auth.userId);
          if (!hasAccess) {
            console.error("❌ User does not have access to company:", body.companyId);
            return errorResponse("FORBIDDEN", "Not a member of this company");
          }
          console.log("✅ User has access to company");
        }

        // Update user's current company using service for proper error handling
        console.log("🔄 Updating user company...");
        const result = await usersService.updateUser(auth.userId, {
          companyId: body.companyId,
        });

        if (!result.success) {
          console.error("❌ Failed to update user company:", result.error);
          return result;
        }

        console.log("✅ User company updated successfully:", {
          userId: result.data?.id,
          companyId: result.data?.companyId,
        });

        return successResponse({
          id: result.data?.id || auth.userId,
          companyId: result.data?.companyId || body.companyId,
        });
      }

      console.error("❌ CompanyId not provided or empty");
      return errorResponse("VALIDATION_ERROR", "companyId is required");
    } catch (error) {
      console.error("❌ Error updating user company:", error);
      if (error instanceof Error) {
        console.error("Error stack:", error.stack);
      }
      return errorResponse(
        "SERVER_ERROR",
        error instanceof Error ? error.message : "Failed to update user"
      );
    }
  });
});

// ============================================
// Update User
// ============================================

router.put("/api/v1/users/:id", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    // Users can only update themselves unless they're admin
    if (auth.userId !== params.id && auth.role !== "admin") {
      return errorResponse("FORBIDDEN", "Cannot update other users");
    }
    const body = await parseBody<UpdateUserRequest & { companyId?: string }>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }
    
    // If companyId is being updated, verify user has access to that company
    if (body.companyId !== undefined) {
      const hasAccess = await hasCompanyAccess(body.companyId, auth.userId);
      if (!hasAccess) {
        return errorResponse("FORBIDDEN", "Not a member of this company");
      }
    }
    
    // Non-admins cannot change their role
    if (auth.role !== "admin" && body.role) {
      delete (body as { role?: string }).role;
    }
    return usersService.updateUser(params.id, body);
  });
});

router.patch("/api/v1/users/:id", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    if (auth.userId !== params.id && auth.role !== "admin") {
      return errorResponse("FORBIDDEN", "Cannot update other users");
    }
    const body = await parseBody<UpdateUserRequest & { companyId?: string }>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }
    
    // If companyId is being updated, verify user has access to that company
    if (body.companyId !== undefined) {
      const hasAccess = await hasCompanyAccess(body.companyId, auth.userId);
      if (!hasAccess) {
        return errorResponse("FORBIDDEN", "Not a member of this company");
      }
    }
    
    if (auth.role !== "admin" && body.role) {
      delete (body as { role?: string }).role;
    }
    return usersService.updateUser(params.id, body);
  });
});

// ============================================
// Delete User (Admin only)
// ============================================

router.delete("/api/v1/users/:id", async (request, _url, params) => {
  return withAdminAuth(request, async (auth) => {
    // Prevent admin from deleting themselves
    if (auth.userId === params.id) {
      return errorResponse("FORBIDDEN", "Cannot delete your own account");
    }
    return usersService.deleteUser(params.id);
  });
});

// ============================================
// Get Users by Company
// ============================================

router.get("/api/v1/users/company/:companyId", async (request, _url, params) => {
  return withAuth(request, async () => {
    return usersService.getUsersByCompany(params.companyId);
  });
});

// ============================================
// Get Users by Role
// ============================================

router.get("/api/v1/users/role/:role", async (request, _url, params) => {
  return withAuth(request, async () => {
    return usersService.getUsersByRole(params.role as UserRole);
  });
});

export const userRoutes = router.getRoutes();
