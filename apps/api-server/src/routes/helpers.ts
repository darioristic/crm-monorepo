/**
 * Route Helpers - zajedničke funkcije za sve route module
 */

import type { ApiResponse } from "@crm/types";
import { errorResponse } from "@crm/utils";
import { verifyAndGetUser, type AuthContext } from "../middleware/auth";
import { userQueries } from "../db/queries/users";
import { hasCompanyAccess } from "../db/queries/companies-members";

// ============================================
// Types
// ============================================

export type RouteHandler = (
	request: Request,
	url: URL,
	params: Record<string, string>,
) => Promise<Response>;

export interface Route {
	method: string;
	pattern: RegExp;
	handler: RouteHandler;
	params: string[];
}

// ============================================
// JSON Response Helpers
// ============================================

/**
 * Kreira JSON response
 */
export function json<T>(data: ApiResponse<T>, status: number = 200): Response {
	try {
		const jsonString = JSON.stringify(data);
		return new Response(jsonString, {
			status,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		// If JSON.stringify fails, return a safe error response
		console.error("Error in json helper:", error);
		const safeError: ApiResponse<never> = {
			success: false,
			error: {
				code: "INTERNAL_ERROR",
				message: "Failed to serialize response",
			},
		};
		return new Response(JSON.stringify(safeError), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}

/**
 * Određuje HTTP status kod na osnovu API responsa
 */
export function getStatusFromResponse<T>(
	result: ApiResponse<T>,
	successStatus: number = 200,
): number {
	if (result.success) return successStatus;
	switch (result.error?.code) {
		case "NOT_FOUND":
			return 404;
		case "UNAUTHORIZED":
			return 401;
		case "FORBIDDEN":
			return 403;
		case "VALIDATION_ERROR":
			return 400;
		case "CONFLICT":
			return 409;
		default:
			return 500;
	}
}

// ============================================
// Authentication Helper
// ============================================

/**
 * Middleware za autentifikaciju - verifikuje token i vraća user info
 */
export async function withAuth<T>(
	request: Request,
	handler: (auth: AuthContext) => Promise<ApiResponse<T> | Response>,
	statusOnSuccess: number = 200,
): Promise<Response> {
	try {
		const auth = await verifyAndGetUser(request);
		if (!auth) {
			return json(
				errorResponse("UNAUTHORIZED", "Authentication required"),
				401,
			);
		}

		// Validate auth context has required fields
		if (!auth.userId || typeof auth.userId !== "string") {
			return json(
				errorResponse("UNAUTHORIZED", "Invalid authentication context"),
				401,
			);
		}

		try {
			const result = await handler(auth);
			
			// If result is already a Response object, return it directly
			if (result instanceof Response) {
				return result;
			}
			
			// Ensure result is always an ApiResponse
			if (!result || typeof result !== "object" || !("success" in result)) {
				return json(
					errorResponse("INTERNAL_ERROR", "Invalid response from handler"),
					500,
				);
			}

			return json(result, getStatusFromResponse(result, statusOnSuccess));
		} catch (handlerError) {
			console.error("Error in withAuth handler:", handlerError);
			const errorMessage =
				handlerError instanceof Error
					? handlerError.message
					: "Internal server error";
			return json(errorResponse("INTERNAL_ERROR", errorMessage), 500);
		}
	} catch (error) {
		console.error("Error in withAuth:", error);
		// Ensure we always return JSON, even on errors
		const errorMessage =
			error instanceof Error ? error.message : "Internal server error";
		return json(errorResponse("INTERNAL_ERROR", errorMessage), 500);
	}
}

/**
 * Admin only route - zahteva admin ulogu
 */
export async function withAdminAuth<T>(
	request: Request,
	handler: (auth: AuthContext) => Promise<ApiResponse<T>>,
	statusOnSuccess: number = 200,
): Promise<Response> {
	try {
		const auth = await verifyAndGetUser(request);
		if (!auth) {
			return json(
				errorResponse("UNAUTHORIZED", "Authentication required"),
				401,
			);
		}
		// Allow superadmin, tenant_admin, or crm_user depending on context
		// For now, allow all authenticated users (can be restricted per route)
		const result = await handler(auth);
		return json(result, getStatusFromResponse(result, statusOnSuccess));
	} catch (error) {
		console.error("Error in withAdminAuth:", error);
		const errorMessage =
			error instanceof Error ? error.message : "Internal server error";
		return json(errorResponse("INTERNAL_ERROR", errorMessage), 500);
	}
}

// ============================================
// Company ID Helper (Multi-tenant support)
// ============================================

/**
 * Helper funkcija za dobijanje companyId za filtriranje podataka.
 * Ovo je najlakši način za implementaciju tenant funkcionalnosti.
 *
 * @param url - URL sa query parametrima
 * @param auth - Auth kontekst sa userId i role
 * @param allowAllForAdmin - Da li admin može da vidi sve podatke (default: true)
 * @returns companyId ili null (null = vidi sve podatke za admin)
 */
export async function getCompanyIdForFilter(
	url: URL,
	auth: AuthContext,
	allowAllForAdmin: boolean = true,
): Promise<{ companyId: string | null; error?: Response }> {
	// Check if companyId query parameter is provided (for admin to filter by company)
	const queryCompanyId = url.searchParams.get("companyId");

	let companyId: string | null = null;

    if (queryCompanyId) {
		// If companyId is provided in query, verify user has access
        if (auth.role === "tenant_admin" || auth.role === "superadmin") {
			// Admin can access any company (they should be added to all via users_on_company)
			companyId = queryCompanyId;
    } else {
			// Regular users can only access companies they're members of
			const hasAccess = await hasCompanyAccess(queryCompanyId, auth.userId);
			if (!hasAccess) {
				return {
					companyId: null,
					error: json(
						errorResponse("FORBIDDEN", "Not a member of this company"),
						403,
					),
				};
			}
			companyId = queryCompanyId;
		}
	} else {
		// No query parameter - use user's current active company
		const userCompanyId = await userQueries.getUserCompanyId(auth.userId);

        if (auth.role === "tenant_admin" || auth.role === "superadmin") {
			// Admin users can see all data if no company filter is specified
			companyId = allowAllForAdmin ? null : userCompanyId;
		} else {
			// Regular users need an active company
			if (!userCompanyId) {
				return {
					companyId: null,
					error: json(
						errorResponse("NOT_FOUND", "No active company found for user"),
						404,
					),
				};
			}
			companyId = userCompanyId;
		}
	}

	return { companyId };
}

// ============================================
// Request Parsing Helpers
// ============================================

/**
 * Parsira request body kao JSON
 */
export async function parseBody<T = unknown>(
	request: Request,
): Promise<T | null> {
	try {
		if (request.method === "GET" || request.method === "HEAD") {
			return null;
		}
		const contentType = request.headers.get("content-type");
		if (!contentType?.includes("application/json")) {
			return null;
		}
		return (await request.json()) as T;
	} catch (error) {
		console.error("Error parsing body:", error);
		return null;
	}
}

/**
 * Parsira pagination parametre iz URL-a
 */
export function parsePagination(url: URL): {
	page: number;
	pageSize: number;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
} {
	const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
	const pageSize = Math.min(
		100,
		Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10)),
	);
	const sortBy = url.searchParams.get("sortBy") || undefined;
	const sortOrder = (url.searchParams.get("sortOrder") || "desc") as
		| "asc"
		| "desc";

	return { page, pageSize, sortBy, sortOrder };
}

/**
 * Parsira filter parametre iz URL-a
 */
export function parseFilters(url: URL): {
	search?: string;
	status?: string;
	[key: string]: unknown;
} {
	const filters: Record<string, unknown> = {};

	const search = url.searchParams.get("search") || url.searchParams.get("q");
	if (search) filters.search = search;

	const status = url.searchParams.get("status");
	if (status) filters.status = status;

	// Add any other filter parameters
	url.searchParams.forEach((value, key) => {
		if (
			key !== "page" &&
			key !== "pageSize" &&
			key !== "sortBy" &&
			key !== "sortOrder" &&
			key !== "search" &&
			key !== "q" &&
			key !== "status" &&
			key !== "companyId"
		) {
			filters[key] = value;
		}
	});

	return filters;
}

// ============================================
// Route Builder
// ============================================

/**
 * Builder klasa za kreiranje routes sa middleware podrškom
 */
export class RouteBuilder {
	private routes: Route[] = [];

	get(pattern: string, handler: RouteHandler): void {
		this.addRoute("GET", pattern, handler);
	}

	post(pattern: string, handler: RouteHandler): void {
		this.addRoute("POST", pattern, handler);
	}

	put(pattern: string, handler: RouteHandler): void {
		this.addRoute("PUT", pattern, handler);
	}

	patch(pattern: string, handler: RouteHandler): void {
		this.addRoute("PATCH", pattern, handler);
	}

	delete(pattern: string, handler: RouteHandler): void {
		this.addRoute("DELETE", pattern, handler);
	}

	private addRoute(
		method: string,
		pattern: string,
		handler: RouteHandler,
	): void {
		const paramNames: string[] = [];
		const regexPattern = pattern
			.replace(/\//g, "\\/")
			.replace(/:(\w+)/g, (_, paramName) => {
				paramNames.push(paramName);
				return "([^/]+)";
			});

		this.routes.push({
			method,
			pattern: new RegExp(`^${regexPattern}$`),
			handler,
			params: paramNames,
		});
	}

	getRoutes(): Route[] {
		return this.routes;
	}
}
