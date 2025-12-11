import type { ApiResponse, User } from "@crm/types";
import { errorResponse, successResponse } from "@crm/utils";
import { logger } from "../lib/logger";
import { verifyAndGetUser } from "../middleware/auth";
import type { RateLimitResult } from "../middleware/rate-limit";
import {
  checkRateLimitByIp,
  RATE_LIMITS,
  rateLimitExceededResponse,
} from "../middleware/rate-limit";
import { auditService, getClientIp, getUserAgent } from "../services/audit.service";
import type { LoginResult } from "../services/auth.service";
import { authService } from "../services/auth.service";

// ============================================
// Response Helper
// ============================================

function json<T>(data: T, status = 200, headers: Record<string, string | string[]> = {}): Response {
  const responseHeaders = new Headers({ "Content-Type": "application/json" });
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const v of value) responseHeaders.append(key, v);
    } else {
      responseHeaders.set(key, value);
    }
  }
  return new Response(JSON.stringify(data), {
    status,
    headers: responseHeaders,
  });
}

async function parseBody<T = Record<string, unknown>>(request: Request): Promise<T | null> {
  try {
    const data = await request.json();
    return data as T;
  } catch {
    return null;
  }
}

// ============================================
// Cookie Helpers
// ============================================

// Helper to get environment at runtime (prevents bundler inlining)
// Uses Bun.env which is not statically analyzable
function getNodeEnv(): string {
  const env: Record<string, string | undefined> =
    typeof process !== "undefined" && process.env ? process.env : {};
  return String(env.NODE_ENV || "development");
}

// Get cookie domain from env or derive from host
function getCookieDomain(): string {
  const env: Record<string, string | undefined> =
    typeof process !== "undefined" && process.env ? process.env : {};
  // Allow explicit domain configuration, or use shared domain for OpenShift
  return env.COOKIE_DOMAIN || "";
}

function setAuthCookies(
  request: Request,
  accessToken: string,
  refreshToken: string,
  sessionId: string
): Record<string, string | string[]> {
  const _isProduction = getNodeEnv() === "production";
  const forwardedProto = (request.headers.get("X-Forwarded-Proto") || "").toLowerCase();
  const reqUrl = new URL(request.url);
  const originHeader = request.headers.get("Origin") || "";
  let isCrossSite = false;
  try {
    if (originHeader) {
      const originUrl = new URL(originHeader);
      isCrossSite = originUrl.origin !== reqUrl.origin;
    }
  } catch {}
  const isHttps = reqUrl.protocol === "https:" || forwardedProto === "https";
  const sameSite = isCrossSite ? "None" : "Lax";
  const secureAttr = isHttps ? "Secure; " : "";
  const cookieDomain = getCookieDomain();
  const domainAttr = cookieDomain ? `Domain=${cookieDomain}; ` : "";

  const accessCookie = `access_token=${accessToken}; HttpOnly; ${secureAttr}${domainAttr}SameSite=${sameSite}; Path=/; Max-Age=900`;
  const refreshCookie = `refresh_token=${refreshToken}; HttpOnly; ${secureAttr}${domainAttr}SameSite=${sameSite}; Path=/api/v1/auth; Max-Age=604800`;
  const sessionCookie = `session_id=${sessionId}; HttpOnly; ${secureAttr}${domainAttr}SameSite=${sameSite}; Path=/; Max-Age=604800`;

  return {
    "Set-Cookie": [accessCookie, refreshCookie, sessionCookie],
  };
}

function clearAuthCookies(request: Request): Record<string, string | string[]> {
  const forwardedProto = (request.headers.get("X-Forwarded-Proto") || "").toLowerCase();
  const reqUrl = new URL(request.url);
  const originHeader = request.headers.get("Origin") || "";
  let isCrossSite = false;
  try {
    if (originHeader) {
      const originUrl = new URL(originHeader);
      isCrossSite = originUrl.origin !== reqUrl.origin;
    }
  } catch {}
  const isHttps = reqUrl.protocol === "https:" || forwardedProto === "https";
  const sameSite = isCrossSite ? "None" : "Lax";
  const secureAttr = isHttps ? "Secure; " : "";
  const cookieDomain = getCookieDomain();
  const domainAttr = cookieDomain ? `Domain=${cookieDomain}; ` : "";

  const clearAccess = `access_token=; HttpOnly; ${secureAttr}${domainAttr}SameSite=${sameSite}; Path=/; Max-Age=0`;
  const clearRefresh = `refresh_token=; HttpOnly; ${secureAttr}${domainAttr}SameSite=${sameSite}; Path=/api/v1/auth; Max-Age=0`;
  const clearSession = `session_id=; HttpOnly; ${secureAttr}${domainAttr}SameSite=${sameSite}; Path=/; Max-Age=0`;

  return {
    "Set-Cookie": [clearAccess, clearRefresh, clearSession],
  };
}

function getRefreshTokenFromCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;

  for (const cookie of cookieHeader.split(";")) {
    const [name, ...rest] = cookie.trim().split("=");
    if (name === "refresh_token" && rest.length > 0) {
      return rest.join("=");
    }
  }
  return null;
}

// ============================================
// Auth Routes
// ============================================

/**
 * POST /api/v1/auth/login
 */
export async function loginHandler(request: Request, _url: URL): Promise<Response> {
  const envName = getNodeEnv();
  let rateLimitResult: RateLimitResult = {
    allowed: true,
    limit: RATE_LIMITS.login.requests,
    remaining: RATE_LIMITS.login.requests,
    resetIn: 0,
  };
  if (envName !== "test") {
    rateLimitResult = await checkRateLimitByIp(request, "auth:login", RATE_LIMITS.login);
  }

  if (!rateLimitResult.allowed) {
    // Log failed attempt due to rate limiting
    auditService.logAction({
      action: "LOGIN_FAILED",
      entityType: "session",
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      metadata: { reason: "rate_limited" },
    });
    return rateLimitExceededResponse(rateLimitResult);
  }

  const body = await parseBody<{ email: string; password: string }>(request);

  if (!body?.email || !body?.password) {
    return json(errorResponse("BAD_REQUEST", "Email and password are required"), 400);
  }

  let result: import("@crm/types").ApiResponse<LoginResult>;
  try {
    result = await authService.login(body.email, body.password);
  } catch (error) {
    // Log the actual error for debugging
    logger.error({ error, email: body.email }, "Error in loginHandler before authService.login");
    return json(errorResponse("SERVER_ERROR", "Login failed due to server error"), 500);
  }

  if (!result.success) {
    // Log failed login attempt
    auditService.logAction({
      action: "LOGIN_FAILED",
      entityType: "session",
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      metadata: { email: body.email, reason: result.error?.message },
    });

    return json(result, 401);
  }

  // Log successful login
  auditService.logAction({
    userId: result.data!.user.id,
    action: "LOGIN",
    entityType: "session",
    entityId: result.data!.sessionId,
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request),
  });

  // Set cookies and return response
  const cookies = setAuthCookies(
    request,
    result.data!.tokens.accessToken,
    result.data!.tokens.refreshToken,
    result.data!.sessionId
  );

  return json(
    successResponse({
      user: result.data!.user,
      expiresIn: result.data!.tokens.expiresIn,
    }),
    200,
    cookies
  );
}

/**
 * POST /api/v1/auth/logout
 */
export async function logoutHandler(request: Request, _url: URL): Promise<Response> {
  const auth = await verifyAndGetUser(request);

  if (auth) {
    // Logout from auth service
    await authService.logout(auth.sessionId, auth.userId);

    // Log logout
    auditService.logAction({
      userId: auth.userId,
      action: "LOGOUT",
      entityType: "session",
      entityId: auth.sessionId,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });
  }

  // Clear cookies regardless of auth status
  return json(successResponse({ success: true }), 200, clearAuthCookies(request));
}

/**
 * POST /api/v1/auth/refresh
 */
export async function refreshHandler(request: Request, _url: URL): Promise<Response> {
  // Rate limiting for refresh
  const rateLimitResult = await checkRateLimitByIp(request, "auth:refresh", RATE_LIMITS.refresh);

  if (!rateLimitResult.allowed) {
    return rateLimitExceededResponse(rateLimitResult);
  }

  // Get refresh token from body or cookie
  let refreshToken: string | null = null;

  const body = await parseBody<{ refreshToken?: string }>(request);
  if (body?.refreshToken) {
    refreshToken = body.refreshToken;
  } else {
    refreshToken = getRefreshTokenFromCookie(request);
  }

  if (!refreshToken) {
    return json(errorResponse("UNAUTHORIZED", "Refresh token required"), 401);
  }

  const result = await authService.refreshTokens(refreshToken);

  if (!result.success) {
    // Clear cookies on failed refresh
    return json(result, 401, clearAuthCookies());
  }

  // Log token refresh
  auditService.logAction({
    action: "TOKEN_REFRESH",
    entityType: "session",
    entityId: result.data!.sessionId,
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request),
  });

  // Set new cookies
  const cookies = setAuthCookies(
    request,
    result.data!.accessToken,
    result.data!.refreshToken,
    result.data!.sessionId
  );

  return json(
    successResponse({
      expiresIn: result.data!.expiresIn,
    }),
    200,
    cookies
  );
}

/**
 * GET /api/v1/auth/me
 */
export async function meHandler(request: Request, _url: URL): Promise<Response> {
  const auth = await verifyAndGetUser(request);

  if (!auth) {
    return json(errorResponse("UNAUTHORIZED", "Not authenticated"), 401);
  }

  const result: ApiResponse<User> = await authService.getCurrentUser(auth.userId);

  if (!result.success || !result.data) {
    const code = result.error?.code;
    if (code === "NOT_FOUND") {
      return json(result, 404);
    }
    if (code === "UNAUTHORIZED") {
      return json(result, 401);
    }
    if (code === "FORBIDDEN") {
      return json(result, 403);
    }
    if (code === "VALIDATION_ERROR") {
      return json(result, 400);
    }
    return json(result, 500);
  }

  // Map User to AuthUser format (only include fields that frontend expects)
  const userData = {
    id: result.data.id,
    firstName: result.data.firstName,
    lastName: result.data.lastName,
    email: result.data.email,
    role: result.data.role,
    companyId: result.data.companyId,
    avatarUrl: result.data.avatarUrl,
    // Multi-tenant support with frontend-compatible field names
    activeTenantId: auth.activeTenantId,
    tenantRoles: auth.tenantRoles.map((t) => ({
      id: t.tenantId,
      slug: t.tenantSlug,
      name: t.tenantName,
      logoUrl: t.tenantLogoUrl || null,
      role: t.role,
    })),
  };

  // Add active tenant details if available
  let activeTenant = null;
  if (auth.activeTenantId && auth.tenantRoles.length > 0) {
    const tenant = auth.tenantRoles.find((t) => t.tenantId === auth.activeTenantId);
    if (tenant) {
      activeTenant = {
        id: tenant.tenantId,
        slug: tenant.tenantSlug,
        name: tenant.tenantName,
        role: tenant.role,
        logoUrl: tenant.tenantLogoUrl || null,
      };
    }
  }

  // Add company information if user has an active company
  if (result.data.companyId) {
    try {
      const { getCompanyById } = await import("../db/queries/companies-members");
      const company = await getCompanyById(result.data.companyId);
      if (company) {
        // Return user with company info and tenant data
        return json({
          success: true,
          data: {
            ...userData,
            company,
            activeTenant,
          },
        });
      }
    } catch (error) {
      // If company fetch fails, just return user without company
      logger.error({ error, userId: auth.userId }, "Failed to fetch company in meHandler");
    }
  }

  // Return user without company but with tenant data
  return json({
    success: true,
    data: {
      ...userData,
      activeTenant,
    },
  });
}

/**
 * POST /api/v1/auth/switch-tenant
 */
export async function switchTenantHandler(request: Request, _url: URL): Promise<Response> {
  const auth = await verifyAndGetUser(request);

  if (!auth) {
    return json(errorResponse("UNAUTHORIZED", "Not authenticated"), 401);
  }

  const body = await parseBody<{ tenantId: string }>(request);

  if (!body?.tenantId) {
    return json(errorResponse("BAD_REQUEST", "tenantId is required"), 400);
  }

  try {
    const { sql } = await import("../db/client");

    // Verify user belongs to this tenant
    const userTenantRole = await sql`
      SELECT utr.role, t.name as tenant_name, t.slug as tenant_slug
      FROM user_tenant_roles utr
      JOIN tenants t ON utr.tenant_id = t.id
      WHERE utr.user_id = ${auth.userId}
        AND utr.tenant_id = ${body.tenantId}
        AND t.status = 'active'
      LIMIT 1
    `;

    if (userTenantRole.length === 0) {
      return json(errorResponse("FORBIDDEN", "You don't have access to this tenant"), 403);
    }

    // Update active tenant
    await sql`
      INSERT INTO user_active_tenant (user_id, active_tenant_id, updated_at)
      VALUES (${auth.userId}, ${body.tenantId}, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET active_tenant_id = ${body.tenantId}, updated_at = NOW()
    `;

    // Generate new tokens with updated tenant context using refresh token
    const refreshToken = getRefreshTokenFromCookie(request);
    if (!refreshToken) {
      return json(errorResponse("UNAUTHORIZED", "Refresh token required"), 401);
    }
    const result = await authService.refreshTokens(refreshToken);

    if (!result.success) {
      return json(errorResponse("SERVER_ERROR", "Failed to generate new tokens"), 500);
    }

    // Log settings update to reflect tenant switch
    auditService.logAction({
      userId: auth.userId,
      action: "UPDATE_SETTINGS",
      entityType: "settings",
      entityId: body.tenantId,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      metadata: { tenantName: userTenantRole[0].tenant_name },
    });

    // Set new cookies with updated tokens
    const cookies = setAuthCookies(
      request,
      result.data!.accessToken,
      result.data!.refreshToken,
      result.data!.sessionId
    );

    return json(
      successResponse({
        success: true,
        tenantId: body.tenantId,
        expiresIn: result.data!.expiresIn,
      }),
      200,
      cookies
    );
  } catch (error) {
    logger.error({ error, userId: auth.userId, tenantId: body.tenantId }, "Error switching tenant");
    return json(errorResponse("SERVER_ERROR", "Failed to switch tenant"), 500);
  }
}

/**
 * POST /api/v1/auth/change-password
 */
export async function changePasswordHandler(request: Request, _url: URL): Promise<Response> {
  const auth = await verifyAndGetUser(request);

  if (!auth) {
    return json(errorResponse("UNAUTHORIZED", "Not authenticated"), 401);
  }

  const body = await parseBody<{
    currentPassword: string;
    newPassword: string;
  }>(request);

  if (!body?.currentPassword || !body?.newPassword) {
    return json(
      errorResponse("BAD_REQUEST", "Current password and new password are required"),
      400
    );
  }

  const result = await authService.changePassword(
    auth.userId,
    body.currentPassword,
    body.newPassword
  );

  if (!result.success) {
    return json(result, result.error?.code === "UNAUTHORIZED" ? 401 : 400);
  }

  // Log password change
  auditService.logAction({
    userId: auth.userId,
    action: "PASSWORD_CHANGE",
    entityType: "user",
    entityId: auth.userId,
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request),
  });

  // Clear cookies to force re-login
  return json(result, 200, clearAuthCookies());
}
