/**
 * Main Routes Index - kombinuje sve route module
 */

import { successResponse, errorResponse } from "@crm/utils";
import { logger } from "../lib/logger";
import type { Route } from "./helpers";
import { json } from "./helpers";

// Import route modules
import { healthRoutes } from "./health";
import { companyRoutes } from "./companies";
import { userRoutes } from "./users";
import { crmRoutes } from "./crm";
import { salesRoutes } from "./sales";
import { projectRoutes } from "./projects";
import { productRoutes } from "./products-routes";
import { notificationRoutes } from "./notifications-routes";
import { paymentRoutes } from "./payments-routes";
import { reportRoutes } from "./reports";

// Auth routes
import {
  loginHandler,
  logoutHandler,
  refreshHandler,
  meHandler,
  changePasswordHandler,
} from "./auth";

// API integration auth
import {
  authenticateApiKey,
  checkRateLimit,
  getRateLimitHeaders,
  generateApiKey,
  revokeApiKey,
  listUserApiKeys,
  logApiRequest,
  apiErrorResponse,
  rateLimitResponse,
  hasScope,
  type ApiScope,
} from "../integrations/api-auth";

import { addEmailJob, getQueuesStatus } from "../jobs";
import { verifyAndGetUser } from "../middleware/auth";

// ============================================
// Combine All Routes
// ============================================

const routes: Route[] = [
  // Health & Info
  ...healthRoutes,

  // Core Entities
  ...companyRoutes,
  ...userRoutes,

  // CRM
  ...crmRoutes,

  // Sales
  ...salesRoutes,

  // Projects
  ...projectRoutes,

  // Products
  ...productRoutes,

  // Notifications
  ...notificationRoutes,

  // Payments
  ...paymentRoutes,

  // Reports
  ...reportRoutes,
];

// ============================================
// Auth Routes (special handling)
// ============================================

function registerAuthRoute(method: string, path: string, handler: (req: Request, url: URL) => Promise<Response>) {
  routes.push({
    method,
    pattern: new RegExp(`^${path.replace(/:(\w+)/g, "([^/]+)")}$`),
    handler: async (request, url, _params) => handler(request, url),
    params: [],
  });
}

// Auth endpoints
registerAuthRoute("POST", "/api/v1/auth/login", loginHandler);
registerAuthRoute("POST", "/api/v1/auth/logout", logoutHandler);
registerAuthRoute("POST", "/api/v1/auth/refresh", refreshHandler);
registerAuthRoute("GET", "/api/v1/auth/me", meHandler);
registerAuthRoute("POST", "/api/v1/auth/change-password", changePasswordHandler);

// ============================================
// API Auth Routes (for external integrations)
// ============================================

// Generate API key (authenticated users only)
routes.push({
  method: "POST",
  pattern: /^\/api\/v1\/api-keys$/,
  handler: async (request) => {
    const auth = await verifyAndGetUser(request);
    if (!auth) {
      return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
    }

    try {
      const body = await request.json() as { name: string; scopes?: ApiScope[] };
      if (!body.name) {
        return json(errorResponse("VALIDATION_ERROR", "API key name is required"), 400);
      }

      const result = await generateApiKey(auth.userId, body.name, body.scopes || []);
      return json(successResponse({ apiKey: result }), 201);
    } catch (error) {
      logger.error({ error }, "Error generating API key");
      return json(errorResponse("INTERNAL_ERROR", "Failed to generate API key"), 500);
    }
  },
  params: [],
});

// Revoke API key
routes.push({
  method: "DELETE",
  pattern: /^\/api\/v1\/api-keys\/([^/]+)$/,
  handler: async (request, _url, params) => {
    const auth = await verifyAndGetUser(request);
    if (!auth) {
      return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
    }

    try {
      await revokeApiKey(params.apiKey);
      return json(successResponse({ message: "API key revoked" }));
    } catch (error) {
      logger.error({ error }, "Error revoking API key");
      return json(errorResponse("INTERNAL_ERROR", "Failed to revoke API key"), 500);
    }
  },
  params: ["apiKey"],
});

// List user's API keys
routes.push({
  method: "GET",
  pattern: /^\/api\/v1\/api-keys$/,
  handler: async (request) => {
    const auth = await verifyAndGetUser(request);
    if (!auth) {
      return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
    }

    try {
      const keys = await listUserApiKeys(auth.userId);
      return json(successResponse(keys));
    } catch (error) {
      logger.error({ error }, "Error listing API keys");
      return json(errorResponse("INTERNAL_ERROR", "Failed to list API keys"), 500);
    }
  },
  params: [],
});

// ============================================
// External API Routes (with API key auth)
// ============================================

async function withApiAuth<T>(
  request: Request,
  scopes: ApiScope[],
  handler: () => Promise<T>
): Promise<Response> {
  const startTime = Date.now();
  const url = new URL(request.url);
  
  const auth = await authenticateApiKey(request);
  if (!auth.authenticated) {
    return apiErrorResponse("INVALID_API_KEY", auth.error || "Invalid or expired API key", auth.statusCode || 401);
  }

  // Check rate limit
  const rateLimitResult = await checkRateLimit(`apikey:${auth.apiKey?.userId || "unknown"}`);
  if (!rateLimitResult.allowed) {
    return rateLimitResponse(rateLimitResult);
  }

  // Check scopes
  if (auth.apiKey && scopes.length > 0 && !scopes.every((scope) => hasScope(auth.apiKey!, scope))) {
    return apiErrorResponse("INSUFFICIENT_SCOPE", "API key does not have required scope", 403);
  }

  try {
    const result = await handler();
    const responseTimeMs = Date.now() - startTime;
    
    // Log API request
    await logApiRequest({
      timestamp: new Date().toISOString(),
      method: request.method,
      path: url.pathname,
      apiKeyName: auth.apiKey?.name,
      userId: auth.apiKey?.userId,
      statusCode: 200,
      responseTimeMs,
    });

    const response = json(successResponse(result));
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  } catch (error) {
    logger.error({ error }, "Error in withApiAuth handler");
    return json(errorResponse("INTERNAL_ERROR", "Internal server error"), 500);
  }
}

// ============================================
// Background Jobs Routes
// ============================================

routes.push({
  method: "GET",
  pattern: /^\/api\/v1\/jobs\/status$/,
  handler: async (request) => {
    const auth = await verifyAndGetUser(request);
    if (!auth) {
      return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
    }
    if (auth.role !== "admin") {
      return json(errorResponse("FORBIDDEN", "Admin access required"), 403);
    }

    try {
      const status = await getQueuesStatus();
      return json(successResponse(status));
    } catch (error) {
      logger.error({ error }, "Error getting job status");
      return json(errorResponse("INTERNAL_ERROR", "Failed to get job status"), 500);
    }
  },
  params: [],
});

routes.push({
  method: "POST",
  pattern: /^\/api\/v1\/jobs\/email$/,
  handler: async (request) => {
    const auth = await verifyAndGetUser(request);
    if (!auth) {
      return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
    }

    try {
      const body = await request.json() as { to: string; subject: string; html: string };
      await addEmailJob({ to: body.to, subject: body.subject, html: body.html });
      return json(successResponse({ message: "Email job queued" }), 202);
    } catch (error) {
      logger.error({ error }, "Error queueing email job");
      return json(errorResponse("INTERNAL_ERROR", "Failed to queue email job"), 500);
    }
  },
  params: [],
});

// ============================================
// 404 Handler
// ============================================

function notFoundResponse(): Response {
  return json(errorResponse("NOT_FOUND", "Endpoint not found"), 404);
}

// ============================================
// Main Request Handler
// ============================================

export async function handleRequest(request: Request, url: URL): Promise<Response> {
  const path = url.pathname;
  const method = request.method;

  // Find matching route
  for (const route of routes) {
    if (route.method !== method) continue;

    const match = path.match(route.pattern);
    if (!match) continue;

    // Extract params
    const params: Record<string, string> = {};
    route.params.forEach((name, index) => {
      params[name] = match[index + 1];
    });

    return route.handler(request, url, params);
  }

  return notFoundResponse();
}

// Export withApiAuth for use in other modules
export { withApiAuth };

export default handleRequest;
