import type { AuthenticatedRouteHandler } from "../../middleware/auth";
import { tenantContextManager } from "./tenant-context-manager";
import { errorResponse } from "@crm/utils";
import type { AuthContext } from "../../middleware/auth";
import type { TenantContext } from "./types";
import { logger } from "../../lib/logger";

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
        let tenantId = auth.tenantId;

		// Fallback: if tenantId is not in token, get it from database
        if (!tenantId) {
            try {
                const { userQueries } = await import("../../db/queries/users");
                const user = await userQueries.findById(auth.userId);
                if (user?.tenantId) {
                    tenantId = user.tenantId;
                }
            } catch (error) {
                logger.error({ error, userId: auth.userId }, "Failed to fetch tenantId from database");
            }
        }

        // Additional fallback: try deriving tenantId from company context in request
        if (!tenantId) {
            try {
                const companyIdParam = url.searchParams.get("companyId") || params.companyId || params.id || undefined;
                if (companyIdParam) {
                    const { db } = await import("../../db/client");
                    const { companies } = await import("../../db/schema/index");
                    const { eq } = await import("drizzle-orm");
                    const rows = await db
                        .select({ tenantId: companies.tenantId })
                        .from(companies)
                        .where(eq(companies.id, companyIdParam))
                        .limit(1);
                    const derived = rows[0]?.tenantId as string | undefined;
                    if (derived) {
                        tenantId = derived;
                    }
                }
            } catch (deriveError) {
                logger.warn({ error: deriveError }, "Could not derive tenantId from company context");
            }
        }

        if (!tenantId) {
            try {
                const { db } = await import("../../db/client");
                const { tenants, users } = await import("../../db/schema/index");
                const { eq } = await import("drizzle-orm");

                const firstTenant = await db
                    .select()
                    .from(tenants)
                    .where(eq(tenants.status, "active"))
                    .limit(1);

                if (firstTenant.length > 0) {
                    tenantId = firstTenant[0].id;

                    try {
                        await db
                            .update(users)
                            .set({ tenantId, updatedAt: new Date() })
                            .where(eq(users.id, auth.userId));

                        const { cache } = await import("../../cache/redis");
                        const session = await cache.getSession<Record<string, unknown>>(auth.sessionId);
                        if (session) {
                            const updated = { ...session, tenantId } as Record<string, unknown>;
                            await cache.setSession(auth.sessionId, updated);
                        }
                    } catch (updateError) {
                        logger.error({ error: updateError, userId: auth.userId }, "Failed to persist tenantId");
                    }
                }
            } catch (error) {
                logger.error({ error, userId: auth.userId }, "Failed to resolve default tenantId");
            }

            if (!tenantId) {
                return new Response(
                    JSON.stringify(
                        errorResponse("UNAUTHORIZED", "Tenant context required. Please log out and log in again to refresh your session."),
                    ),
                    {
                        status: 401,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            }
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
