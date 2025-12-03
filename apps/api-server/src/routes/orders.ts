/**
 * Orders Routes
 */

import { successResponse, errorResponse } from "@crm/utils";
import { RouteBuilder, withAuth, parsePagination, parseFilters, parseBody } from "./helpers";
import { orderQueries } from "../db/queries/orders";
import { userQueries } from "../db/queries/users";
import type { CreateOrderRequest, UpdateOrderRequest } from "@crm/types";

const router = new RouteBuilder();

router.get("/api/v1/orders", async (request, url) => {
	return withAuth(request, async (auth) => {
		const companyId = await userQueries.getUserCompanyId(auth.userId);
		if (!companyId) {
			return errorResponse("NOT_FOUND", "No active company found for user");
		}

		const pagination = parsePagination(url);
		const filters = parseFilters(url);
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

