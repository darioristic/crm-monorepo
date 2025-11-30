/**
 * Health & Info Routes
 */

import { successResponse } from "@crm/utils";
import { RouteBuilder, json } from "./helpers";
import { cache } from "../cache/redis";
import { getQueuesStatus, getWorkerStatuses } from "../jobs";

const router = new RouteBuilder();

// ============================================
// Health Check
// ============================================

router.get("/health", async () => {
  return json(
    successResponse({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    })
  );
});

// ============================================
// API Info
// ============================================

router.get("/api/v1", async () => {
  return json(
    successResponse({
      name: "CRM API",
      version: "1.0.0",
      endpoints: {
        auth: {
          login: "/api/v1/auth/login",
          logout: "/api/v1/auth/logout",
          refresh: "/api/v1/auth/refresh",
          me: "/api/v1/auth/me",
        },
        companies: "/api/v1/companies",
        users: "/api/v1/users",
        leads: "/api/v1/leads",
        contacts: "/api/v1/contacts",
        deals: "/api/v1/deals",
        quotes: "/api/v1/quotes",
        invoices: "/api/v1/invoices",
        deliveryNotes: "/api/v1/delivery-notes",
        projects: "/api/v1/projects",
        milestones: "/api/v1/milestones",
        tasks: "/api/v1/tasks",
        products: "/api/v1/products",
        productCategories: "/api/v1/product-categories",
        notifications: "/api/v1/notifications",
        payments: "/api/v1/payments",
        reports: "/api/v1/reports",
      },
    })
  );
});

// ============================================
// System Stats (Admin only in production)
// ============================================

router.get("/api/v1/system/stats", async () => {
  const [cacheStats, queues, workers] = await Promise.all([
    cache.getStats(),
    getQueuesStatus(),
    getWorkerStatuses(),
  ]);

  return json(
    successResponse({
      timestamp: new Date().toISOString(),
      cache: cacheStats,
      queues,
      workers,
    })
  );
});

export const healthRoutes = router.getRoutes();

