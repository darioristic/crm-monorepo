/**
 * Orders Routes
 */

import type { CreateOrderRequest, UpdateOrderRequest } from "@crm/types";
import { errorResponse, isValidUUID, successResponse } from "@crm/utils";
import { hasCompanyAccess } from "../db/queries/companies-members";
import { orderQueries } from "../db/queries/orders";
import { parseBody, parseFilters, parsePagination, RouteBuilder, withAuth } from "./helpers";

const router = new RouteBuilder();

router.get("/api/v1/orders", async (request, url) => {
  return withAuth(request, async (auth) => {
    const pagination = parsePagination(url);
    const filters = parseFilters(url);

    // Check if companyId query parameter is provided (for admin to filter by company)
    const queryCompanyId = url.searchParams.get("companyId");

    // Validate companyId format to avoid database errors
    if (queryCompanyId && !isValidUUID(queryCompanyId)) {
      return errorResponse("VALIDATION_ERROR", "Invalid companyId format");
    }

    let companyId: string | null = null;

    if (queryCompanyId) {
      // If companyId is provided in query, verify user has access
      if (auth.role === "tenant_admin" || auth.role === "superadmin") {
        companyId = queryCompanyId;
      } else {
        const hasAccess = await hasCompanyAccess(queryCompanyId, auth.userId);
        if (!hasAccess) {
          return errorResponse("FORBIDDEN", "Not a member of this company");
        }
        companyId = queryCompanyId;
      }
    } else {
      // No company filter -> show orders created by current user across companies
      filters.createdBy = auth.userId as any;
      companyId = null;
    }

    if (companyId) {
      const orders = await orderQueries.findByCompany(companyId);
      return successResponse(orders);
    }
    return orderQueries.findAll(null, pagination, filters);
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
      const body = await parseBody<any>(request);
      if (!body) {
        return errorResponse("VALIDATION_ERROR", "Invalid request body");
      }
      return orderQueries.create(
        {
          ...(body as CreateOrderRequest),
          createdBy: auth.userId,
          sellerCompanyId: auth.companyId,
        },
        Array.isArray(body.items) ? body.items : undefined
      );
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
