import type { UserRole } from "@crm/types";
import { errorResponse } from "@crm/utils";
import { validateJWT, type JWTPayload } from "../services/auth.service";
import { cache } from "../cache/redis";

// ============================================
// Auth Context Type
// ============================================

export interface AuthContext {
	userId: string;
	role: UserRole;
	companyId?: string;
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
	const token = extractJWT(request);
	if (!token) {
		return null;
	}

	const payload = await validateJWT(token);
	if (!payload) {
		return null;
	}

	// Verify session still exists in Redis
	const session = await cache.getSession(payload.sessionId);
	if (!session) {
		return null;
	}

	return {
		userId: payload.userId,
		role: payload.role,
		companyId: payload.companyId,
		sessionId: payload.sessionId,
	};
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
export function requireAuth(
	handler: AuthenticatedRouteHandler,
): RouteHandler {
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

		if (auth.role !== role && auth.role !== "admin") {
			return forbiddenResponse(`Requires ${role} role`);
		}

		return handler(request, url, params, auth);
	};
}

/**
 * Requires admin role - returns 403 if not admin
 */
export function requireAdmin(
	handler: AuthenticatedRouteHandler,
): RouteHandler {
	return async (request, url, params) => {
		const auth = await verifyAndGetUser(request);

		if (!auth) {
			return unauthorizedResponse("Authentication required");
		}

		if (auth.role !== "admin") {
			return forbiddenResponse("Admin access required");
		}

		return handler(request, url, params, auth);
	};
}

/**
 * Optional auth - attaches user if authenticated, but doesn't require it
 */
export function optionalAuth(
	handler: RouteHandler,
): RouteHandler {
	return async (request, url, params) => {
		const auth = await verifyAndGetUser(request);
		return handler(request, url, params, auth || undefined);
	};
}

// ============================================
// Role Check Helpers
// ============================================

export function isAdmin(auth: AuthContext): boolean {
	return auth.role === "admin";
}

export function isUser(auth: AuthContext): boolean {
	return auth.role === "user";
}

export async function canAccessCompany(
	auth: AuthContext,
	companyId: string,
): Promise<boolean> {
	// Admin can access any company
	if (auth.role === "admin") return true;
	
	// Use company permission check with cache
	const { checkCompanyPermission } = await import("./company-permission");
	const result = await checkCompanyPermission(auth.userId, companyId);
	return result.allowed;
}

export function canAccessUser(
	auth: AuthContext,
	targetUserId: string,
): boolean {
	// Admin can access any user
	if (auth.role === "admin") return true;
	// User can only access themselves
	return auth.userId === targetUserId;
}

// ============================================
// Response Helpers
// ============================================

function unauthorizedResponse(message: string): Response {
	return new Response(
		JSON.stringify(errorResponse("UNAUTHORIZED", message)),
		{
			status: 401,
			headers: {
				"Content-Type": "application/json",
				"WWW-Authenticate": 'Bearer realm="CRM API"',
			},
		},
	);
}

function forbiddenResponse(message: string): Response {
	return new Response(
		JSON.stringify(errorResponse("FORBIDDEN", message)),
		{
			status: 403,
			headers: { "Content-Type": "application/json" },
		},
	);
}

// ============================================
// Exports for checking permissions manually
// ============================================

export { validateJWT };
export type { JWTPayload };

