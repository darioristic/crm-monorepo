/**
 * Reports Routes
 */

import { reportsService } from "../services/reports.service";
import { parseFilters, parsePagination, RouteBuilder, withAuth } from "./helpers";

const router = new RouteBuilder();

// ============================================
// Entity Reports
// ============================================

router.get("/api/v1/reports/users", async (request, url) => {
  return withAuth(request, async () => {
    const pagination = parsePagination(url);
    const filters = parseFilters(url);
    return reportsService.getUsersReport(pagination, filters);
  });
});

router.get("/api/v1/reports/companies", async (request, url) => {
  return withAuth(request, async () => {
    const pagination = parsePagination(url);
    const filters = parseFilters(url);
    return reportsService.getCompaniesReport(pagination, filters);
  });
});

router.get("/api/v1/reports/quotes", async (request, url) => {
  return withAuth(request, async () => {
    const pagination = parsePagination(url);
    const filters = parseFilters(url);
    return reportsService.getQuotesReport(pagination, filters);
  });
});

router.get("/api/v1/reports/invoices", async (request, url) => {
  return withAuth(request, async () => {
    const pagination = parsePagination(url);
    const filters = parseFilters(url);
    return reportsService.getInvoicesReport(pagination, filters);
  });
});

router.get("/api/v1/reports/delivery-notes", async (request, url) => {
  return withAuth(request, async () => {
    const pagination = parsePagination(url);
    const filters = parseFilters(url);
    return reportsService.getDeliveryNotesReport(pagination, filters);
  });
});

router.get("/api/v1/reports/projects", async (request, url) => {
  return withAuth(request, async () => {
    const pagination = parsePagination(url);
    const filters = parseFilters(url);
    return reportsService.getProjectsReport(pagination, filters);
  });
});

router.get("/api/v1/reports/tasks", async (request, url) => {
  return withAuth(request, async () => {
    const pagination = parsePagination(url);
    const filters = parseFilters(url);
    return reportsService.getTasksReport(pagination, filters);
  });
});

router.get("/api/v1/reports/milestones", async (request, url) => {
  return withAuth(request, async () => {
    const pagination = parsePagination(url);
    const filters = parseFilters(url);
    return reportsService.getMilestonesReport(pagination, filters);
  });
});

// ============================================
// Summary Reports
// ============================================

router.get("/api/v1/reports/sales-summary", async (request) => {
  return withAuth(request, async () => {
    return reportsService.getSalesSummary();
  });
});

router.get("/api/v1/reports/project-summary", async (request) => {
  return withAuth(request, async () => {
    return reportsService.getProjectSummary();
  });
});

// ============================================
// Chart Data
// ============================================

router.get("/api/v1/reports/revenue-over-time", async (request, url) => {
  return withAuth(request, async () => {
    const from =
      url.searchParams.get("from") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const to = url.searchParams.get("to") || new Date().toISOString();
    return reportsService.getRevenueOverTime({ from, to });
  });
});

router.get("/api/v1/reports/revenue-by-company", async (request, url) => {
  return withAuth(request, async () => {
    const from =
      url.searchParams.get("from") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const to = url.searchParams.get("to") || new Date().toISOString();
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);
    return reportsService.getRevenueByCompany({ from, to }, limit);
  });
});

router.get("/api/v1/reports/top-customers", async (request, url) => {
  return withAuth(request, async () => {
    const from =
      url.searchParams.get("from") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const to = url.searchParams.get("to") || new Date().toISOString();
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);
    return reportsService.getTopCustomers({ from, to }, limit);
  });
});

router.get("/api/v1/reports/conversion-funnel", async (request, url) => {
  return withAuth(request, async () => {
    const from =
      url.searchParams.get("from") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const to = url.searchParams.get("to") || new Date().toISOString();
    return reportsService.getConversionFunnel({ from, to });
  });
});

router.get("/api/v1/reports/invoice-status", async (request, url) => {
  return withAuth(request, async () => {
    const from =
      url.searchParams.get("from") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const to = url.searchParams.get("to") || new Date().toISOString();
    return reportsService.getInvoiceStatusBreakdown({ from, to });
  });
});

// ============================================
// Project Reports
// ============================================

router.get("/api/v1/reports/task-stats-over-time", async (request, url) => {
  return withAuth(request, async () => {
    const from =
      url.searchParams.get("from") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const to = url.searchParams.get("to") || new Date().toISOString();
    const projectId = url.searchParams.get("projectId") || undefined;
    return reportsService.getTaskStatsOverTime({ from, to }, projectId);
  });
});

router.get("/api/v1/reports/milestone-breakdown", async (request, url) => {
  return withAuth(request, async () => {
    const projectId = url.searchParams.get("projectId") || undefined;
    return reportsService.getMilestoneBreakdown(projectId);
  });
});

router.get("/api/v1/reports/tasks-by-priority", async (request, url) => {
  return withAuth(request, async () => {
    const projectId = url.searchParams.get("projectId") || undefined;
    return reportsService.getTasksByPriority(projectId);
  });
});

router.get("/api/v1/reports/project-duration", async (request) => {
  return withAuth(request, async () => {
    return reportsService.getProjectDurationStats();
  });
});

// ============================================
// Finance Dashboard
// ============================================

router.get("/api/v1/reports/finance-dashboard", async (request, url) => {
  return withAuth(request, async (auth) => {
    const tenantId = url.searchParams.get("tenantId") || auth.activeTenantId || undefined;
    return reportsService.getFinanceDashboard(tenantId);
  });
});

export const reportRoutes = router.getRoutes();
