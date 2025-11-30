/**
 * User Routes
 */

import { errorResponse } from "@crm/utils";
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
// Update User
// ============================================

router.put("/api/v1/users/:id", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    // Users can only update themselves unless they're admin
    if (auth.userId !== params.id && auth.role !== "admin") {
      return errorResponse("FORBIDDEN", "Cannot update other users");
    }
    const body = await parseBody<UpdateUserRequest>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
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
    const body = await parseBody<UpdateUserRequest>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
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
