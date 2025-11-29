import { errorResponse } from "@crm/utils";
import { cache } from "../cache/redis";
import type { AuthContext } from "./auth";

// ============================================
// Rate Limit Configuration
// ============================================

export interface RateLimitConfig {
	requests: number;
	windowSeconds: number;
}

// Preset rate limit configurations
export const RATE_LIMITS = {
	// Default for general API endpoints
	default: { requests: 100, windowSeconds: 900 }, // 100 req / 15 min

	// Login endpoint - strict to prevent brute force
	login: { requests: 5, windowSeconds: 60 }, // 5 req / 1 min

	// Auth refresh - moderate
	refresh: { requests: 10, windowSeconds: 60 }, // 10 req / 1 min

	// Create/Edit operations
	write: { requests: 20, windowSeconds: 60 }, // 20 req / 1 min

	// Reports/Analytics - more expensive operations
	reports: { requests: 30, windowSeconds: 60 }, // 30 req / 1 min

	// Strict - for sensitive operations
	strict: { requests: 3, windowSeconds: 60 }, // 3 req / 1 min
} as const;

// ============================================
// Rate Limit Result
// ============================================

export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	resetIn: number;
	limit: number;
}

// ============================================
// Rate Limit Functions
// ============================================

/**
 * Check rate limit by IP address
 */
export async function checkRateLimitByIp(
	request: Request,
	route: string,
	config: RateLimitConfig = RATE_LIMITS.default,
): Promise<RateLimitResult> {
	const ip = getClientIp(request);
	const key = `ip:${ip}:${route}`;
	return checkRateLimit(key, config);
}

/**
 * Check rate limit by user ID
 */
export async function checkRateLimitByUser(
	userId: string,
	route: string,
	config: RateLimitConfig = RATE_LIMITS.default,
): Promise<RateLimitResult> {
	const key = `user:${userId}:${route}`;
	return checkRateLimit(key, config);
}

/**
 * Check rate limit by both IP and user (combined)
 */
export async function checkRateLimitCombined(
	request: Request,
	auth: AuthContext | undefined,
	route: string,
	config: RateLimitConfig = RATE_LIMITS.default,
): Promise<RateLimitResult> {
	const ip = getClientIp(request);

	// If authenticated, use user-based limiting (more generous)
	if (auth) {
		return checkRateLimitByUser(auth.userId, route, config);
	}

	// Otherwise use IP-based limiting
	return checkRateLimitByIp(request, route, config);
}

/**
 * Core rate limit check function
 */
async function checkRateLimit(
	identifier: string,
	config: RateLimitConfig,
): Promise<RateLimitResult> {
	const result = await cache.checkRateLimit(
		identifier,
		config.requests,
		config.windowSeconds,
	);

	return {
		allowed: result.allowed,
		remaining: result.remaining,
		resetIn: result.resetIn,
		limit: config.requests,
	};
}

// ============================================
// Rate Limit Headers
// ============================================

export function getRateLimitHeaders(
	result: RateLimitResult,
): Record<string, string> {
	return {
		"X-RateLimit-Limit": String(result.limit),
		"X-RateLimit-Remaining": String(result.remaining),
		"X-RateLimit-Reset": String(Math.ceil(Date.now() / 1000) + result.resetIn),
	};
}

// ============================================
// Rate Limit Response
// ============================================

export function rateLimitExceededResponse(
	result: RateLimitResult,
): Response {
	return new Response(
		JSON.stringify(
			errorResponse(
				"RATE_LIMITED",
				`Too many requests. Please try again in ${result.resetIn} seconds.`,
			),
		),
		{
			status: 429,
			headers: {
				"Content-Type": "application/json",
				"Retry-After": String(result.resetIn),
				...getRateLimitHeaders(result),
			},
		},
	);
}

// ============================================
// Middleware Types
// ============================================

type RouteHandler = (
	request: Request,
	url: URL,
	params: Record<string, string>,
	auth?: AuthContext,
) => Promise<Response>;

// ============================================
// Middleware Functions
// ============================================

/**
 * Rate limit middleware by IP
 */
export function withRateLimitByIp(
	config: RateLimitConfig,
	handler: RouteHandler,
): RouteHandler {
	return async (request, url, params, auth) => {
		const route = `${request.method}:${url.pathname}`;
		const result = await checkRateLimitByIp(request, route, config);

		if (!result.allowed) {
			return rateLimitExceededResponse(result);
		}

		const response = await handler(request, url, params, auth);

		// Add rate limit headers to response
		const headers = new Headers(response.headers);
		const rateLimitHeaders = getRateLimitHeaders(result);
		for (const [key, value] of Object.entries(rateLimitHeaders)) {
			headers.set(key, value);
		}

		return new Response(response.body, {
			status: response.status,
			headers,
		});
	};
}

/**
 * Rate limit middleware - uses user if authenticated, IP otherwise
 */
export function withRateLimit(
	config: RateLimitConfig,
	handler: RouteHandler,
): RouteHandler {
	return async (request, url, params, auth) => {
		const route = `${request.method}:${url.pathname}`;
		const result = await checkRateLimitCombined(request, auth, route, config);

		if (!result.allowed) {
			return rateLimitExceededResponse(result);
		}

		const response = await handler(request, url, params, auth);

		// Add rate limit headers to response
		const headers = new Headers(response.headers);
		const rateLimitHeaders = getRateLimitHeaders(result);
		for (const [key, value] of Object.entries(rateLimitHeaders)) {
			headers.set(key, value);
		}

		return new Response(response.body, {
			status: response.status,
			headers,
		});
	};
}

/**
 * Strict rate limit for login attempts
 */
export function withLoginRateLimit(handler: RouteHandler): RouteHandler {
	return withRateLimitByIp(RATE_LIMITS.login, handler);
}

/**
 * Rate limit for write operations
 */
export function withWriteRateLimit(handler: RouteHandler): RouteHandler {
	return withRateLimit(RATE_LIMITS.write, handler);
}

// ============================================
// Helper Functions
// ============================================

export function getClientIp(request: Request): string {
	return (
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
		request.headers.get("x-real-ip") ||
		request.headers.get("cf-connecting-ip") || // Cloudflare
		"unknown"
	);
}

