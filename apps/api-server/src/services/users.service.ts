import type {
  ApiResponse,
  CreateUserRequest,
  FilterParams,
  PaginationParams,
  UpdateUserRequest,
  User,
  UserRole,
  UserWithCompany,
} from "@crm/types";
import {
  Errors,
  errorResponse,
  generateUUID,
  isEmpty,
  isValidEmail,
  now,
  paginatedResponse,
  successResponse,
} from "@crm/utils";
import { cache } from "../cache/redis";
import { companyQueries } from "../db/queries/companies";
import { userQueries } from "../db/queries/users";
import { serviceLogger } from "../lib/logger";

const CACHE_TTL = 300; // 5 minutes
const CACHE_PREFIX = "users";

class UsersService {
  // ============================================
  // List Users
  // ============================================

  async getUsers(
    pagination: PaginationParams,
    filters: FilterParams
  ): Promise<ApiResponse<UserWithCompany[]>> {
    try {
      const cacheKey = `${CACHE_PREFIX}:list:${JSON.stringify({ pagination, filters })}`;
      const cached = await cache.get<{ data: UserWithCompany[]; total: number }>(cacheKey);

      if (cached) {
        return paginatedResponse(cached.data, cached.total, pagination);
      }

      const { data, total } = await userQueries.findAll(pagination, filters);
      await cache.set(cacheKey, { data, total }, CACHE_TTL);

      return paginatedResponse(data, total, pagination);
    } catch (error) {
      serviceLogger.error(error, "Error fetching users:");
      return errorResponse("DATABASE_ERROR", "Failed to fetch users");
    }
  }

  // ============================================
  // Get Single User
  // ============================================

  async getUserById(id: string): Promise<ApiResponse<UserWithCompany>> {
    try {
      const cacheKey = `${CACHE_PREFIX}:${id}`;
      const cached = await cache.get<UserWithCompany>(cacheKey);

      if (cached) {
        return successResponse(cached);
      }

      const user = await userQueries.findById(id);

      if (!user) {
        return Errors.NotFound("User").toResponse();
      }

      await cache.set(cacheKey, user, CACHE_TTL);
      return successResponse(user);
    } catch (error) {
      serviceLogger.error(error, "Error fetching user:");
      return errorResponse("DATABASE_ERROR", "Failed to fetch user");
    }
  }

  // ============================================
  // Create User
  // ============================================

  async createUser(data: CreateUserRequest): Promise<ApiResponse<User>> {
    try {
      // Validation
      const validationError = await this.validateUserData(data);
      if (validationError) {
        return errorResponse("VALIDATION_ERROR", validationError);
      }

      // Check for duplicate email
      const existingEmail = await userQueries.emailExists(data.email);
      if (existingEmail) {
        return errorResponse("CONFLICT", `User with email "${data.email}" already exists`);
      }

      // Validate company exists if provided
      if (data.companyId) {
        const company = await companyQueries.findById(data.companyId);
        if (!company) {
          return errorResponse("VALIDATION_ERROR", "Invalid company ID - company not found");
        }
      }

      const user: User = {
        id: generateUUID(),
        createdAt: now(),
        updatedAt: now(),
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email.toLowerCase().trim(),
        role: data.role || "user",
        companyId: data.companyId,
        status: "active",
        avatarUrl: data.avatarUrl,
        phone: data.phone,
      };

      const created = await userQueries.createWithId(user);

      // Invalidate list cache
      await cache.invalidatePattern(`${CACHE_PREFIX}:list:*`);

      return successResponse(created);
    } catch (error) {
      serviceLogger.error(error, "Error creating user:");
      return errorResponse("DATABASE_ERROR", "Failed to create user");
    }
  }

  // ============================================
  // Update User
  // ============================================

  async updateUser(id: string, data: UpdateUserRequest): Promise<ApiResponse<User>> {
    try {
      // Check if user exists
      const existing = await userQueries.findById(id);
      if (!existing) {
        return Errors.NotFound("User").toResponse();
      }

      // Validate email if changing
      if (data.email !== undefined) {
        if (isEmpty(data.email)) {
          return errorResponse("VALIDATION_ERROR", "Email cannot be empty");
        }
        if (!isValidEmail(data.email)) {
          return errorResponse("VALIDATION_ERROR", "Invalid email format");
        }
        // Check for duplicate email
        const emailExists = await userQueries.emailExists(data.email, id);
        if (emailExists) {
          return errorResponse("CONFLICT", `User with email "${data.email}" already exists`);
        }
      }

      // Validate company if changing
      if (data.companyId !== undefined && data.companyId !== null && data.companyId !== "") {
        const company = await companyQueries.findById(data.companyId);
        if (!company) {
          serviceLogger.warn({ companyId: data.companyId }, "Company not found");
          return errorResponse("VALIDATION_ERROR", "Invalid company ID - company not found");
        }
      }

      // Validate role if changing
      if (data.role !== undefined && !["admin", "user"].includes(data.role)) {
        return errorResponse("VALIDATION_ERROR", "Role must be 'admin' or 'user'");
      }

      const updateData: Partial<User> = {};
      if (data.firstName !== undefined) updateData.firstName = data.firstName.trim();
      if (data.lastName !== undefined) updateData.lastName = data.lastName.trim();
      if (data.email !== undefined) updateData.email = data.email.toLowerCase().trim();
      if (data.role !== undefined) updateData.role = data.role;
      if (data.companyId !== undefined) {
        // Explicitly set companyId - use null if empty string, otherwise use the value
        updateData.companyId = data.companyId === "" ? undefined : data.companyId;
      }
      if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
      if (data.phone !== undefined) updateData.phone = data.phone;

      const updated = await userQueries.update(id, updateData);

      // Invalidate caches
      await cache.del(`${CACHE_PREFIX}:${id}`);
      await cache.invalidatePattern(`${CACHE_PREFIX}:list:*`);

      // If companyId was updated, also invalidate company-related caches
      if (data.companyId !== undefined) {
        await cache.del(`user:${id}:company`);
        // Invalidate company cache if companyId changed
        if (data.companyId) {
          await cache.del(`${CACHE_PREFIX}:company:${data.companyId}`);
        }
      }

      return successResponse(updated);
    } catch (error) {
      serviceLogger.error(error, "Error updating user");
      return errorResponse(
        "DATABASE_ERROR",
        `Failed to update user: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  // ============================================
  // Delete User
  // ============================================

  async deleteUser(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
    try {
      const existing = await userQueries.findById(id);
      if (!existing) {
        return Errors.NotFound("User").toResponse();
      }

      await userQueries.delete(id);

      // Invalidate caches
      await cache.del(`${CACHE_PREFIX}:${id}`);
      await cache.invalidatePattern(`${CACHE_PREFIX}:list:*`);

      return successResponse({ deleted: true });
    } catch (error) {
      serviceLogger.error(error, "Error deleting user:");
      return errorResponse("DATABASE_ERROR", "Failed to delete user");
    }
  }

  // ============================================
  // Get Users by Company
  // ============================================

  async getUsersByCompany(companyId: string): Promise<ApiResponse<User[]>> {
    try {
      const cacheKey = `${CACHE_PREFIX}:company:${companyId}`;
      const cached = await cache.get<User[]>(cacheKey);

      if (cached) {
        return successResponse(cached);
      }

      const users = await userQueries.findByCompany(companyId);
      await cache.set(cacheKey, users, CACHE_TTL);

      return successResponse(users);
    } catch (error) {
      serviceLogger.error(error, "Error fetching users by company:");
      return errorResponse("DATABASE_ERROR", "Failed to fetch users");
    }
  }

  // ============================================
  // Get Users by Role
  // ============================================

  async getUsersByRole(role: UserRole): Promise<ApiResponse<User[]>> {
    try {
      const cacheKey = `${CACHE_PREFIX}:role:${role}`;
      const cached = await cache.get<User[]>(cacheKey);

      if (cached) {
        return successResponse(cached);
      }

      const users = await userQueries.findByRole(role);
      await cache.set(cacheKey, users, CACHE_TTL);

      return successResponse(users);
    } catch (error) {
      serviceLogger.error(error, "Error fetching users by role:");
      return errorResponse("DATABASE_ERROR", "Failed to fetch users");
    }
  }

  // ============================================
  // Get User by Email
  // ============================================

  async getUserByEmail(email: string): Promise<ApiResponse<UserWithCompany>> {
    try {
      const user = await userQueries.findByEmail(email.toLowerCase().trim());

      if (!user) {
        return Errors.NotFound("User").toResponse();
      }

      return successResponse(user);
    } catch (error) {
      serviceLogger.error(error, "Error fetching user by email:");
      return errorResponse("DATABASE_ERROR", "Failed to fetch user");
    }
  }

  // ============================================
  // Validation Helper
  // ============================================

  private async validateUserData(data: CreateUserRequest): Promise<string | null> {
    if (!data.firstName || isEmpty(data.firstName)) {
      return "First name is required";
    }
    if (!data.lastName || isEmpty(data.lastName)) {
      return "Last name is required";
    }
    if (!data.email || isEmpty(data.email)) {
      return "Email is required";
    }
    if (!isValidEmail(data.email)) {
      return "Invalid email format";
    }
    if (data.role && !["admin", "user"].includes(data.role)) {
      return "Role must be 'admin' or 'user'";
    }
    return null;
  }
}

export const usersService = new UsersService();
