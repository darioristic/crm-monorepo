/**
 * CRM Routes - Leads, Contacts
 */

import { errorResponse } from "@crm/utils";
import { crmService } from "../services/crm.service";
import { RouteBuilder, withAuth, parseBody, parsePagination, parseFilters } from "./helpers";
import type { CreateLeadRequest, UpdateLeadRequest, CreateContactRequest } from "@crm/types";

const router = new RouteBuilder();

// ============================================
// LEADS
// ============================================

router.get("/api/v1/leads", async (request, url) => {
  return withAuth(request, async () => {
    const pagination = parsePagination(url);
    const filters = parseFilters(url);
    return crmService.getLeads(pagination, filters);
  });
});

router.get("/api/v1/leads/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    return crmService.getLeadById(params.id);
  });
});

router.post("/api/v1/leads", async (request) => {
  return withAuth(
    request,
    async () => {
      const body = await parseBody<CreateLeadRequest>(request);
      if (!body) {
        return errorResponse("VALIDATION_ERROR", "Invalid request body");
      }
      return crmService.createLead(body);
    },
    201
  );
});

router.put("/api/v1/leads/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    const body = await parseBody<UpdateLeadRequest>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }
    return crmService.updateLead(params.id, body);
  });
});

router.patch("/api/v1/leads/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    const body = await parseBody<UpdateLeadRequest>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }
    return crmService.updateLead(params.id, body);
  });
});

router.delete("/api/v1/leads/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    return crmService.deleteLead(params.id);
  });
});

// ============================================
// CONTACTS
// ============================================

router.get("/api/v1/contacts", async (request, url) => {
  return withAuth(request, async () => {
    const pagination = parsePagination(url);
    const filters = parseFilters(url);
    return crmService.getContacts(pagination, filters);
  });
});

router.get("/api/v1/contacts/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    return crmService.getContactById(params.id);
  });
});

router.post("/api/v1/contacts", async (request) => {
  return withAuth(
    request,
    async () => {
      const body = await parseBody<CreateContactRequest>(request);
      if (!body) {
        return errorResponse("VALIDATION_ERROR", "Invalid request body");
      }
      return crmService.createContact(body);
    },
    201
  );
});

export const crmRoutes = router.getRoutes();
