/**
 * Orders Routes
 */

import type { CreateOrderRequest, UpdateOrderRequest } from "@crm/types";
import { errorResponse, successResponse } from "@crm/utils";
import { orderQueries } from "../db/queries/orders";
import { parseBody, RouteBuilder, withAuth } from "./helpers";

const router = new RouteBuilder();

router.get("/api/v1/orders", async (request, url) => {
  return withAuth(request, async (auth) => {
    // Get pagination params
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
    const sortBy = url.searchParams.get("sortBy") || "created_at";
    const sortOrderRaw = url.searchParams.get("sortOrder") || "desc";
    const sortOrder = sortOrderRaw === "asc" || sortOrderRaw === "desc" ? sortOrderRaw : "desc";

    // Get filter params
    const search = url.searchParams.get("search") || undefined;
    const status = url.searchParams.get("status") || undefined;

    // Use activeTenantId to filter by tenant
    return orderQueries.findAll(
      auth.activeTenantId ?? null,
      { page, pageSize, sortBy, sortOrder },
      { search, status }
    );
  });
});

router.get("/api/v1/orders/next-number", async (request) => {
  return withAuth(request, async () => {
    const nextNumber = await orderQueries.generateNumber();
    return successResponse({ orderNumber: nextNumber });
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
      const body = await parseBody<
        CreateOrderRequest & {
          items?: Array<{
            productName: string;
            description?: string | null;
            quantity: number;
            unitPrice: number;
            discount?: number;
            total: number;
          }>;
        }
      >(request);
      if (!body) {
        return errorResponse("VALIDATION_ERROR", "Invalid request body");
      }
      return orderQueries.create(
        {
          ...(body as CreateOrderRequest),
          createdBy: auth.userId,
          sellerCompanyId: auth.activeTenantId,
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
