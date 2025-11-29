import type { ApiResponse } from "@crm/types";
import { successResponse, errorResponse, generateUUID, now } from "@crm/utils";
import { crmService } from "../services/crm.service";
import { salesService } from "../services/sales.service";
import { projectsService } from "../services/projects.service";
import { companiesService } from "../services/companies.service";
import { usersService } from "../services/users.service";
import { reportsService } from "../services/reports.service";
import { productsService, productCategoryService } from "../services/products.service";
import { notificationsService } from "../services/notifications.service";
import { getQueuesStatus, getWorkerStatuses, addEmailJob } from "../jobs";
import { paymentsService } from "../services/payments.service";
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
import { emailService } from "../integrations/email.service";
import { erpClient } from "../integrations/erp.client";
import { cache } from "../cache/redis";
import {
  loginHandler,
  logoutHandler,
  refreshHandler,
  meHandler,
  changePasswordHandler,
} from "./auth";
import { verifyAndGetUser, type AuthContext } from "../middleware/auth";
import { auditService, getClientIp, getUserAgent } from "../services/audit.service";

type RouteHandler = (
  request: Request,
  url: URL,
  params: Record<string, string>
) => Promise<Response>;

interface Route {
  method: string;
  pattern: RegExp;
  handler: RouteHandler;
  params: string[];
}

const routes: Route[] = [];

// Route registration helper
function registerRoute(method: string, path: string, handler: RouteHandler): void {
  // Convert path pattern to regex, extracting param names
  const params: string[] = [];
  const pattern = path.replace(/:(\w+)/g, (_, param) => {
    params.push(param);
    return "([^/]+)";
  });
  routes.push({
    method,
    pattern: new RegExp(`^${pattern}$`),
    handler,
    params,
  });
}

// JSON response helper
function json<T>(data: ApiResponse<T>, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Protected route helper - requires authentication
async function withAuth<T>(
  request: Request,
  handler: (auth: AuthContext) => Promise<ApiResponse<T>>,
  statusOnSuccess: number = 200
): Promise<Response> {
  const auth = await verifyAndGetUser(request);
  if (!auth) {
    return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
  }
  const result = await handler(auth);
  const status = result.success ? statusOnSuccess : (result.error?.code === "NOT_FOUND" ? 404 : 400);
  return json(result, status);
}

// Admin only route helper
async function withAdminAuth<T>(
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
  const status = result.success ? statusOnSuccess : (result.error?.code === "NOT_FOUND" ? 404 : 400);
  return json(result, status);
}

// Parse JSON body safely
async function parseBody<T = Record<string, unknown>>(request: Request): Promise<T | null> {
  try {
    const data = await request.json();
    return data as T;
  } catch {
    return null;
  }
}

// ============================================
// Health & Info Routes
// ============================================

registerRoute("GET", "/health", async () => {
  return json(
    successResponse({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    })
  );
});

registerRoute("GET", "/api/v1", async () => {
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
        tasks: "/api/v1/tasks",
        milestones: "/api/v1/milestones",
        reports: {
          users: "/api/v1/reports/users",
          companies: "/api/v1/reports/companies",
          quotes: "/api/v1/reports/quotes",
          invoices: "/api/v1/reports/invoices",
          deliveryNotes: "/api/v1/reports/delivery-notes",
          projects: "/api/v1/reports/projects",
          tasks: "/api/v1/reports/tasks",
          milestones: "/api/v1/reports/milestones",
          salesSummary: "/api/v1/reports/sales/summary",
          projectSummary: "/api/v1/reports/projects/summary",
        },
      },
    })
  );
});

// ============================================
// Auth Routes
// ============================================

registerRoute("POST", "/api/v1/auth/login", async (request, url) => {
  return loginHandler(request, url);
});

registerRoute("POST", "/api/v1/auth/logout", async (request, url) => {
  return logoutHandler(request, url);
});

registerRoute("POST", "/api/v1/auth/refresh", async (request, url) => {
  return refreshHandler(request, url);
});

registerRoute("GET", "/api/v1/auth/me", async (request, url) => {
  return meHandler(request, url);
});

registerRoute("POST", "/api/v1/auth/change-password", async (request, url) => {
  return changePasswordHandler(request, url);
});

// ============================================
// Companies Routes
// ============================================

registerRoute("GET", "/api/v1/companies", async (_request, url) => {
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
  const search = url.searchParams.get("search") || undefined;

  const result = await companiesService.getCompanies({ page, pageSize }, { search });
  return json(result);
});

registerRoute("GET", "/api/v1/companies/industries", async () => {
  const result = await companiesService.getIndustries();
  return json(result);
});

registerRoute("GET", "/api/v1/companies/:id", async (_, __, params) => {
  const result = await companiesService.getCompanyById(params.id);
  if (!result.success) {
    return json(result, 404);
  }
  return json(result);
});

registerRoute("POST", "/api/v1/companies", async (request) => {
  const body = await parseBody(request);
  if (!body) {
    return json(errorResponse("BAD_REQUEST", "Invalid JSON body"), 400);
  }
  const result = await companiesService.createCompany(body);
  if (!result.success && result.error?.code === "CONFLICT") {
    return json(result, 409);
  }
  if (!result.success && result.error?.code === "VALIDATION_ERROR") {
    return json(result, 400);
  }
  return json(result, 201);
});

registerRoute("PUT", "/api/v1/companies/:id", async (request, _, params) => {
  const body = await parseBody(request);
  if (!body) {
    return json(errorResponse("BAD_REQUEST", "Invalid JSON body"), 400);
  }
  const result = await companiesService.updateCompany(params.id, body);
  if (!result.success && result.error?.code === "NOT_FOUND") {
    return json(result, 404);
  }
  if (!result.success && result.error?.code === "CONFLICT") {
    return json(result, 409);
  }
  if (!result.success && result.error?.code === "VALIDATION_ERROR") {
    return json(result, 400);
  }
  return json(result);
});

registerRoute("DELETE", "/api/v1/companies/:id", async (request, _, params) => {
  return withAdminAuth(request, async (auth) => {
    const result = await companiesService.deleteCompany(params.id);
    if (result.success) {
      auditService.logAction({
        userId: auth.userId,
        action: "DELETE_COMPANY",
        entityType: "company",
        entityId: params.id,
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
      });
    }
    return result;
  });
});

// ============================================
// Users Routes
// ============================================

registerRoute("GET", "/api/v1/users", async (_request, url) => {
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
  const search = url.searchParams.get("search") || undefined;
  const role = url.searchParams.get("role") || undefined;

  const result = await usersService.getUsers({ page, pageSize }, { search, status: role });
  return json(result);
});

registerRoute("GET", "/api/v1/users/:id", async (_, __, params) => {
  const result = await usersService.getUserById(params.id);
  if (!result.success) {
    return json(result, 404);
  }
  return json(result);
});

registerRoute("POST", "/api/v1/users", async (request) => {
  const body = await parseBody(request);
  if (!body) {
    return json(errorResponse("BAD_REQUEST", "Invalid JSON body"), 400);
  }
  const result = await usersService.createUser(body);
  if (!result.success && result.error?.code === "CONFLICT") {
    return json(result, 409);
  }
  if (!result.success && result.error?.code === "VALIDATION_ERROR") {
    return json(result, 400);
  }
  return json(result, 201);
});

registerRoute("PUT", "/api/v1/users/:id", async (request, _, params) => {
  const body = await parseBody(request);
  if (!body) {
    return json(errorResponse("BAD_REQUEST", "Invalid JSON body"), 400);
  }
  const result = await usersService.updateUser(params.id, body);
  if (!result.success && result.error?.code === "NOT_FOUND") {
    return json(result, 404);
  }
  if (!result.success && result.error?.code === "CONFLICT") {
    return json(result, 409);
  }
  if (!result.success && result.error?.code === "VALIDATION_ERROR") {
    return json(result, 400);
  }
  return json(result);
});

registerRoute("DELETE", "/api/v1/users/:id", async (request, _, params) => {
  return withAdminAuth(request, async (auth) => {
    const result = await usersService.deleteUser(params.id);
    if (result.success) {
      auditService.logAction({
        userId: auth.userId,
        action: "DELETE_USER",
        entityType: "user",
        entityId: params.id,
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
      });
    }
    return result;
  });
});

// ============================================
// CRM Routes - Leads
// ============================================

registerRoute("GET", "/api/v1/leads", async (_request, url) => {
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
  const status = url.searchParams.get("status") || undefined;
  const search = url.searchParams.get("search") || undefined;

  const result = await crmService.getLeads({ page, pageSize }, { status, search });
  return json(result);
});

registerRoute("GET", "/api/v1/leads/:id", async (_, __, params) => {
  const result = await crmService.getLeadById(params.id);
  if (!result.success) {
    return json(result, 404);
  }
  return json(result);
});

registerRoute("POST", "/api/v1/leads", async (request) => {
  const body = await parseBody(request);
  if (!body) {
    return json(errorResponse("BAD_REQUEST", "Invalid JSON body"), 400);
  }
  const result = await crmService.createLead(body);
  return json(result, 201);
});

registerRoute("PUT", "/api/v1/leads/:id", async (request, _, params) => {
  const body = await parseBody(request);
  if (!body) {
    return json(errorResponse("BAD_REQUEST", "Invalid JSON body"), 400);
  }
  const result = await crmService.updateLead(params.id, body);
  if (!result.success) {
    return json(result, 404);
  }
  return json(result);
});

registerRoute("DELETE", "/api/v1/leads/:id", async (_, __, params) => {
  const result = await crmService.deleteLead(params.id);
  if (!result.success) {
    return json(result, 404);
  }
  return json(result);
});

// ============================================
// CRM Routes - Contacts
// ============================================

registerRoute("GET", "/api/v1/contacts", async (_request, url) => {
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
  const search = url.searchParams.get("search") || undefined;

  const result = await crmService.getContacts({ page, pageSize }, { search });
  return json(result);
});

registerRoute("GET", "/api/v1/contacts/:id", async (_, __, params) => {
  const result = await crmService.getContactById(params.id);
  if (!result.success) {
    return json(result, 404);
  }
  return json(result);
});

registerRoute("POST", "/api/v1/contacts", async (request) => {
  const body = await parseBody(request);
  if (!body) {
    return json(errorResponse("BAD_REQUEST", "Invalid JSON body"), 400);
  }
  const result = await crmService.createContact(body);
  return json(result, 201);
});

// ============================================
// Sales Routes - Deals
// ============================================

registerRoute("GET", "/api/v1/deals", async (_request, url) => {
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
  const stage = url.searchParams.get("stage") || undefined;

  const result = await salesService.getDeals({ page, pageSize }, { status: stage });
  return json(result);
});

registerRoute("GET", "/api/v1/deals/:id", async (_, __, params) => {
  const result = await salesService.getDealById(params.id);
  if (!result.success) {
    return json(result, 404);
  }
  return json(result);
});

registerRoute("POST", "/api/v1/deals", async (request) => {
  const body = await parseBody(request);
  if (!body) {
    return json(errorResponse("BAD_REQUEST", "Invalid JSON body"), 400);
  }
  const result = await salesService.createDeal(body);
  return json(result, 201);
});

registerRoute("PUT", "/api/v1/deals/:id", async (request, _, params) => {
  const body = await parseBody(request);
  if (!body) {
    return json(errorResponse("BAD_REQUEST", "Invalid JSON body"), 400);
  }
  const result = await salesService.updateDeal(params.id, body);
  if (!result.success) {
    return json(result, 404);
  }
  return json(result);
});

registerRoute("GET", "/api/v1/deals/pipeline/summary", async () => {
  const result = await salesService.getPipelineSummary();
  return json(result);
});

// ============================================
// Sales Routes - Quotes (Ponude)
// ============================================

registerRoute("GET", "/api/v1/quotes", async (_request, url) => {
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
  const status = url.searchParams.get("status") || undefined;
  const search = url.searchParams.get("search") || undefined;

  const result = await salesService.getQuotes({ page, pageSize }, { status, search });
  return json(result);
});

registerRoute("GET", "/api/v1/quotes/:id", async (_, __, params) => {
  const result = await salesService.getQuoteById(params.id);
  if (!result.success) {
    return json(result, 404);
  }
  return json(result);
});

registerRoute("POST", "/api/v1/quotes", async (request) => {
  const body = await parseBody(request);
  if (!body) {
    return json(errorResponse("BAD_REQUEST", "Invalid JSON body"), 400);
  }
  const result = await salesService.createQuote(body);
  if (!result.success && result.error?.code === "VALIDATION_ERROR") {
    return json(result, 400);
  }
  return json(result, 201);
});

registerRoute("PUT", "/api/v1/quotes/:id", async (request, _, params) => {
  const body = await parseBody(request);
  if (!body) {
    return json(errorResponse("BAD_REQUEST", "Invalid JSON body"), 400);
  }
  const result = await salesService.updateQuote(params.id, body);
  if (!result.success && result.error?.code === "NOT_FOUND") {
    return json(result, 404);
  }
  if (!result.success && result.error?.code === "VALIDATION_ERROR") {
    return json(result, 400);
  }
  return json(result);
});

registerRoute("DELETE", "/api/v1/quotes/:id", async (_, __, params) => {
  const result = await salesService.deleteQuote(params.id);
  if (!result.success) {
    return json(result, 404);
  }
  return json(result);
});

// ============================================
// Sales Routes - Invoices (Fakture)
// ============================================

registerRoute("GET", "/api/v1/invoices", async (_request, url) => {
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
  const status = url.searchParams.get("status") || undefined;
  const search = url.searchParams.get("search") || undefined;

  const result = await salesService.getInvoices({ page, pageSize }, { status, search });
  return json(result);
});

registerRoute("GET", "/api/v1/invoices/overdue", async () => {
  const result = await salesService.getOverdueInvoices();
  return json(result);
});

registerRoute("GET", "/api/v1/invoices/:id", async (_, __, params) => {
  const result = await salesService.getInvoiceById(params.id);
  if (!result.success) {
    return json(result, 404);
  }
  return json(result);
});

registerRoute("POST", "/api/v1/invoices", async (request) => {
  const body = await parseBody(request);
  if (!body) {
    return json(errorResponse("BAD_REQUEST", "Invalid JSON body"), 400);
  }
  const result = await salesService.createInvoice(body);
  if (!result.success && result.error?.code === "VALIDATION_ERROR") {
    return json(result, 400);
  }
  return json(result, 201);
});

registerRoute("PUT", "/api/v1/invoices/:id", async (request, _, params) => {
  const body = await parseBody(request);
  if (!body) {
    return json(errorResponse("BAD_REQUEST", "Invalid JSON body"), 400);
  }
  const result = await salesService.updateInvoice(params.id, body);
  if (!result.success && result.error?.code === "NOT_FOUND") {
    return json(result, 404);
  }
  if (!result.success && result.error?.code === "VALIDATION_ERROR") {
    return json(result, 400);
  }
  return json(result);
});

registerRoute("DELETE", "/api/v1/invoices/:id", async (_, __, params) => {
  const result = await salesService.deleteInvoice(params.id);
  if (!result.success) {
    return json(result, 404);
  }
  return json(result);
});

registerRoute("POST", "/api/v1/invoices/:id/payment", async (request, _, params) => {
  const body = await parseBody<{ amount: number }>(request);
  if (!body || typeof body.amount !== "number") {
    return json(errorResponse("BAD_REQUEST", "Amount is required"), 400);
  }
  const result = await salesService.recordPayment(params.id, body.amount);
  if (!result.success) {
    return json(result, 404);
  }
  return json(result);
});

// ============================================
// Sales Routes - Delivery Notes (Otpremnice)
// ============================================

registerRoute("GET", "/api/v1/delivery-notes", async (_request, url) => {
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
  const status = url.searchParams.get("status") || undefined;
  const search = url.searchParams.get("search") || undefined;

  const result = await salesService.getDeliveryNotes({ page, pageSize }, { status, search });
  return json(result);
});

registerRoute("GET", "/api/v1/delivery-notes/pending", async () => {
  const result = await salesService.getPendingDeliveries();
  return json(result);
});

registerRoute("GET", "/api/v1/delivery-notes/in-transit", async () => {
  const result = await salesService.getInTransitDeliveries();
  return json(result);
});

registerRoute("GET", "/api/v1/delivery-notes/:id", async (_, __, params) => {
  const result = await salesService.getDeliveryNoteById(params.id);
  if (!result.success) {
    return json(result, 404);
  }
  return json(result);
});

registerRoute("POST", "/api/v1/delivery-notes", async (request) => {
  const body = await parseBody(request);
  if (!body) {
    return json(errorResponse("BAD_REQUEST", "Invalid JSON body"), 400);
  }
  const result = await salesService.createDeliveryNote(body);
  if (!result.success && result.error?.code === "VALIDATION_ERROR") {
    return json(result, 400);
  }
  return json(result, 201);
});

registerRoute("PUT", "/api/v1/delivery-notes/:id", async (request, _, params) => {
  const body = await parseBody(request);
  if (!body) {
    return json(errorResponse("BAD_REQUEST", "Invalid JSON body"), 400);
  }
  const result = await salesService.updateDeliveryNote(params.id, body);
  if (!result.success && result.error?.code === "NOT_FOUND") {
    return json(result, 404);
  }
  if (!result.success && result.error?.code === "VALIDATION_ERROR") {
    return json(result, 400);
  }
  return json(result);
});

registerRoute("DELETE", "/api/v1/delivery-notes/:id", async (_, __, params) => {
  const result = await salesService.deleteDeliveryNote(params.id);
  if (!result.success) {
    return json(result, 404);
  }
  return json(result);
});

// ============================================
// Project Routes
// ============================================

registerRoute("GET", "/api/v1/projects", async (_request, url) => {
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
  const status = url.searchParams.get("status") || undefined;
  const search = url.searchParams.get("search") || undefined;

  const result = await projectsService.getProjects({ page, pageSize }, { status, search });
  return json(result);
});

registerRoute("GET", "/api/v1/projects/:id", async (_, __, params) => {
  const result = await projectsService.getProjectById(params.id);
  if (!result.success) {
    return json(result, 404);
  }
  return json(result);
});

registerRoute("POST", "/api/v1/projects", async (request) => {
  const body = await parseBody(request);
  if (!body) {
    return json(errorResponse("BAD_REQUEST", "Invalid JSON body"), 400);
  }
  const result = await projectsService.createProject(body);
  if (!result.success && result.error?.code === "VALIDATION_ERROR") {
    return json(result, 400);
  }
  return json(result, 201);
});

registerRoute("PUT", "/api/v1/projects/:id", async (request, _, params) => {
  const body = await parseBody(request);
  if (!body) {
    return json(errorResponse("BAD_REQUEST", "Invalid JSON body"), 400);
  }
  const result = await projectsService.updateProject(params.id, body);
  if (!result.success && result.error?.code === "NOT_FOUND") {
    return json(result, 404);
  }
  if (!result.success && result.error?.code === "VALIDATION_ERROR") {
    return json(result, 400);
  }
  return json(result);
});

registerRoute("DELETE", "/api/v1/projects/:id", async (_, __, params) => {
  const result = await projectsService.deleteProject(params.id);
  if (!result.success) {
    return json(result, 404);
  }
  return json(result);
});

// Project-specific tasks and milestones
registerRoute("GET", "/api/v1/projects/:projectId/tasks", async (_, url, params) => {
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);

  const result = await projectsService.getProjectTasks(params.projectId, { page, pageSize });
  return json(result);
});

registerRoute("POST", "/api/v1/projects/:projectId/tasks", async (request, _, params) => {
  const body = await parseBody(request);
  if (!body) {
    return json(errorResponse("BAD_REQUEST", "Invalid JSON body"), 400);
  }
  const result = await projectsService.createTask(params.projectId, body);
  if (!result.success && result.error?.code === "VALIDATION_ERROR") {
    return json(result, 400);
  }
  return json(result, 201);
});

registerRoute("GET", "/api/v1/projects/:projectId/milestones", async (_, __, params) => {
  const result = await projectsService.getProjectMilestones(params.projectId);
  return json(result);
});

// ============================================
// Task Routes (Standalone)
// ============================================

registerRoute("GET", "/api/v1/tasks", async (_request, url) => {
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
  const status = url.searchParams.get("status") || undefined;
  const search = url.searchParams.get("search") || undefined;
  const projectId = url.searchParams.get("projectId") || undefined;
  const milestoneId = url.searchParams.get("milestoneId") || undefined;
  const assignedTo = url.searchParams.get("assignedTo") || undefined;

  const result = await projectsService.getTasks(
    { page, pageSize },
    { status, search, projectId, milestoneId, assignedTo }
  );
  return json(result);
});

registerRoute("GET", "/api/v1/tasks/:id", async (_, __, params) => {
  const result = await projectsService.getTaskById(params.id);
  if (!result.success) {
    return json(result, 404);
  }
  return json(result);
});

registerRoute("POST", "/api/v1/tasks", async (request) => {
  const body = await parseBody(request);
  if (!body) {
    return json(errorResponse("BAD_REQUEST", "Invalid JSON body"), 400);
  }
  const result = await projectsService.createTaskStandalone(body);
  if (!result.success && result.error?.code === "NOT_FOUND") {
    return json(result, 404);
  }
  if (!result.success && result.error?.code === "VALIDATION_ERROR") {
    return json(result, 400);
  }
  return json(result, 201);
});

registerRoute("PUT", "/api/v1/tasks/:id", async (request, _, params) => {
  const body = await parseBody(request);
  if (!body) {
    return json(errorResponse("BAD_REQUEST", "Invalid JSON body"), 400);
  }
  const result = await projectsService.updateTask(params.id, body);
  if (!result.success && result.error?.code === "NOT_FOUND") {
    return json(result, 404);
  }
  if (!result.success && result.error?.code === "VALIDATION_ERROR") {
    return json(result, 400);
  }
  return json(result);
});

registerRoute("DELETE", "/api/v1/tasks/:id", async (_, __, params) => {
  const result = await projectsService.deleteTask(params.id);
  if (!result.success) {
    return json(result, 404);
  }
  return json(result);
});

// ============================================
// Milestone Routes
// ============================================

registerRoute("GET", "/api/v1/milestones", async (_request, url) => {
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
  const status = url.searchParams.get("status") || undefined;
  const search = url.searchParams.get("search") || undefined;
  const projectId = url.searchParams.get("projectId") || undefined;

  const result = await projectsService.getMilestones(
    { page, pageSize },
    { status, search, projectId }
  );
  return json(result);
});

registerRoute("GET", "/api/v1/milestones/:id", async (_, __, params) => {
  const result = await projectsService.getMilestoneById(params.id);
  if (!result.success) {
    return json(result, 404);
  }
  return json(result);
});

registerRoute("POST", "/api/v1/milestones", async (request) => {
  const body = await parseBody(request);
  if (!body) {
    return json(errorResponse("BAD_REQUEST", "Invalid JSON body"), 400);
  }
  const result = await projectsService.createMilestone(body);
  if (!result.success && result.error?.code === "NOT_FOUND") {
    return json(result, 404);
  }
  if (!result.success && result.error?.code === "VALIDATION_ERROR") {
    return json(result, 400);
  }
  return json(result, 201);
});

registerRoute("PUT", "/api/v1/milestones/:id", async (request, _, params) => {
  const body = await parseBody(request);
  if (!body) {
    return json(errorResponse("BAD_REQUEST", "Invalid JSON body"), 400);
  }
  const result = await projectsService.updateMilestone(params.id, body);
  if (!result.success && result.error?.code === "NOT_FOUND") {
    return json(result, 404);
  }
  if (!result.success && result.error?.code === "VALIDATION_ERROR") {
    return json(result, 400);
  }
  return json(result);
});

registerRoute("DELETE", "/api/v1/milestones/:id", async (_, __, params) => {
  const result = await projectsService.deleteMilestone(params.id);
  if (!result.success) {
    return json(result, 404);
  }
  return json(result);
});

registerRoute("POST", "/api/v1/milestones/:id/complete", async (_, __, params) => {
  const result = await projectsService.markMilestoneCompleted(params.id);
  if (!result.success) {
    return json(result, 404);
  }
  return json(result);
});

// ============================================
// Product Catalog Routes - Categories
// ============================================

registerRoute("GET", "/api/v1/product-categories", async (_request, url) => {
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "50", 10);
  const search = url.searchParams.get("search") || undefined;
  const parentId = url.searchParams.get("parentId") || undefined;
  const isActive = url.searchParams.get("isActive") === "true" ? true : 
                   url.searchParams.get("isActive") === "false" ? false : undefined;

  const result = await productCategoryService.getCategories(
    { page, pageSize },
    { search, parentId, isActive }
  );
  return json(result);
});

registerRoute("GET", "/api/v1/product-categories/:id", async (_, __, params) => {
  const result = await productCategoryService.getCategoryById(params.id);
  if (!result.success) {
    return json(result, 404);
  }
  return json(result);
});

registerRoute("POST", "/api/v1/product-categories", async (request) => {
  const body = await parseBody(request);
  if (!body) {
    return json(errorResponse("BAD_REQUEST", "Invalid JSON body"), 400);
  }
  const result = await productCategoryService.createCategory(body);
  if (!result.success && result.error?.code === "VALIDATION_ERROR") {
    return json(result, 400);
  }
  return json(result, 201);
});

registerRoute("PUT", "/api/v1/product-categories/:id", async (request, _, params) => {
  const body = await parseBody(request);
  if (!body) {
    return json(errorResponse("BAD_REQUEST", "Invalid JSON body"), 400);
  }
  const result = await productCategoryService.updateCategory(params.id, body);
  if (!result.success && result.error?.code === "NOT_FOUND") {
    return json(result, 404);
  }
  return json(result);
});

registerRoute("DELETE", "/api/v1/product-categories/:id", async (_, __, params) => {
  const result = await productCategoryService.deleteCategory(params.id);
  if (!result.success) {
    return json(result, 404);
  }
  return json(result);
});

// ============================================
// Product Catalog Routes - Products
// ============================================

registerRoute("GET", "/api/v1/products", async (_request, url) => {
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
  const search = url.searchParams.get("search") || undefined;
  const categoryId = url.searchParams.get("categoryId") || undefined;
  const isActive = url.searchParams.get("isActive") === "true" ? true : 
                   url.searchParams.get("isActive") === "false" ? false : undefined;
  const isService = url.searchParams.get("isService") === "true" ? true : 
                    url.searchParams.get("isService") === "false" ? false : undefined;
  const minPrice = url.searchParams.get("minPrice") ? parseFloat(url.searchParams.get("minPrice")!) : undefined;
  const maxPrice = url.searchParams.get("maxPrice") ? parseFloat(url.searchParams.get("maxPrice")!) : undefined;

  const result = await productsService.getProducts(
    { page, pageSize },
    { search, categoryId, isActive, isService, minPrice, maxPrice }
  );
  return json(result);
});

registerRoute("GET", "/api/v1/products/low-stock", async () => {
  const result = await productsService.getLowStockProducts();
  return json(result);
});

registerRoute("GET", "/api/v1/products/sku/:sku", async (_, __, params) => {
  const result = await productsService.getProductBySku(params.sku);
  if (!result.success) {
    return json(result, 404);
  }
  return json(result);
});

registerRoute("GET", "/api/v1/products/:id", async (_, __, params) => {
  const result = await productsService.getProductById(params.id);
  if (!result.success) {
    return json(result, 404);
  }
  return json(result);
});

registerRoute("POST", "/api/v1/products", async (request) => {
  const body = await parseBody(request);
  if (!body) {
    return json(errorResponse("BAD_REQUEST", "Invalid JSON body"), 400);
  }
  const result = await productsService.createProduct(body);
  if (!result.success && result.error?.code === "VALIDATION_ERROR") {
    return json(result, 400);
  }
  if (!result.success && result.error?.code === "CONFLICT") {
    return json(result, 409);
  }
  return json(result, 201);
});

registerRoute("PUT", "/api/v1/products/:id", async (request, _, params) => {
  const body = await parseBody(request);
  if (!body) {
    return json(errorResponse("BAD_REQUEST", "Invalid JSON body"), 400);
  }
  const result = await productsService.updateProduct(params.id, body);
  if (!result.success && result.error?.code === "NOT_FOUND") {
    return json(result, 404);
  }
  if (!result.success && result.error?.code === "CONFLICT") {
    return json(result, 409);
  }
  return json(result);
});

registerRoute("DELETE", "/api/v1/products/:id", async (_, __, params) => {
  const result = await productsService.deleteProduct(params.id);
  if (!result.success) {
    return json(result, 404);
  }
  return json(result);
});

registerRoute("PATCH", "/api/v1/products/:id/stock", async (request, _, params) => {
  const body = await parseBody<{ quantity: number }>(request);
  if (!body || typeof body.quantity !== "number") {
    return json(errorResponse("BAD_REQUEST", "Quantity is required"), 400);
  }
  const result = await productsService.updateStock(params.id, body.quantity);
  if (!result.success) {
    return json(result, result.error?.code === "NOT_FOUND" ? 404 : 400);
  }
  return json(result);
});

// ============================================
// Notifications Routes (requires auth)
// ============================================

registerRoute("GET", "/api/v1/notifications", async (request, url) => {
  const authResult = await withAuth(request);
  if (!authResult.success) return json(authResult, 401);
  
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
  const isRead = url.searchParams.get("isRead") === "true" ? true : 
                 url.searchParams.get("isRead") === "false" ? false : undefined;
  const type = url.searchParams.get("type") || undefined;
  const entityType = url.searchParams.get("entityType") || undefined;

  const result = await notificationsService.getNotifications(
    authResult.user.id,
    { page, pageSize },
    { isRead, type: type as any, entityType }
  );
  return json(result);
});

registerRoute("GET", "/api/v1/notifications/unread-count", async (request) => {
  const authResult = await withAuth(request);
  if (!authResult.success) return json(authResult, 401);
  
  const result = await notificationsService.getUnreadCount(authResult.user.id);
  return json(result);
});

registerRoute("GET", "/api/v1/notifications/:id", async (request, _, params) => {
  const authResult = await withAuth(request);
  if (!authResult.success) return json(authResult, 401);
  
  const result = await notificationsService.getNotificationById(params.id, authResult.user.id);
  if (!result.success && result.error?.code === "NOT_FOUND") {
    return json(result, 404);
  }
  if (!result.success && result.error?.code === "FORBIDDEN") {
    return json(result, 403);
  }
  return json(result);
});

registerRoute("POST", "/api/v1/notifications", async (request) => {
  const authResult = await withAdminAuth(request);
  if (!authResult.success) return json(authResult, authResult.error?.code === "UNAUTHORIZED" ? 401 : 403);
  
  const body = await parseBody(request);
  if (!body) {
    return json(errorResponse("BAD_REQUEST", "Invalid JSON body"), 400);
  }
  
  const result = await notificationsService.createNotification(body);
  if (!result.success && result.error?.code === "VALIDATION_ERROR") {
    return json(result, 400);
  }
  if (!result.success && result.error?.code === "NOT_FOUND") {
    return json(result, 404);
  }
  return json(result, 201);
});

registerRoute("POST", "/api/v1/notifications/bulk", async (request) => {
  const authResult = await withAdminAuth(request);
  if (!authResult.success) return json(authResult, authResult.error?.code === "UNAUTHORIZED" ? 401 : 403);
  
  const body = await parseBody(request);
  if (!body) {
    return json(errorResponse("BAD_REQUEST", "Invalid JSON body"), 400);
  }
  
  const result = await notificationsService.createBulkNotifications(body);
  if (!result.success && result.error?.code === "VALIDATION_ERROR") {
    return json(result, 400);
  }
  return json(result, 201);
});

registerRoute("PUT", "/api/v1/notifications/:id/read", async (request, _, params) => {
  const authResult = await withAuth(request);
  if (!authResult.success) return json(authResult, 401);
  
  const result = await notificationsService.markAsRead(params.id, authResult.user.id);
  if (!result.success && result.error?.code === "NOT_FOUND") {
    return json(result, 404);
  }
  if (!result.success && result.error?.code === "FORBIDDEN") {
    return json(result, 403);
  }
  return json(result);
});

registerRoute("PUT", "/api/v1/notifications/read-all", async (request) => {
  const authResult = await withAuth(request);
  if (!authResult.success) return json(authResult, 401);
  
  const result = await notificationsService.markAllAsRead(authResult.user.id);
  return json(result);
});

registerRoute("DELETE", "/api/v1/notifications/:id", async (request, _, params) => {
  const authResult = await withAuth(request);
  if (!authResult.success) return json(authResult, 401);
  
  const result = await notificationsService.deleteNotification(params.id, authResult.user.id);
  if (!result.success && result.error?.code === "NOT_FOUND") {
    return json(result, 404);
  }
  if (!result.success && result.error?.code === "FORBIDDEN") {
    return json(result, 403);
  }
  return json(result);
});

// ============================================
// Payment Routes
// ============================================

registerRoute("GET", "/api/v1/payments", async (request, url) => {
  const authResult = await withAuth(request);
  if (!authResult.success) return json(authResult, 401);
  
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
  const invoiceId = url.searchParams.get("invoiceId") || undefined;
  const status = url.searchParams.get("status") || undefined;
  const paymentMethod = url.searchParams.get("paymentMethod") || undefined;
  const dateFrom = url.searchParams.get("dateFrom") || undefined;
  const dateTo = url.searchParams.get("dateTo") || undefined;

  const result = await paymentsService.getPayments(
    { page, pageSize },
    { invoiceId, status: status as any, paymentMethod: paymentMethod as any, dateFrom, dateTo }
  );
  return json(result);
});

registerRoute("GET", "/api/v1/payments/stats", async (request, url) => {
  const authResult = await withAuth(request);
  if (!authResult.success) return json(authResult, 401);
  
  const dateFrom = url.searchParams.get("dateFrom") || undefined;
  const dateTo = url.searchParams.get("dateTo") || undefined;

  const result = await paymentsService.getPaymentStats({ dateFrom, dateTo });
  return json(result);
});

registerRoute("GET", "/api/v1/payments/:id", async (request, _, params) => {
  const authResult = await withAuth(request);
  if (!authResult.success) return json(authResult, 401);
  
  const result = await paymentsService.getPaymentById(params.id);
  if (!result.success && result.error?.code === "NOT_FOUND") {
    return json(result, 404);
  }
  return json(result);
});

registerRoute("POST", "/api/v1/payments", async (request) => {
  const authResult = await withAuth(request);
  if (!authResult.success) return json(authResult, 401);
  
  const body = await parseBody(request);
  if (!body) {
    return json(errorResponse("BAD_REQUEST", "Invalid JSON body"), 400);
  }
  
  const result = await paymentsService.recordPayment(body, authResult.user.id);
  if (!result.success && result.error?.code === "VALIDATION_ERROR") {
    return json(result, 400);
  }
  if (!result.success && result.error?.code === "NOT_FOUND") {
    return json(result, 404);
  }
  if (!result.success && result.error?.code === "CONFLICT") {
    return json(result, 409);
  }
  return json(result, 201);
});

registerRoute("PUT", "/api/v1/payments/:id", async (request, _, params) => {
  const authResult = await withAuth(request);
  if (!authResult.success) return json(authResult, 401);
  
  const body = await parseBody(request);
  if (!body) {
    return json(errorResponse("BAD_REQUEST", "Invalid JSON body"), 400);
  }
  
  const result = await paymentsService.updatePayment(params.id, body);
  if (!result.success && result.error?.code === "NOT_FOUND") {
    return json(result, 404);
  }
  return json(result);
});

registerRoute("POST", "/api/v1/payments/:id/refund", async (request, _, params) => {
  const authResult = await withAuth(request);
  if (!authResult.success) return json(authResult, 401);
  
  const result = await paymentsService.refundPayment(params.id);
  if (!result.success && result.error?.code === "NOT_FOUND") {
    return json(result, 404);
  }
  if (!result.success && result.error?.code === "CONFLICT") {
    return json(result, 409);
  }
  if (!result.success && result.error?.code === "BAD_REQUEST") {
    return json(result, 400);
  }
  return json(result);
});

registerRoute("DELETE", "/api/v1/payments/:id", async (request, _, params) => {
  const authResult = await withAuth(request);
  if (!authResult.success) return json(authResult, 401);
  
  const result = await paymentsService.deletePayment(params.id);
  if (!result.success && result.error?.code === "NOT_FOUND") {
    return json(result, 404);
  }
  if (!result.success && result.error?.code === "BAD_REQUEST") {
    return json(result, 400);
  }
  return json(result);
});

// Invoice-specific payment endpoints
registerRoute("GET", "/api/v1/invoices/:id/payments", async (request, _, params) => {
  const authResult = await withAuth(request);
  if (!authResult.success) return json(authResult, 401);
  
  const result = await paymentsService.getPaymentsByInvoice(params.id);
  return json(result);
});

registerRoute("GET", "/api/v1/invoices/:id/payment-summary", async (request, _, params) => {
  const authResult = await withAuth(request);
  if (!authResult.success) return json(authResult, 401);
  
  const result = await paymentsService.getInvoicePaymentSummary(params.id);
  return json(result);
});

// ============================================
// Reporting & Analytics Routes
// ============================================

// CRM Reports
registerRoute("GET", "/api/v1/reports/users", async (_request, url) => {
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
  const sortBy = url.searchParams.get("sortBy") || undefined;
  const sortOrder = (url.searchParams.get("sortOrder") as "asc" | "desc") || undefined;
  const search = url.searchParams.get("search") || undefined;
  const companyId = url.searchParams.get("companyId") || undefined;
  const role = url.searchParams.get("role") || undefined;
  const status = url.searchParams.get("status") || undefined;

  const result = await reportsService.getUsersReport(
    { page, pageSize, sortBy, sortOrder },
    { search, companyId, role, status }
  );
  return json(result);
});

registerRoute("GET", "/api/v1/reports/companies", async (_request, url) => {
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
  const sortBy = url.searchParams.get("sortBy") || undefined;
  const sortOrder = (url.searchParams.get("sortOrder") as "asc" | "desc") || undefined;
  const search = url.searchParams.get("search") || undefined;
  const industry = url.searchParams.get("industry") || undefined;

  const result = await reportsService.getCompaniesReport(
    { page, pageSize, sortBy, sortOrder },
    { search, industry }
  );
  return json(result);
});

// Sales Reports
registerRoute("GET", "/api/v1/reports/quotes", async (_request, url) => {
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
  const sortBy = url.searchParams.get("sortBy") || undefined;
  const sortOrder = (url.searchParams.get("sortOrder") as "asc" | "desc") || undefined;
  const status = url.searchParams.get("status") || undefined;
  const companyId = url.searchParams.get("companyId") || undefined;
  const userId = url.searchParams.get("userId") || undefined;
  const startDate = url.searchParams.get("startDate") || undefined;
  const endDate = url.searchParams.get("endDate") || undefined;

  const result = await reportsService.getQuotesReport(
    { page, pageSize, sortBy, sortOrder },
    { status, companyId, userId },
    { startDate, endDate }
  );
  return json(result);
});

registerRoute("GET", "/api/v1/reports/invoices", async (_request, url) => {
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
  const sortBy = url.searchParams.get("sortBy") || undefined;
  const sortOrder = (url.searchParams.get("sortOrder") as "asc" | "desc") || undefined;
  const status = url.searchParams.get("status") || undefined;
  const companyId = url.searchParams.get("companyId") || undefined;
  const startDate = url.searchParams.get("startDate") || undefined;
  const endDate = url.searchParams.get("endDate") || undefined;

  const result = await reportsService.getInvoicesReport(
    { page, pageSize, sortBy, sortOrder },
    { status, companyId },
    { startDate, endDate }
  );
  return json(result);
});

registerRoute("GET", "/api/v1/reports/delivery-notes", async (_request, url) => {
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
  const sortBy = url.searchParams.get("sortBy") || undefined;
  const sortOrder = (url.searchParams.get("sortOrder") as "asc" | "desc") || undefined;
  const status = url.searchParams.get("status") || undefined;
  const companyId = url.searchParams.get("companyId") || undefined;
  const startDate = url.searchParams.get("startDate") || undefined;
  const endDate = url.searchParams.get("endDate") || undefined;

  const result = await reportsService.getDeliveryNotesReport(
    { page, pageSize, sortBy, sortOrder },
    { status, companyId },
    { startDate, endDate }
  );
  return json(result);
});

// Project Reports
registerRoute("GET", "/api/v1/reports/projects", async (_request, url) => {
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
  const sortBy = url.searchParams.get("sortBy") || undefined;
  const sortOrder = (url.searchParams.get("sortOrder") as "asc" | "desc") || undefined;
  const status = url.searchParams.get("status") || undefined;
  const userId = url.searchParams.get("userId") || undefined;
  const search = url.searchParams.get("search") || undefined;

  const result = await reportsService.getProjectsReport(
    { page, pageSize, sortBy, sortOrder },
    { status, userId, search }
  );
  return json(result);
});

registerRoute("GET", "/api/v1/reports/tasks", async (_request, url) => {
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
  const sortBy = url.searchParams.get("sortBy") || undefined;
  const sortOrder = (url.searchParams.get("sortOrder") as "asc" | "desc") || undefined;
  const status = url.searchParams.get("status") || undefined;
  const projectId = url.searchParams.get("projectId") || undefined;
  const assignedTo = url.searchParams.get("assignedTo") || undefined;
  const search = url.searchParams.get("search") || undefined;

  const result = await reportsService.getTasksReport(
    { page, pageSize, sortBy, sortOrder },
    { status, projectId, assignedTo, search }
  );
  return json(result);
});

registerRoute("GET", "/api/v1/reports/milestones", async (_request, url) => {
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
  const sortBy = url.searchParams.get("sortBy") || undefined;
  const sortOrder = (url.searchParams.get("sortOrder") as "asc" | "desc") || undefined;
  const status = url.searchParams.get("status") || undefined;
  const projectId = url.searchParams.get("projectId") || undefined;
  const search = url.searchParams.get("search") || undefined;

  const result = await reportsService.getMilestonesReport(
    { page, pageSize, sortBy, sortOrder },
    { status, projectId, search }
  );
  return json(result);
});

// Summary/Dashboard Reports
registerRoute("GET", "/api/v1/reports/sales/summary", async () => {
  const result = await reportsService.getSalesSummary();
  return json(result);
});

registerRoute("GET", "/api/v1/reports/projects/summary", async () => {
  const result = await reportsService.getProjectSummary();
  return json(result);
});

// ============================================
// Analytics Routes
// ============================================

// Sales Analytics
registerRoute("GET", "/api/v1/analytics/sales/revenue", async (_request, url) => {
  const from = url.searchParams.get("from") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const to = url.searchParams.get("to") || new Date().toISOString();
  
  const result = await reportsService.getRevenueOverTime({ from, to });
  return json(result);
});

registerRoute("GET", "/api/v1/analytics/sales/by-company", async (_request, url) => {
  const from = url.searchParams.get("from") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const to = url.searchParams.get("to") || new Date().toISOString();
  const limit = parseInt(url.searchParams.get("limit") || "10", 10);
  
  const result = await reportsService.getRevenueByCompany({ from, to }, limit);
  return json(result);
});

registerRoute("GET", "/api/v1/analytics/sales/top-customers", async (_request, url) => {
  const from = url.searchParams.get("from") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const to = url.searchParams.get("to") || new Date().toISOString();
  const limit = parseInt(url.searchParams.get("limit") || "10", 10);
  
  const result = await reportsService.getTopCustomers({ from, to }, limit);
  return json(result);
});

registerRoute("GET", "/api/v1/analytics/sales/conversion-funnel", async (_request, url) => {
  const from = url.searchParams.get("from") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const to = url.searchParams.get("to") || new Date().toISOString();
  
  const result = await reportsService.getConversionFunnel({ from, to });
  return json(result);
});

registerRoute("GET", "/api/v1/analytics/sales/invoice-status", async (_request, url) => {
  const from = url.searchParams.get("from") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const to = url.searchParams.get("to") || new Date().toISOString();
  
  const result = await reportsService.getInvoiceStatusBreakdown({ from, to });
  return json(result);
});

// Project Analytics
registerRoute("GET", "/api/v1/analytics/projects/task-stats", async (_request, url) => {
  const from = url.searchParams.get("from") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const to = url.searchParams.get("to") || new Date().toISOString();
  const projectId = url.searchParams.get("projectId") || undefined;
  
  const result = await reportsService.getTaskStatsOverTime({ from, to }, projectId);
  return json(result);
});

registerRoute("GET", "/api/v1/analytics/projects/milestone-breakdown", async (_request, url) => {
  const projectId = url.searchParams.get("projectId") || undefined;
  
  const result = await reportsService.getMilestoneBreakdown(projectId);
  return json(result);
});

registerRoute("GET", "/api/v1/analytics/projects/tasks-by-priority", async (_request, url) => {
  const projectId = url.searchParams.get("projectId") || undefined;
  
  const result = await reportsService.getTasksByPriority(projectId);
  return json(result);
});

registerRoute("GET", "/api/v1/analytics/projects/duration-stats", async () => {
  const result = await reportsService.getProjectDurationStats();
  return json(result);
});

// ============================================
// External API (Third-Party Access)
// ============================================

// Helper for authenticated external routes
async function withApiAuth(
  request: Request,
  requiredScope: ApiScope,
  handler: () => Promise<Response>
): Promise<Response> {
  const startTime = Date.now();
  
  // Authenticate
  const auth = await authenticateApiKey(request);
  if (!auth.authenticated) {
    return apiErrorResponse(
      "UNAUTHORIZED",
      auth.error || "Authentication required",
      auth.statusCode || 401
    );
  }

  // Check scope
  if (!hasScope(auth.apiKey!, requiredScope)) {
    return apiErrorResponse(
      "FORBIDDEN",
      `Missing required scope: ${requiredScope}`,
      403
    );
  }

  // Rate limiting
  const rateLimit = await checkRateLimit(`api:${auth.apiKey!.userId}`);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit);
  }

  // Execute handler
  try {
    const response = await handler();
    
    // Clone the response to allow body reading and reuse
    const clonedResponse = response.clone();
    const body = await clonedResponse.text();
    
    // Add rate limit headers
    const headers = new Headers(response.headers);
    const rateLimitHeaders = getRateLimitHeaders(rateLimit);
    for (const [key, value] of Object.entries(rateLimitHeaders)) {
      headers.set(key, value);
    }

    // Log request (async, don't await)
    logApiRequest({
      timestamp: now(),
      method: request.method,
      path: new URL(request.url).pathname,
      apiKeyName: auth.apiKey?.name,
      userId: auth.apiKey?.userId,
      statusCode: response.status,
      responseTimeMs: Date.now() - startTime,
      userAgent: request.headers.get("User-Agent") || undefined,
    });

    return new Response(body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    console.error("Error in withApiAuth handler:", error);
    return apiErrorResponse("INTERNAL_ERROR", "Internal server error", 500);
  }
}

// External API Info
registerRoute("GET", "/api/external/v1", async () => {
  return json(
    successResponse({
      name: "CRM External API",
      version: "1.0.0",
      authentication: "Bearer token or X-API-Key header",
      documentation: "/api/external/v1/docs",
      endpoints: {
        companies: "/api/external/v1/companies",
        users: "/api/external/v1/users",
        quotes: "/api/external/v1/quotes",
        invoices: "/api/external/v1/invoices",
        projects: "/api/external/v1/projects",
        tasks: "/api/external/v1/tasks",
      },
      scopes: [
        "read:companies",
        "write:companies",
        "read:users",
        "write:users",
        "read:quotes",
        "write:quotes",
        "read:invoices",
        "write:invoices",
        "read:projects",
        "write:projects",
        "read:tasks",
        "write:tasks",
        "read:reports",
        "admin",
      ],
    })
  );
});

// External Companies
registerRoute("GET", "/api/external/v1/companies", async (request, url) => {
  return withApiAuth(request, "read:companies", async () => {
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
    const search = url.searchParams.get("search") || undefined;
    const result = await companiesService.getCompanies({ page, pageSize }, { search });
    return json(result);
  });
});

registerRoute("GET", "/api/external/v1/companies/:id", async (request, _, params) => {
  return withApiAuth(request, "read:companies", async () => {
    const result = await companiesService.getCompanyById(params.id);
    if (!result.success) {
      return json(result, 404);
    }
    return json(result);
  });
});

// External Users
registerRoute("GET", "/api/external/v1/users", async (request, url) => {
  return withApiAuth(request, "read:users", async () => {
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
    const search = url.searchParams.get("search") || undefined;
    const result = await usersService.getUsers({ page, pageSize }, { search });
    return json(result);
  });
});

registerRoute("GET", "/api/external/v1/users/:id", async (request, _, params) => {
  return withApiAuth(request, "read:users", async () => {
    const result = await usersService.getUserById(params.id);
    if (!result.success) {
      return json(result, 404);
    }
    return json(result);
  });
});

// External Quotes
registerRoute("GET", "/api/external/v1/quotes", async (request, url) => {
  return withApiAuth(request, "read:quotes", async () => {
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
    const status = url.searchParams.get("status") || undefined;
    const companyId = url.searchParams.get("companyId") || undefined;
    const result = await salesService.getQuotes({ page, pageSize }, { status, companyId });
    return json(result);
  });
});

registerRoute("GET", "/api/external/v1/quotes/:id", async (request, _, params) => {
  return withApiAuth(request, "read:quotes", async () => {
    const result = await salesService.getQuoteById(params.id);
    if (!result.success) {
      return json(result, 404);
    }
    return json(result);
  });
});

// External Invoices
registerRoute("GET", "/api/external/v1/invoices", async (request, url) => {
  return withApiAuth(request, "read:invoices", async () => {
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
    const status = url.searchParams.get("status") || undefined;
    const companyId = url.searchParams.get("companyId") || undefined;
    const result = await salesService.getInvoices({ page, pageSize }, { status, companyId });
    return json(result);
  });
});

registerRoute("GET", "/api/external/v1/invoices/:id", async (request, _, params) => {
  return withApiAuth(request, "read:invoices", async () => {
    const result = await salesService.getInvoiceById(params.id);
    if (!result.success) {
      return json(result, 404);
    }
    return json(result);
  });
});

// External Projects
registerRoute("GET", "/api/external/v1/projects", async (request, url) => {
  return withApiAuth(request, "read:projects", async () => {
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
    const status = url.searchParams.get("status") || undefined;
    const result = await projectsService.getProjects({ page, pageSize }, { status });
    return json(result);
  });
});

registerRoute("GET", "/api/external/v1/projects/:id", async (request, _, params) => {
  return withApiAuth(request, "read:projects", async () => {
    const result = await projectsService.getProjectById(params.id);
    if (!result.success) {
      return json(result, 404);
    }
    return json(result);
  });
});

// External Tasks
registerRoute("GET", "/api/external/v1/tasks", async (request, url) => {
  return withApiAuth(request, "read:tasks", async () => {
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
    const projectId = url.searchParams.get("projectId") || undefined;
    const status = url.searchParams.get("status") || undefined;
    const result = await projectsService.getTasks({ page, pageSize }, { projectId, status });
    return json(result);
  });
});

registerRoute("GET", "/api/external/v1/tasks/:id", async (request, _, params) => {
  return withApiAuth(request, "read:tasks", async () => {
    const result = await projectsService.getTaskById(params.id);
    if (!result.success) {
      return json(result, 404);
    }
    return json(result);
  });
});

// External Reports (read-only)
registerRoute("GET", "/api/external/v1/reports/sales", async (request) => {
  return withApiAuth(request, "read:reports", async () => {
    const result = await reportsService.getSalesSummary();
    return json(result);
  });
});

registerRoute("GET", "/api/external/v1/reports/projects", async (request) => {
  return withApiAuth(request, "read:reports", async () => {
    const result = await reportsService.getProjectSummary();
    return json(result);
  });
});

// ============================================
// API Key Management Routes
// ============================================

registerRoute("POST", "/api/v1/api-keys", async (request) => {
  const body = await parseBody<{
    userId: string;
    name: string;
    scopes: ApiScope[];
    expiresInDays?: number;
  }>(request);

  if (!body || !body.userId || !body.name || !body.scopes) {
    return json(errorResponse("BAD_REQUEST", "userId, name, and scopes are required"), 400);
  }

  try {
    const apiKey = await generateApiKey(body.userId, body.name, body.scopes, body.expiresInDays);
    return json(
      successResponse({
        apiKey,
        message: "Store this key securely - it won't be shown again",
      }),
      201
    );
  } catch (error) {
    console.error("Error generating API key:", error);
    return json(errorResponse("SERVER_ERROR", "Failed to generate API key"), 500);
  }
});

registerRoute("DELETE", "/api/v1/api-keys/:key", async (_, __, params) => {
  try {
    const revoked = await revokeApiKey(params.key);
    if (!revoked) {
      return json(errorResponse("NOT_FOUND", "API key not found"), 404);
    }
    return json(successResponse({ message: "API key revoked" }));
  } catch (error) {
    console.error("Error revoking API key:", error);
    return json(errorResponse("SERVER_ERROR", "Failed to revoke API key"), 500);
  }
});

registerRoute("GET", "/api/v1/users/:userId/api-keys", async (_, __, params) => {
  try {
    const keys = await listUserApiKeys(params.userId);
    return json(successResponse(keys));
  } catch (error) {
    console.error("Error listing API keys:", error);
    return json(errorResponse("SERVER_ERROR", "Failed to list API keys"), 500);
  }
});

// ============================================
// Integration Status Routes
// ============================================

registerRoute("GET", "/api/v1/integrations/status", async () => {
  const [redisStatus, erpStatus] = await Promise.all([
    cache.getStats(),
    erpClient.healthCheck(),
  ]);

  return json(
    successResponse({
      redis: {
        connected: redisStatus.connected,
        memory: redisStatus.memory,
        clients: redisStatus.clients,
        keys: redisStatus.keys,
      },
      email: {
        enabled: emailService.isEnabled(),
      },
      erp: {
        enabled: erpClient.isEnabled(),
        connected: erpStatus.connected,
        latency: erpStatus.latency,
      },
    })
  );
});

// ERP Sync Endpoints
registerRoute("POST", "/api/v1/integrations/erp/sync/invoices", async (request) => {
  const body = await parseBody<{ invoiceIds?: string[] }>(request);
  
  // If no IDs provided, sync all recent invoices
  let invoices;
  if (body?.invoiceIds?.length) {
    // Get specific invoices
    const results = await Promise.all(
      body.invoiceIds.map((id) => salesService.getInvoiceById(id))
    );
    invoices = results.filter((r) => r.success && r.data).map((r) => r.data!);
  } else {
    // Get recent invoices (last 100)
    const result = await salesService.getInvoices({ page: 1, pageSize: 100 }, {});
    invoices = result.data || [];
  }

  const syncResult = await erpClient.syncInvoices(invoices);
  return json(successResponse(syncResult));
});

registerRoute("POST", "/api/v1/integrations/erp/sync/quotes", async (request) => {
  const body = await parseBody<{ quoteIds?: string[] }>(request);
  
  let quotes;
  if (body?.quoteIds?.length) {
    const results = await Promise.all(
      body.quoteIds.map((id) => salesService.getQuoteById(id))
    );
    quotes = results.filter((r) => r.success && r.data).map((r) => r.data!);
  } else {
    const result = await salesService.getQuotes({ page: 1, pageSize: 100 }, {});
    quotes = result.data || [];
  }

  const syncResult = await erpClient.syncQuotes(quotes);
  return json(successResponse(syncResult));
});

// Email Test Endpoint
registerRoute("POST", "/api/v1/integrations/email/test", async (request) => {
  const body = await parseBody<{ to: string; template: string }>(request);
  
  if (!body?.to) {
    return json(errorResponse("BAD_REQUEST", "Email address required"), 400);
  }

  const result = await emailService.sendNotification(
    body.to,
    "CRM Email Test",
    "This is a test email from CRM system. If you received this, email integration is working correctly!",
    undefined,
    undefined
  );

  return json(successResponse(result));
});

// ============================================
// Background Jobs Routes (Admin only)
// ============================================

registerRoute("GET", "/api/v1/admin/jobs/status", async (request) => {
  const authResult = await withAdminAuth(request);
  if (!authResult.success) return json(authResult, authResult.error?.code === "UNAUTHORIZED" ? 401 : 403);
  
  try {
    const [queuesStatus, workersStatus] = await Promise.all([
      getQueuesStatus(),
      Promise.resolve(getWorkerStatuses()),
    ]);
    
    return json(successResponse({
      queues: queuesStatus,
      workers: workersStatus,
    }));
  } catch (error) {
    console.error("Error getting job status:", error);
    return json(errorResponse("SERVER_ERROR", "Failed to get job status"), 500);
  }
});

registerRoute("POST", "/api/v1/admin/jobs/email/test", async (request) => {
  const authResult = await withAdminAuth(request);
  if (!authResult.success) return json(authResult, authResult.error?.code === "UNAUTHORIZED" ? 401 : 403);
  
  const body = await parseBody<{ to: string; subject?: string; message?: string }>(request);
  if (!body?.to) {
    return json(errorResponse("BAD_REQUEST", "Email address required"), 400);
  }
  
  try {
    const job = await addEmailJob({
      to: body.to,
      subject: body.subject || "CRM Test Email via Job Queue",
      text: body.message || "This is a test email sent via the background job queue.",
    });
    
    return json(successResponse({
      message: "Email job queued successfully",
      jobId: job.id,
    }));
  } catch (error) {
    console.error("Error queueing email job:", error);
    return json(errorResponse("SERVER_ERROR", "Failed to queue email job"), 500);
  }
});

// ============================================
// Router
// ============================================

export function router(
  method: string,
  pathname: string
): { handler: RouteHandler; params: Record<string, string> } | null {
  for (const route of routes) {
    if (route.method !== method) continue;

    const match = pathname.match(route.pattern);
    if (match) {
      const params: Record<string, string> = {};
      route.params.forEach((param, index) => {
        params[param] = match[index + 1];
      });
      return { handler: route.handler, params };
    }
  }
  return null;
}

export async function handleRequest(request: Request, url: URL): Promise<Response> {
  const route = router(request.method, url.pathname);

  if (!route) {
    return json(
      errorResponse("NOT_FOUND", `Route ${request.method} ${url.pathname} not found`),
      404
    );
  }

  return route.handler(request, url, route.params);
}
