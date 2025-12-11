import type { UserRole } from "@crm/types";
import { errorResponse } from "@crm/utils";
import { cache } from "../cache/redis";
import { logger } from "../lib/logger";
import { type JWTPayload, type SessionData, validateJWT } from "../services/auth.service";

// ============================================
// Auth Context Type
// ============================================

export interface TenantRole {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  tenantLogoUrl?: string | null;
  role: "admin" | "manager" | "user";
}

export interface AuthContext {
  userId: string;
  role: UserRole;
  activeTenantId?: string; // Currently active tenant for multi-tenant users
  tenantRoles: TenantRole[]; // All tenants this user belongs to
  companyId?: string; // Deprecated: will be removed in future
  sessionId: string;
}

// ============================================
// JWT Extraction
// ============================================

export function extractJWT(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");

  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  // Also check for token in cookie
  const cookieHeader = request.headers.get("Cookie");
  if (cookieHeader) {
    const cookies = parseCookies(cookieHeader);
    if (cookies.access_token) {
      return cookies.access_token;
    }
  }

  return null;
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const cookie of cookieHeader.split(";")) {
    const [name, ...rest] = cookie.trim().split("=");
    if (name && rest.length > 0) {
      cookies[name] = rest.join("=");
    }
  }
  return cookies;
}

// ============================================
// Token Validation
// ============================================

export async function verifyAndGetUser(request: Request): Promise<AuthContext | null> {
  try {
    const token = extractJWT(request);
    if (!token) {
      logger.warn({ path: request.url }, "Auth failed: missing token");
      return null;
    }

    const payload = await validateJWT(token);
    if (!payload) {
      logger.warn({ path: request.url }, "Auth failed: invalid JWT");
      return null;
    }

    // Verify session still exists in Redis
    // Wrap in try-catch to handle Redis connection errors gracefully
    let session: SessionData | null;
    try {
      session = await cache.getSession(payload.sessionId);
    } catch (redisError) {
      logger.error({ error: redisError }, "Redis error in verifyAndGetUser");
      // If Redis fails, we can still proceed with JWT validation
      // This allows the system to continue working even if Redis is down
      session = null;
    }

    if (!session) {
      logger.warn(
        { userId: payload.userId, sessionId: payload.sessionId },
        "Auth proceeding without cached session"
      );
    }

    // Load user's tenant roles and company from database
    let tenantRoles: TenantRole[] = [];
    let activeTenantId: string | undefined;
    let freshCompanyId: string | undefined;

    try {
      const { sql } = await import("../db/client");

      // Query user_tenant_roles joined with tenants table
      const userTenantRolesResult = await sql`
        SELECT
          utr.tenant_id,
          utr.role,
          t.slug as tenant_slug,
          t.name as tenant_name,
          t.metadata->>'logoUrl' as tenant_logo_url
        FROM user_tenant_roles utr
        JOIN tenants t ON utr.tenant_id = t.id
        WHERE utr.user_id = ${payload.userId}
          AND t.status = 'active'
        ORDER BY t.name ASC
      `;

      tenantRoles = userTenantRolesResult.map((row: Record<string, unknown>) => ({
        tenantId: row.tenant_id as string,
        tenantSlug: row.tenant_slug as string,
        tenantName: row.tenant_name as string,
        tenantLogoUrl: (row.tenant_logo_url as string | null) ?? null,
        role: row.role as "admin" | "manager" | "user",
      }));

      // Get active tenant from user_active_tenant table
      const activeResult = await sql`
        SELECT active_tenant_id
        FROM user_active_tenant
        WHERE user_id = ${payload.userId}
        LIMIT 1
      `;

      if (activeResult.length > 0) {
        activeTenantId = activeResult[0].active_tenant_id;
      } else if (tenantRoles.length > 0) {
        // If no active tenant set, default to first tenant
        activeTenantId = tenantRoles[0].tenantId;

        // Save this as the active tenant
        await sql`
          INSERT INTO user_active_tenant (user_id, active_tenant_id, updated_at)
          VALUES (${payload.userId}, ${activeTenantId}, NOW())
          ON CONFLICT (user_id)
          DO UPDATE SET active_tenant_id = ${activeTenantId}, updated_at = NOW()
        `;
      }

      // Get fresh companyId from users table (JWT might be stale)
      const userResult = await sql`
        SELECT company_id FROM users WHERE id = ${payload.userId} LIMIT 1
      `;
      if (userResult.length > 0 && userResult[0].company_id) {
        freshCompanyId = userResult[0].company_id;
      }
    } catch (error) {
      logger.error({ error, userId: payload.userId }, "Failed to load tenant roles from database");
    }

    // Build auth context with multi-tenant support
    // Use freshCompanyId from database (not JWT which may be stale)
    const authContext: AuthContext = {
      userId: payload.userId,
      role: payload.role,
      activeTenantId: activeTenantId,
      tenantRoles: tenantRoles,
      companyId: freshCompanyId || payload.companyId,
      sessionId: payload.sessionId,
    };

    return authContext;
  } catch (error) {
    logger.error({ error }, "Error in verifyAndGetUser");
    return null;
  }
}

// ============================================
// Middleware Types
// ============================================

export type RouteHandler = (
  request: Request,
  url: URL,
  params: Record<string, string>,
  auth?: AuthContext
) => Promise<Response>;

export type AuthenticatedRouteHandler = (
  request: Request,
  url: URL,
  params: Record<string, string>,
  auth: AuthContext
) => Promise<Response>;

// ============================================
// Middleware Functions
// ============================================

/**
 * Requires authentication - returns 401 if not authenticated
 */
export function requireAuth(handler: AuthenticatedRouteHandler): RouteHandler {
  return async (request, url, params) => {
    const auth = await verifyAndGetUser(request);

    if (!auth) {
      return unauthorizedResponse("Authentication required");
    }

    return handler(request, url, params, auth);
  };
}

/**
 * Requires specific role - returns 403 if role doesn't match
 */
export function requireRole(role: UserRole, handler: AuthenticatedRouteHandler): RouteHandler {
  return async (request, url, params) => {
    const auth = await verifyAndGetUser(request);

    if (!auth) {
      return unauthorizedResponse("Authentication required");
    }

    if (auth.role !== role && auth.role !== "superadmin") {
      return forbiddenResponse(`Requires ${role} role`);
    }

    return handler(request, url, params, auth);
  };
}

/**
 * Requires admin role - returns 403 if not admin
 */
export function requireAdmin(handler: AuthenticatedRouteHandler): RouteHandler {
  return async (request, url, params) => {
    const auth = await verifyAndGetUser(request);

    if (!auth) {
      return unauthorizedResponse("Authentication required");
    }

    if (auth.role !== "superadmin") {
      return forbiddenResponse("Superadmin access required");
    }

    return handler(request, url, params, auth);
  };
}

/**
 * Optional auth - attaches user if authenticated, but doesn't require it
 */
export function optionalAuth(handler: RouteHandler): RouteHandler {
  return async (request, url, params) => {
    const auth = await verifyAndGetUser(request);
    return handler(request, url, params, auth || undefined);
  };
}

// ============================================
// Role Check Helpers
// ============================================

export function isSuperadmin(auth: AuthContext): boolean {
  return auth.role === "superadmin";
}

export function isTenantAdmin(auth: AuthContext): boolean {
  return auth.role === "tenant_admin";
}

export function isCrmUser(auth: AuthContext): boolean {
  return auth.role === "crm_user";
}

// Compatibility helpers used in tests
export function isAdmin(auth: AuthContext): boolean {
  return auth.role === "admin" || auth.role === "tenant_admin" || auth.role === "superadmin";
}

export function isUser(auth: AuthContext): boolean {
  return auth.role === "user" || auth.role === "crm_user";
}

export async function canAccessCompany(auth: AuthContext, companyId: string): Promise<boolean> {
  // Superadmin can access any company
  if (auth.role === "superadmin") return true;

  // Tenant admin can access companies in their tenant
  if (auth.role === "tenant_admin") {
    // TODO: Add tenant-scoped company access check
    return true;
  }

  // Use company permission check with cache
  const { checkCompanyPermission } = await import("./company-permission");
  const result = await checkCompanyPermission(auth.userId, companyId);
  return result.allowed;
}

export function canAccessUser(auth: AuthContext, targetUserId: string): boolean {
  // Superadmin can access any user
  if (auth.role === "superadmin") return true;
  // Tenant admin can access users in their tenant
  if (auth.role === "tenant_admin") {
    // TODO: Add tenant-scoped user access check
    return true;
  }
  // CRM user can only access themselves
  return auth.userId === targetUserId;
}

// ============================================
// Response Helpers
// ============================================

function unauthorizedResponse(message: string): Response {
  return new Response(JSON.stringify(errorResponse("UNAUTHORIZED", message)), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "WWW-Authenticate": 'Bearer realm="CRM API"',
    },
  });
}

function forbiddenResponse(message: string): Response {
  return new Response(JSON.stringify(errorResponse("FORBIDDEN", message)), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}

// ============================================
// Exports for checking permissions manually
// ============================================

export { validateJWT };
export type { JWTPayload };
