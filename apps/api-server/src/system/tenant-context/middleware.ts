import type { AuthenticatedRouteHandler } from "../../middleware/auth";
import { tenantContextManager } from "./tenant-context-manager";
import { errorResponse } from "@crm/utils";
import type { AuthContext } from "../../middleware/auth";
import type { TenantContext } from "./types";

export interface TenantScopedRequest extends Request {
	tenantContext?: TenantContext;
}

/**
 * Middleware that requires tenant context from JWT
 * Extracts tenantId from auth context and validates tenant access
 */
export function requireTenantContext(
	handler: (
		request: TenantScopedRequest,
		url: URL,
		params: Record<string, string>,
		auth: AuthContext,
		tenantContext: TenantContext,
	) => Promise<Response>,
): AuthenticatedRouteHandler {
	return async (request, url, params, auth) => {
		// Superadmin doesn't need tenant context
		if (auth.role === "superadmin") {
			return new Response(
				JSON.stringify(
					errorResponse(
						"FORBIDDEN",
						"Superadmin cannot access tenant-scoped resources",
					),
				),
				{
					status: 403,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Extract tenantId from auth context (should be in JWT for tenant_admin and crm_user)
		const tenantId = auth.tenantId;

		if (!tenantId) {
			return new Response(
				JSON.stringify(
					errorResponse("UNAUTHORIZED", "Tenant context required"),
				),
				{
					status: 401,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Validate tenant access
		const validation = await tenantContextManager.validateTenantAccess(tenantId);

		if (!validation.allowed) {
			return new Response(
				JSON.stringify(
					errorResponse("FORBIDDEN", validation.reason || "Tenant access denied"),
				),
				{
					status: 403,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Get tenant context
		const tenantContext = await tenantContextManager.getTenantById(tenantId);

		if (!tenantContext) {
			return new Response(
				JSON.stringify(
					errorResponse("NOT_FOUND", "Tenant not found"),
				),
				{
					status: 404,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Attach tenant context to request
		(request as TenantScopedRequest).tenantContext = tenantContext;

		return handler(
			request as TenantScopedRequest,
			url,
			params,
			auth,
			tenantContext,
		);
	};
}

