/**
 * User Routes
 */

import type { CreateUserRequest, UpdateUserRequest, UserRole } from "@crm/types";
import { errorResponse, successResponse } from "@crm/utils";
import { cache } from "../cache/redis";
import { sql } from "../db/client";
import { hasCompanyAccess } from "../db/queries/companies-members";
import { userQueries } from "../db/queries/users";
import { logger } from "../lib/logger";
import type { SessionData } from "../services/auth.service";
import { authService, generateJWT } from "../services/auth.service";
import { usersService } from "../services/users.service";
import {
  json,
  parseBody,
  parseFilters,
  parsePagination,
  RouteBuilder,
  withAdminAuth,
  withAuth,
} from "./helpers";

// Import cookie helper from auth routes
function getNodeEnv(): string {
  const bunObj = (globalThis as Record<string, unknown>).Bun as
    | { env?: Record<string, string> }
    | undefined;
  const env = bunObj?.env || process.env;
  return String(env?.NODE_ENV || "development");
}

function getCookieDomain(): string {
  const bunObj = (globalThis as Record<string, unknown>).Bun as
    | { env?: Record<string, string> }
    | undefined;
  const env = bunObj?.env || process.env;
  return (env && (env as Record<string, string>).COOKIE_DOMAIN) || "";
}

function setAccessTokenCookie(accessToken: string): Record<string, string> {
  const isProduction = getNodeEnv() === "production";
  const sameSite = isProduction ? "None" : "Lax";
  const secure = isProduction ? "Secure; " : "";
  const cookieDomain = getCookieDomain();
  const domainAttr = cookieDomain ? `Domain=${cookieDomain}; ` : "";
  const accessCookie = `access_token=${accessToken}; HttpOnly; ${secure}${domainAttr}SameSite=${sameSite}; Path=/; Max-Age=900`;
  return { "Set-Cookie": accessCookie };
}

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

router.get("/api/v1/users/by-email", async (request, url) => {
  return withAuth(request, async (auth) => {
    if (auth.role !== "tenant_admin" && auth.role !== "superadmin") {
      return errorResponse("FORBIDDEN", "Requires admin role");
    }
    const email = url.searchParams.get("email");
    if (!email) {
      return errorResponse("VALIDATION_ERROR", "Email is required");
    }
    const user = await userQueries.findByEmail(email.toLowerCase().trim());
    if (!user) {
      return errorResponse("NOT_FOUND", "User not found");
    }
    return successResponse(user);
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
  logger.info("PUT /api/v1/users/me - Company switch request received");
  return withAuth(request, async (auth) => {
    try {
      const body = await parseBody<{ companyId?: string }>(request);
      logger.debug({ body }, "Request body");
      logger.debug({ userId: auth.userId, role: auth.role }, "Auth user");

      if (!body) {
        logger.error("Invalid request body");
        return errorResponse("VALIDATION_ERROR", "Invalid request body");
      }

      // If companyId is being updated, verify user has access to that company
      // Admin can switch to any company (for testing/admin purposes, similar to midday team switching)
      if (body.companyId !== undefined && body.companyId !== null && body.companyId !== "") {
        logger.debug({ companyId: body.companyId }, "CompanyId provided");

        if (auth.role === "tenant_admin" || auth.role === "superadmin") {
          // Admin can switch to any company - verify it exists AND is a seller company
          logger.debug("Admin user - verifying company exists and is seller");
          const companyExists = await sql`
            SELECT id, company_type FROM companies WHERE id = ${body.companyId}
          `;
          if (companyExists.length === 0) {
            logger.error({ companyId: body.companyId }, "Company not found");
            return errorResponse("NOT_FOUND", "Company not found");
          }
          // Prevent switching to customer companies - only allow seller companies
          if (companyExists[0].company_type === "customer") {
            logger.error(
              { companyId: body.companyId, companyType: companyExists[0].company_type },
              "Cannot switch to customer company"
            );
            return errorResponse(
              "FORBIDDEN",
              "Cannot switch to customer company. Only seller companies are allowed as active context."
            );
          }
          logger.debug("Company exists and is a seller");
        } else {
          // Regular users can only switch to companies they're members of
          logger.debug("Regular user - checking company access");
          const hasAccess = await hasCompanyAccess(body.companyId, auth.userId);
          if (!hasAccess) {
            logger.error(
              { companyId: body.companyId, userId: auth.userId },
              "User does not have access to company"
            );
            return errorResponse("FORBIDDEN", "Not a member of this company");
          }
          logger.debug("User has access to company");
        }

        // Update user's current company using service for proper error handling
        logger.debug("Updating user company");
        const result = await usersService.updateUser(auth.userId, {
          companyId: body.companyId,
        });

        if (!result.success) {
          logger.error({ error: result.error }, "Failed to update user company");
          // Ensure we return a non-empty error object
          if (
            !result.error ||
            (typeof result.error === "object" && Object.keys(result.error).length === 0)
          ) {
            return errorResponse("UPDATE_FAILED", "Failed to update user company");
          }
          return result;
        }

        logger.info(
          {
            userId: result.data?.id,
            companyId: result.data?.companyId,
          },
          "User company updated successfully"
        );

        // Invalidate additional caches that depend on companyId
        logger.debug("Invalidating company-dependent caches");
        try {
          // Invalidate documents cache for the user
          await cache.invalidatePattern(`documents:*:${auth.userId}*`);
          // Invalidate invoices cache
          await cache.invalidatePattern(`invoices:*:${body.companyId}*`);
          // Invalidate delivery notes cache
          await cache.invalidatePattern(`delivery_notes:*:${body.companyId}*`);
          // Invalidate orders cache
          await cache.invalidatePattern(`orders:*:${body.companyId}*`);
          // Invalidate quotes cache
          await cache.invalidatePattern(`quotes:*:${body.companyId}*`);
          logger.debug("Company-dependent caches invalidated");
        } catch (cacheError) {
          logger.error({ error: cacheError }, "Error invalidating caches");
          // Continue anyway - cache invalidation is not critical
        }

        // Update session in Redis with new companyId and ensure tenantId is set
        logger.debug("Updating session with new companyId and tenantId");
        try {
          const session = await cache.getSession<SessionData>(auth.sessionId);
          if (session) {
            session.companyId = body.companyId;
            // Ensure tenantId is present; if missing, derive from company or user
            if (!session.tenantId) {
              try {
                const tenantRows =
                  await sql`SELECT tenant_id FROM companies WHERE id = ${body.companyId} LIMIT 1`;
                const derivedTenantId = tenantRows[0]?.tenant_id as string | undefined;
                if (derivedTenantId) {
                  session.tenantId = derivedTenantId;
                } else {
                  const user = await userQueries.findById(auth.userId);
                  if (user?.tenantId) {
                    session.tenantId = user.tenantId;
                  }
                }
              } catch (deriveError) {
                logger.warn(
                  { error: deriveError },
                  "⚠️ Could not derive tenantId during session update"
                );
              }
            }
            const JWT_REFRESH_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds
            await cache.setSession(
              auth.sessionId,
              session as unknown as Record<string, unknown>,
              JWT_REFRESH_EXPIRY
            );
            logger.info("✅ Session updated in Redis");
          } else {
            logger.warn("⚠️ Session not found in Redis, continuing anyway");
          }
        } catch (error) {
          logger.error({ error }, "❌ Error updating session");
          // Continue anyway - token will still be generated
        }

        // Generate new JWT token with updated companyId
        logger.info("🔄 Generating new JWT token...");
        let newAccessToken: string;
        try {
          // Determine effective tenantId for the new token
          let effectiveTenantId = auth.activeTenantId;
          if (!effectiveTenantId) {
            try {
              const tenantRows =
                await sql`SELECT tenant_id FROM companies WHERE id = ${body.companyId} LIMIT 1`;
              effectiveTenantId =
                (tenantRows[0]?.tenant_id as string | undefined) ?? effectiveTenantId;
            } catch (deriveError) {
              logger.warn(
                { error: deriveError },
                "⚠️ Could not derive tenantId during session update"
              );
            }
            if (!effectiveTenantId) {
              const user = await userQueries.findById(auth.userId);
              effectiveTenantId = user?.tenantId;
            }
          }

          newAccessToken = await generateJWT(
            auth.userId,
            auth.role,
            effectiveTenantId,
            body.companyId,
            auth.sessionId
          );
          logger.info("✅ New JWT token generated");
        } catch (tokenError) {
          logger.error({ error: tokenError }, "❌ Error generating JWT token");
          return errorResponse(
            "TOKEN_GENERATION_FAILED",
            tokenError instanceof Error ? tokenError.message : "Failed to generate access token"
          );
        }

        // Set new access token as cookie
        const cookieHeaders = setAccessTokenCookie(newAccessToken);

        // Create ApiResponse with new token
        const apiResponse = successResponse({
          id: result.data?.id || auth.userId,
          companyId: result.data?.companyId || body.companyId,
          accessToken: newAccessToken,
        });

        // Create Response with cookie headers
        // withAuth will detect it's a Response and return it directly
        const response = json(apiResponse, 200);
        Object.entries(cookieHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });

        return response;
      }

      logger.error("❌ CompanyId not provided or empty");
      return errorResponse("VALIDATION_ERROR", "companyId is required");
    } catch (error) {
      logger.error({ error }, "❌ Error updating user company");
      if (error instanceof Error) {
        logger.error({ errorStack: error.stack }, "Error stack");
      }
      return errorResponse(
        "SERVER_ERROR",
        error instanceof Error ? error.message : "Failed to update user"
      );
    }
  });
});

// ============================================
// Seed: Create two account companies for current admin user
// ============================================

router.post("/api/v1/users/me/seed-admin-companies", async (request) => {
  return withAuth(
    request,
    async (auth) => {
      // Only admins can seed
      if (auth.role !== "tenant_admin" && auth.role !== "superadmin") {
        return errorResponse("FORBIDDEN", "Requires admin role");
      }

      const names = ["Admin Company A", "Admin Company B"];
      const created: string[] = [];
      for (const name of names) {
        const id = await (async () => {
          const { createCompany } = await import("../db/queries/companies-members");
          return createCompany({
            name,
            industry: "General",
            address: "N/A",
            userId: auth.userId,
            source: "account",
            switchCompany: false,
          });
        })();
        created.push(id);
      }

      return successResponse({ userId: auth.userId, companyIds: created });
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
    if (auth.userId !== params.id && auth.role !== "tenant_admin" && auth.role !== "superadmin") {
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
    if (auth.role !== "tenant_admin" && auth.role !== "superadmin" && body.role) {
      delete (body as { role?: string }).role;
    }
    return usersService.updateUser(params.id, body);
  });
});

router.put("/api/v1/users/:id/password", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    if (auth.role !== "tenant_admin" && auth.role !== "superadmin") {
      return errorResponse("FORBIDDEN", "Requires admin role");
    }
    const body = await parseBody<{ password: string }>(request);
    if (!body || !body.password) {
      return errorResponse("VALIDATION_ERROR", "Password is required");
    }
    const result = await authService.setPassword(params.id, body.password);
    if (!result.success) {
      return result;
    }
    return successResponse({ success: true });
  });
});

router.patch("/api/v1/users/:id", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    if (auth.userId !== params.id && auth.role !== "tenant_admin" && auth.role !== "superadmin") {
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

    if (auth.role !== "tenant_admin" && auth.role !== "superadmin" && body.role) {
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
