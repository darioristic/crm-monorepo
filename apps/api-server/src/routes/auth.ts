import { successResponse, errorResponse } from "@crm/utils";
import { authService } from "../services/auth.service";
import {
	auditService,
	getClientIp,
	getUserAgent,
} from "../services/audit.service";
import { verifyAndGetUser, type AuthContext } from "../middleware/auth";
import {
	checkRateLimitByIp,
	RATE_LIMITS,
	rateLimitExceededResponse,
} from "../middleware/rate-limit";

// ============================================
// Response Helper
// ============================================

function json<T>(
	data: T,
	status = 200,
	headers: Record<string, string> = {},
): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json", ...headers },
	});
}

async function parseBody<T = Record<string, unknown>>(
	request: Request,
): Promise<T | null> {
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
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const env = (globalThis as any).Bun?.env || process.env;
	return String(env.NODE_ENV || "development");
}

function setAuthCookies(
	accessToken: string,
	refreshToken: string,
	sessionId: string,
): Record<string, string> {
	const isProduction = getNodeEnv() === "production";
	// Use SameSite=None for cross-origin requests (frontend/backend on different subdomains)
	const sameSite = isProduction ? "None" : "Lax";
	const secure = isProduction ? "Secure; " : "";

	// Access token - 15 minutes
	const accessCookie = `access_token=${accessToken}; HttpOnly; ${secure}SameSite=${sameSite}; Path=/; Max-Age=900`;

	// Refresh token - 7 days
	const refreshCookie = `refresh_token=${refreshToken}; HttpOnly; ${secure}SameSite=${sameSite}; Path=/api/v1/auth/refresh; Max-Age=604800`;

	// Session ID - 7 days
	const sessionCookie = `session_id=${sessionId}; HttpOnly; ${secure}SameSite=${sameSite}; Path=/; Max-Age=604800`;

	return {
		"Set-Cookie": [accessCookie, refreshCookie, sessionCookie].join(", "),
	};
}

function clearAuthCookies(): Record<string, string> {
	const isProduction = getNodeEnv() === "production";
	const sameSite = isProduction ? "None" : "Lax";
	const secure = isProduction ? "Secure; " : "";

	const clearAccess = `access_token=; HttpOnly; ${secure}SameSite=${sameSite}; Path=/; Max-Age=0`;
	const clearRefresh = `refresh_token=; HttpOnly; ${secure}SameSite=${sameSite}; Path=/api/v1/auth/refresh; Max-Age=0`;
	const clearSession = `session_id=; HttpOnly; ${secure}SameSite=${sameSite}; Path=/; Max-Age=0`;

	return {
		"Set-Cookie": [clearAccess, clearRefresh, clearSession].join(", "),
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
export async function loginHandler(
	request: Request,
	url: URL,
): Promise<Response> {
	// Rate limiting - strict for login
	const rateLimitResult = await checkRateLimitByIp(
		request,
		"auth:login",
		RATE_LIMITS.login,
	);

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
		return json(
			errorResponse("BAD_REQUEST", "Email and password are required"),
			400,
		);
	}

	const result = await authService.login(body.email, body.password);

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
		result.data!.tokens.accessToken,
		result.data!.tokens.refreshToken,
		result.data!.sessionId,
	);

	return json(
		successResponse({
			user: result.data!.user,
			expiresIn: result.data!.tokens.expiresIn,
		}),
		200,
		cookies,
	);
}

/**
 * POST /api/v1/auth/logout
 */
export async function logoutHandler(
	request: Request,
	url: URL,
): Promise<Response> {
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
	return json(successResponse({ success: true }), 200, clearAuthCookies());
}

/**
 * POST /api/v1/auth/refresh
 */
export async function refreshHandler(
	request: Request,
	url: URL,
): Promise<Response> {
	// Rate limiting for refresh
	const rateLimitResult = await checkRateLimitByIp(
		request,
		"auth:refresh",
		RATE_LIMITS.refresh,
	);

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
		result.data!.accessToken,
		result.data!.refreshToken,
		result.data!.sessionId,
	);

	return json(
		successResponse({
			expiresIn: result.data!.expiresIn,
		}),
		200,
		cookies,
	);
}

/**
 * GET /api/v1/auth/me
 */
export async function meHandler(request: Request, url: URL): Promise<Response> {
	const auth = await verifyAndGetUser(request);

	if (!auth) {
		return json(errorResponse("UNAUTHORIZED", "Not authenticated"), 401);
	}

	const result = await authService.getCurrentUser(auth.userId);

	if (!result.success) {
		return json(result, 404);
	}

	return json(result);
}

/**
 * POST /api/v1/auth/change-password
 */
export async function changePasswordHandler(
	request: Request,
	url: URL,
): Promise<Response> {
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
			errorResponse(
				"BAD_REQUEST",
				"Current password and new password are required",
			),
			400,
		);
	}

	const result = await authService.changePassword(
		auth.userId,
		body.currentPassword,
		body.newPassword,
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
