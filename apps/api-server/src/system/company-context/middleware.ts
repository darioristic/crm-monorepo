import type { AuthenticatedRouteHandler } from "../../middleware/auth";
import { companyContextManager } from "./company-context-manager";
import { errorResponse } from "@crm/utils";
import type { AuthContext } from "../../middleware/auth";
import type { CompanyContext } from "./types";
import type { TenantContext } from "../tenant-context/types";

export interface CompanyScopedRequest extends Request {
	companyContext?: CompanyContext;
	tenantContext?: TenantContext;
}

/**
 * Middleware that requires company context
 * Extracts companyId from query params or body and validates it belongs to tenant
 */
export function requireCompanyContext(
	handler: (
		request: CompanyScopedRequest,
		url: URL,
		params: Record<string, string>,
		auth: AuthContext,
		tenantContext: TenantContext,
		companyContext: CompanyContext,
	) => Promise<Response>,
): AuthenticatedRouteHandler {
	return async (request, url, params, auth) => {
		// This middleware should be used after requireTenantContext
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

		// Extract companyId from URL params, query params, or request body
		let companyId: string | undefined;

		// Check URL params first
		companyId = params.companyId || params.id;

		// Check query params
		if (!companyId) {
			companyId = url.searchParams.get("companyId") || undefined;
		}

		// Check header X-Company-Id
		if (!companyId) {
			const headerCompanyId = request.headers.get("x-company-id") || undefined;
			companyId = headerCompanyId;
		}

		// Check request body (for POST/PUT requests)
		if (!companyId && (request.method === "POST" || request.method === "PUT")) {
            try {
                const body = (await request.clone().json().catch(() => ({}))) as { companyId?: string };
                companyId = body.companyId;
            } catch {
                // Ignore JSON parse errors
            }
		}

		if (!companyId) {
			return new Response(
				JSON.stringify(
					errorResponse("BAD_REQUEST", "Company ID is required"),
				),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Validate company access
		const validation = await companyContextManager.validateCompanyAccess(
			companyId,
			tenantId,
		);

		if (!validation.allowed) {
			return new Response(
				JSON.stringify(
					errorResponse("FORBIDDEN", validation.reason || "Company access denied"),
				),
				{
					status: 403,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Get company context
		const companyContext = await companyContextManager.getCompanyById(
			companyId,
			tenantId,
		);

		if (!companyContext) {
			return new Response(
				JSON.stringify(
					errorResponse("NOT_FOUND", "Company not found"),
				),
				{
					status: 404,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Get tenant context (should already be set by requireTenantContext)
		const tenantContext: TenantContext = {
			tenantId,
			tenantStatus: "active", // Will be properly set by requireTenantContext
		};

		// Attach contexts to request
		(request as CompanyScopedRequest).companyContext = companyContext;
		(request as CompanyScopedRequest).tenantContext = tenantContext;

		return handler(
			request as CompanyScopedRequest,
			url,
			params,
			auth,
			tenantContext,
			companyContext,
		);
	};
}
