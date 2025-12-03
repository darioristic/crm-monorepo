import type { UserRole } from "@crm/types";
import { errorResponse } from "@crm/utils";
import { validateJWT, type JWTPayload } from "../services/auth.service";
import { cache } from "../cache/redis";
import { logger } from "../lib/logger";

// ============================================
// Auth Context Type
// ============================================

export interface AuthContext {
	userId: string;
	role: UserRole;
	tenantId?: string; // null for superadmin, required for tenant_admin and crm_user
	companyId?: string; // optional for crm_user, null for others
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

export async function verifyAndGetUser(
	request: Request,
): Promise<AuthContext | null> {
	try {
		const token = extractJWT(request);
		if (!token) {
			return null;
		}

		const payload = await validateJWT(token);
		if (!payload) {
			return null;
		}

		// Verify session still exists in Redis
		// Wrap in try-catch to handle Redis connection errors gracefully
		let session;
		try {
			session = await cache.getSession(payload.sessionId);
		} catch (redisError) {
			logger.error({ error: redisError }, "Redis error in verifyAndGetUser");
			// If Redis fails, we can still proceed with JWT validation
			// This allows the system to continue working even if Redis is down
			session = null;
		}

		if (!session) {
			return null;
		}

		// Return auth context with tenantId and companyId from payload
		// These may be undefined for old tokens, which is OK
		return {
			userId: payload.userId,
			role: payload.role,
			tenantId: payload.tenantId,
			companyId: payload.companyId,
			sessionId: payload.sessionId,
		};
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
	auth?: AuthContext,
) => Promise<Response>;

export type AuthenticatedRouteHandler = (
	request: Request,
	url: URL,
	params: Record<string, string>,
	auth: AuthContext,
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
export function requireRole(
	role: UserRole,
	handler: AuthenticatedRouteHandler,
): RouteHandler {
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

export async function canAccessCompany(
	auth: AuthContext,
	companyId: string,
): Promise<boolean> {
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

export function canAccessUser(
	auth: AuthContext,
	targetUserId: string,
): boolean {
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
