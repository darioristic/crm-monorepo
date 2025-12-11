/**
 * CRM Routes - Leads, Contacts
 */

import type { CreateContactRequest, CreateLeadRequest, UpdateLeadRequest } from "@crm/types";
import { errorResponse, paginatedResponse, successResponse } from "@crm/utils";
import { cache } from "../cache/redis";
import { contactQueries } from "../db/queries";
import { organizationQueries } from "../db/queries/organizations";
import { crmService } from "../services/crm.service";
import { parseBody, parseFilters, parsePagination, RouteBuilder, withAuth } from "./helpers";

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
  return withAuth(request, async (auth) => {
    const pagination = parsePagination(url);
    const filters = parseFilters(url);
    return crmService.getContacts(pagination, { ...filters, tenantId: auth.activeTenantId });
  });
});

router.get("/api/v1/contacts/:id", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    return crmService.getContactById(params.id, auth.activeTenantId);
  });
});

router.post("/api/v1/contacts", async (request) => {
  return withAuth(
    request,
    async (auth) => {
      const body = await parseBody<CreateContactRequest>(request);
      if (!body) {
        return errorResponse("VALIDATION_ERROR", "Invalid request body");
      }
      return crmService.createContact({ ...body, tenantId: auth.activeTenantId });
    },
    201
  );
});

// ============================================
// ACCOUNTS: Unified search (companies + contacts)
// ============================================

router.get("/api/v1/accounts/search", async (request, url) => {
  return withAuth(request, async (auth) => {
    const q = url.searchParams.get("q")?.trim() || "";
    const type = url.searchParams.get("type"); // 'individual' | 'organization' | null
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);

    const filters = parseFilters(url);
    const pagination = { page: 1, pageSize: limit } as const;

    const includeIndividuals = !type || type === "individual";
    const includeOrganizations = !type || type === "organization";

    const [companiesResult, contactsResult] = await Promise.all([
      includeOrganizations
        ? organizationQueries.findAll(pagination, {
            ...filters,
            search: q,
            tenantId: auth.activeTenantId,
          } as { search: string; tenantId: string | undefined } & typeof filters)
        : Promise.resolve({ data: [], total: 0 }),
      includeIndividuals
        ? contactQueries.findAll(pagination, { ...filters, search: q, tenantId: auth.activeTenantId })
        : Promise.resolve({ data: [], total: 0 }),
    ]);

    // Usage boost from cache
    const companyUsageKeys = companiesResult.data.map(
      (c) => `accounts:usage:${filters.companyId || "global"}:organization:${c.id}`
    );
    const contactUsageKeys = contactsResult.data.map(
      (c) => `accounts:usage:${filters.companyId || "global"}:contact:${c.id}`
    );

    const usageCounts: Record<string, number> = {};
    for (const key of [...companyUsageKeys, ...contactUsageKeys]) {
      const countStr = await cache.get<string>(key);
      usageCounts[key] = countStr ? Number(countStr) : 0;
    }

    type CompanyScoreInput = {
      id: string;
      name?: string;
      pib?: string;
      companyNumber?: string;
      isFavorite?: boolean;
    };
    function scoreCompany(c: CompanyScoreInput): number {
      let s = 0;
      const name = (c.name || "").toLowerCase();
      const ql = q.toLowerCase();
      if (!ql) s += 1; // slight base
      if (name === ql) s += 10;
      else if (name.startsWith(ql)) s += 6;
      else if (name.includes(ql)) s += 3;
      if ((c.pib || "").toLowerCase() === ql) s += 8;
      if ((c.companyNumber || "").toLowerCase() === ql) s += 5;
      const key = `accounts:usage:${filters.companyId || "global"}:organization:${c.id}`;
      s += (usageCounts[key] || 0) * 0.5;
      if (c.isFavorite) s += 2;
      return s;
    }

    type ContactScoreInput = {
      id: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      jmbg?: string;
      isFavorite?: boolean;
    };
    function scoreContact(c: ContactScoreInput): number {
      let s = 0;
      const fullName = `${c.firstName || ""} ${c.lastName || ""}`.trim().toLowerCase();
      const email = (c.email || "").toLowerCase();
      const ql = q.toLowerCase();
      if (!ql) s += 1;
      if (fullName === ql) s += 10;
      else if (fullName.startsWith(ql)) s += 6;
      else if (fullName.includes(ql)) s += 3;
      if (email === ql) s += 8;
      if ((c.jmbg || "").toLowerCase() === ql) s += 7;
      const key = `accounts:usage:${filters.companyId || "global"}:contact:${c.id}`;
      s += (usageCounts[key] || 0) * 0.5;
      if (c.isFavorite) s += 2;
      return s;
    }

    const combined = [
      ...companiesResult.data.map((c) => ({
        type: "organization" as const,
        id: c.id,
        display: c.name,
        subtitle:
          [c.pib, c.companyNumber, c.contactPerson].filter(Boolean).join(" · ") || undefined,
        favorite: !!c.isFavorite,
        raw: c,
        score: scoreCompany({
          id: c.id,
          name: c.name,
          pib: c.pib || undefined,
          companyNumber: c.companyNumber || undefined,
          isFavorite: c.isFavorite,
        }),
      })),
      ...contactsResult.data.map((c) => ({
        type: "individual" as const,
        id: c.id,
        display: `${c.firstName} ${c.lastName}`.trim(),
        subtitle: [c.email, c.phone, c.jmbg].filter(Boolean).join(" · ") || undefined,
        favorite: !!c.isFavorite,
        raw: c,
        score: scoreContact(c),
      })),
    ]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return successResponse(combined);
  });
});

// Record selection for usage-based boosting
router.post("/api/v1/accounts/select", async (request) => {
  return withAuth(request, async () => {
    const body = await parseBody<{
      type: "individual" | "organization";
      id: string;
      companyId?: string;
    }>(request);
    if (!body || !body.id || !body.type) {
      return errorResponse("VALIDATION_ERROR", "Invalid selection payload");
    }
    const key = `accounts:usage:${body.companyId || "global"}:${body.type === "organization" ? "organization" : "contact"}:${body.id}`;
    const count = await cache.incr(key, 7 * 24 * 3600); // expire in 7 days
    return successResponse({ count });
  });
});

// Toggle favorite for contacts
router.post("/api/v1/contacts/:id/favorite", async (request, _url, params) => {
  return withAuth(request, async () => {
    const body = await parseBody<{ favorite: boolean }>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }
    const { sql: db } = await import("../db/client");
    const result = await db`
      UPDATE contacts SET is_favorite = ${body.favorite}
      WHERE id = ${params.id}
      RETURNING *
    `;
    return successResponse(result[0]);
  });
});

// Toggle favorite for companies
router.post("/api/v1/companies/:id/favorite", async (request, _url, params) => {
  return withAuth(request, async () => {
    const body = await parseBody<{ favorite: boolean }>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }
    const { sql: db } = await import("../db/client");
    const result = await db`
      UPDATE companies SET is_favorite = ${body.favorite}
      WHERE id = ${params.id}
      RETURNING *
    `;
    return successResponse(result[0]);
  });
});

// Organizations CRUD (Accounts specific)
router.get("/api/v1/organizations", async (request, url) => {
  return withAuth(request, async (auth) => {
    const pagination = parsePagination(url);
    const filters = parseFilters(url);
    const search = url.searchParams.get("search") || undefined;
    const { data, total } = await organizationQueries.findAll(pagination, {
      ...filters,
      search,
      tenantId: auth.activeTenantId,
    });
    return paginatedResponse(data, total, pagination);
  });
});

router.get("/api/v1/organizations/:id", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    const org = await organizationQueries.getById(params.id, auth.activeTenantId);
    if (!org) return errorResponse("NOT_FOUND", "Organization not found");
    return successResponse(org);
  });
});

router.post("/api/v1/organizations", async (request) => {
  return withAuth(request, async (_user) => {
    const body = await parseBody<{
      id?: string;
      name: string;
      email?: string | null;
      phone?: string | null;
      pib?: string | null;
      companyNumber?: string | null;
      contactPerson?: string | null;
      isFavorite?: boolean;
    }>(request);
    if (!body?.name) return errorResponse("VALIDATION_ERROR", "Name is required");
    const now = new Date().toISOString();
    const org = await organizationQueries.create({
      id: body.id || crypto.randomUUID(),
      name: body.name,
      email: body.email || null,
      phone: body.phone || null,
      pib: body.pib || null,
      companyNumber: body.companyNumber || null,
      contactPerson: body.contactPerson || null,
      isFavorite: !!body.isFavorite,
      createdAt: now,
      updatedAt: now,
    });
    return successResponse(org);
  });
});

router.put("/api/v1/organizations/:id", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    const body = await parseBody<{
      name?: string;
      email?: string | null;
      phone?: string | null;
      pib?: string | null;
      companyNumber?: string | null;
      contactPerson?: string | null;
      isFavorite?: boolean;
    }>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }
    const org = await organizationQueries.update(
      params.id,
      {
        name: body.name,
        email: body.email,
        phone: body.phone,
        pib: body.pib,
        companyNumber: body.companyNumber,
        contactPerson: body.contactPerson,
        isFavorite: body.isFavorite,
        updatedAt: new Date().toISOString(),
      },
      auth.activeTenantId
    );
    if (!org) return errorResponse("NOT_FOUND", "Organization not found");
    return successResponse(org);
  });
});

router.delete("/api/v1/organizations/:id", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    const deleted = await organizationQueries.delete(params.id, auth.activeTenantId);
    if (!deleted) return errorResponse("NOT_FOUND", "Organization not found");
    return successResponse({ id: params.id });
  });
});

router.post("/api/v1/organizations/:id/favorite", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    const body = await parseBody<{ favorite: boolean }>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }
    const org = await organizationQueries.update(
      params.id,
      { isFavorite: body.favorite, updatedAt: new Date().toISOString() },
      auth.activeTenantId
    );
    if (!org) return errorResponse("NOT_FOUND", "Organization not found");
    return successResponse(org);
  });
});

export const crmRoutes = router.getRoutes();
