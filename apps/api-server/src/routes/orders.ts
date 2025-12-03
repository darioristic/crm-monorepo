/**
 * Orders Routes
 */

import { successResponse, errorResponse } from "@crm/utils";
import { RouteBuilder, withAuth, parsePagination, parseFilters, parseBody } from "./helpers";
import { orderQueries } from "../db/queries/orders";
import { userQueries } from "../db/queries/users";
import { hasCompanyAccess } from "../db/queries/companies-members";
import type { CreateOrderRequest, UpdateOrderRequest } from "@crm/types";

const router = new RouteBuilder();

router.get("/api/v1/orders", async (request, url) => {
	return withAuth(request, async (auth) => {
		const pagination = parsePagination(url);
		const filters = parseFilters(url);
		
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
					return errorResponse("FORBIDDEN", "Not a member of this company");
				}
				companyId = queryCompanyId;
			}
		} else {
			// No query parameter - use user's current active company
			const userCompanyId = await userQueries.getUserCompanyId(auth.userId);
			
			if (auth.role === "tenant_admin" || auth.role === "superadmin") {
				// Admin users can see all orders if no company filter is specified
				companyId = null;
			} else {
				// Regular users need an active company
				if (!userCompanyId) {
					return errorResponse("NOT_FOUND", "No active company found for user");
				}
				companyId = userCompanyId;
			}
		}

		return orderQueries.findAll(companyId, pagination, filters);
	});
});

router.get("/api/v1/orders/:id", async (request, _url, params) => {
	return withAuth(request, async () => {
		const order = await orderQueries.findById(params.id);
		if (!order) {
			return errorResponse("NOT_FOUND", "Order not found");
		}
		return successResponse(order);
	});
});

router.post("/api/v1/orders", async (request) => {
	return withAuth(
		request,
		async (auth) => {
			const body = await parseBody<CreateOrderRequest>(request);
			if (!body) {
				return errorResponse("VALIDATION_ERROR", "Invalid request body");
			}
			return orderQueries.create({ ...body, createdBy: auth.userId });
		},
		201
	);
});

router.put("/api/v1/orders/:id", async (request, _url, params) => {
	return withAuth(request, async () => {
		const body = await parseBody<UpdateOrderRequest>(request);
		if (!body) {
			return errorResponse("VALIDATION_ERROR", "Invalid request body");
		}
		return orderQueries.update(params.id, body);
	});
});

router.delete("/api/v1/orders/:id", async (request, _url, params) => {
	return withAuth(request, async () => {
		return orderQueries.delete(params.id);
	});
});

export const orderRoutes = router.getRoutes();
