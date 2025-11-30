/**
 * Route Helpers - zajedničke funkcije za sve route module
 */

import type { ApiResponse } from "@crm/types";
import { errorResponse } from "@crm/utils";
import { verifyAndGetUser, type AuthContext } from "../middleware/auth";

// ============================================
// Types
// ============================================

export type RouteHandler = (
  request: Request,
  url: URL,
  params: Record<string, string>
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
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Određuje HTTP status kod na osnovu API responsa
 */
export function getStatusFromResponse<T>(result: ApiResponse<T>, successStatus: number = 200): number {
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
      return 400;
  }
}

// ============================================
// Auth Wrapper Helpers
// ============================================

/**
 * Protected route - zahteva autentifikaciju
 */
export async function withAuth<T>(
  request: Request,
  handler: (auth: AuthContext) => Promise<ApiResponse<T>>,
  statusOnSuccess: number = 200
): Promise<Response> {
  const auth = await verifyAndGetUser(request);
  if (!auth) {
    return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
  }
  const result = await handler(auth);
  return json(result, getStatusFromResponse(result, statusOnSuccess));
}

/**
 * Admin only route - zahteva admin ulogu
 */
export async function withAdminAuth<T>(
  request: Request,
  handler: (auth: AuthContext) => Promise<ApiResponse<T>>,
  statusOnSuccess: number = 200
): Promise<Response> {
  const auth = await verifyAndGetUser(request);
  if (!auth) {
    return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
  }
  if (auth.role !== "admin") {
    return json(errorResponse("FORBIDDEN", "Admin access required"), 403);
  }
  const result = await handler(auth);
  return json(result, getStatusFromResponse(result, statusOnSuccess));
}

// ============================================
// Request Parsing Helpers
// ============================================

/**
 * Parsiraj JSON body sigurno
 */
export async function parseBody<T = Record<string, unknown>>(request: Request): Promise<T | null> {
  try {
    const data = await request.json();
    return data as T;
  } catch {
    return null;
  }
}

/**
 * Parsiraj pagination parametre iz query stringa
 */
export function parsePagination(url: URL): {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
} {
  return {
    page: parseInt(url.searchParams.get("page") || "1", 10),
    pageSize: parseInt(url.searchParams.get("pageSize") || "20", 10),
    sortBy: url.searchParams.get("sortBy") || undefined,
    sortOrder: (url.searchParams.get("sortOrder") as "asc" | "desc") || undefined,
  };
}

/**
 * Parsiraj filter parametre iz query stringa
 */
export function parseFilters(url: URL): Record<string, string | undefined> {
  return {
    search: url.searchParams.get("search") || undefined,
    status: url.searchParams.get("status") || undefined,
    assignedTo: url.searchParams.get("assignedTo") || undefined,
    companyId: url.searchParams.get("companyId") || undefined,
    projectId: url.searchParams.get("projectId") || undefined,
    milestoneId: url.searchParams.get("milestoneId") || undefined,
    invoiceId: url.searchParams.get("invoiceId") || undefined,
    userId: url.searchParams.get("userId") || undefined,
    categoryId: url.searchParams.get("categoryId") || undefined,
    dateFrom: url.searchParams.get("dateFrom") || undefined,
    dateTo: url.searchParams.get("dateTo") || undefined,
    type: url.searchParams.get("type") || undefined,
    isRead: url.searchParams.get("isRead") || undefined,
    isActive: url.searchParams.get("isActive") || undefined,
    isService: url.searchParams.get("isService") || undefined,
    minPrice: url.searchParams.get("minPrice") || undefined,
    maxPrice: url.searchParams.get("maxPrice") || undefined,
    parentId: url.searchParams.get("parentId") || undefined,
    paymentMethod: url.searchParams.get("paymentMethod") || undefined,
  };
}

// ============================================
// Route Builder Class
// ============================================

/**
 * RouteBuilder - za registraciju ruta u modulima
 */
export class RouteBuilder {
  private routes: Route[] = [];

  /**
   * Registruje novu rutu
   */
  register(method: string, path: string, handler: RouteHandler): void {
    const params: string[] = [];
    const pattern = path.replace(/:(\w+)/g, (_, param) => {
      params.push(param);
      return "([^/]+)";
    });
    this.routes.push({
      method,
      pattern: new RegExp(`^${pattern}$`),
      handler,
      params,
    });
  }

  // Convenience methods
  get(path: string, handler: RouteHandler): void {
    this.register("GET", path, handler);
  }

  post(path: string, handler: RouteHandler): void {
    this.register("POST", path, handler);
  }

  put(path: string, handler: RouteHandler): void {
    this.register("PUT", path, handler);
  }

  patch(path: string, handler: RouteHandler): void {
    this.register("PATCH", path, handler);
  }

  delete(path: string, handler: RouteHandler): void {
    this.register("DELETE", path, handler);
  }

  /**
   * Vraća sve registrovane rute
   */
  getRoutes(): Route[] {
    return this.routes;
  }
}

// ============================================
// Export Singleton Route Builder za main index
// ============================================

export const mainRouter = new RouteBuilder();

