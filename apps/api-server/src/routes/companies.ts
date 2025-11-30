/**
 * Company Routes
 */

import { errorResponse } from "@crm/utils";
import { companiesService } from "../services/companies.service";
import { RouteBuilder, withAuth, parseBody, parsePagination, parseFilters } from "./helpers";
import type { CreateCompanyRequest, UpdateCompanyRequest } from "@crm/types";

const router = new RouteBuilder();

// ============================================
// List Companies
// ============================================

router.get("/api/v1/companies", async (request, url) => {
  return withAuth(request, async () => {
    const pagination = parsePagination(url);
    const filters = parseFilters(url);
    return companiesService.getCompanies(pagination, filters);
  });
});

// ============================================
// Get Company by ID
// ============================================

router.get("/api/v1/companies/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    return companiesService.getCompanyById(params.id);
  });
});

// ============================================
// Create Company
// ============================================

router.post("/api/v1/companies", async (request) => {
  return withAuth(
    request,
    async () => {
      const body = await parseBody<CreateCompanyRequest>(request);
      if (!body) {
        return errorResponse("VALIDATION_ERROR", "Invalid request body");
      }
      return companiesService.createCompany(body);
    },
    201
  );
});

// ============================================
// Update Company
// ============================================

router.put("/api/v1/companies/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    const body = await parseBody<UpdateCompanyRequest>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }
    return companiesService.updateCompany(params.id, body);
  });
});

router.patch("/api/v1/companies/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    const body = await parseBody<UpdateCompanyRequest>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }
    return companiesService.updateCompany(params.id, body);
  });
});

// ============================================
// Delete Company
// ============================================

router.delete("/api/v1/companies/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    return companiesService.deleteCompany(params.id);
  });
});

// ============================================
// Get Industries List
// ============================================

router.get("/api/v1/industries", async (request) => {
  return withAuth(request, async () => {
    return companiesService.getIndustries();
  });
});

export const companyRoutes = router.getRoutes();

