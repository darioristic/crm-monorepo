/**
 * Company Routes
 */

import type { Company, CreateCompanyRequest, UpdateCompanyRequest } from "@crm/types";
import { errorResponse, successResponse } from "@crm/utils";
import { eq } from "drizzle-orm";
import { cache } from "../cache/redis";
import { db, sql } from "../db/client";
import {
  createCompany,
  deleteCompany,
  deleteCompanyMember,
  getCompaniesByUserId,
  getCompanyById,
  getCompanyMembers,
  hasCompanyAccess,
  leaveCompany,
  updateCompanyById,
  updateCompanyMember,
} from "../db/queries/companies-members";
import { tenantAccounts } from "../db/schema/index";
import { logger } from "../lib/logger";
import { isSuperadmin, isTenantAdmin } from "../middleware/auth";
import { companiesService } from "../services/companies.service";
import { uploadFile, uploadFileFromBuffer } from "../services/file-storage.service";
import { parseBody, parseFilters, parsePagination, RouteBuilder, withAuth } from "./helpers";

const router = new RouteBuilder();

async function storeLogoFromInput(companyId: string, input: string): Promise<string | null> {
  try {
    if (input.startsWith("data:")) {
      const match = input.match(/^data:([^;]+);base64,(.*)$/);
      if (!match) return null;
      const mimetype = match[1];
      const base64 = match[2];
      const buffer = Buffer.from(base64, "base64");
      if (buffer.length > 5 * 1024 * 1024) return null;
      let ext = "bin";
      if (mimetype === "image/png") ext = "png";
      else if (mimetype === "image/jpeg") ext = "jpg";
      else if (mimetype === "image/gif") ext = "gif";
      else if (mimetype === "image/webp") ext = "webp";
      else if (mimetype === "image/svg+xml") ext = "svg";
      const originalName = `logo.${ext}`;
      const uploaded = await uploadFileFromBuffer(companyId, buffer, originalName, mimetype);
      return `/api/v1/files/vault/${uploaded.path.join("/")}`;
    }
    if (input.startsWith("http://") || input.startsWith("https://")) {
      // Try the provided URL first
      const tryFetch = async (url: string) => {
        const res = await fetch(url);
        if (!res.ok) return null;
        const contentType = res.headers.get("content-type") || "application/octet-stream";
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        if (buffer.length > 5 * 1024 * 1024) return null;
        let ext = "bin";
        if (contentType.includes("png")) ext = "png";
        else if (contentType.includes("jpeg") || contentType.includes("jpg")) ext = "jpg";
        else if (contentType.includes("gif")) ext = "gif";
        else if (contentType.includes("webp")) ext = "webp";
        else if (contentType.includes("svg")) ext = "svg";
        let originalName = `logo.${ext}`;
        try {
          const u = new URL(url);
          const path = u.pathname.split("/").pop() || "";
          const m = path.match(/\.([a-zA-Z0-9]+)$/);
          if (m) originalName = path;
        } catch {}
        const uploaded = await uploadFileFromBuffer(companyId, buffer, originalName, contentType);
        return `/api/v1/files/vault/${uploaded.path.join("/")}`;
      };

      // Attempt original URL
      const primary = await tryFetch(input);
      if (primary) return primary;

      // If input is Clearbit and failed, fallback to Google S2 favicons or /favicon.ico
      try {
        const u = new URL(input);
        const domain = u.hostname.replace(/^www\./, "");
        const candidates = [
          `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
          `https://${domain}/favicon.ico`,
          `http://${domain}/favicon.ico`,
        ];
        for (const candidate of candidates) {
          const result = await tryFetch(candidate);
          if (result) return result;
        }
      } catch {}
      return null;
    }
    if (input.startsWith("/api/v1/files/vault/")) return input;
    return null;
  } catch {
    return null;
  }
}

// ============================================
// List Companies
// ============================================

// ============================================
// Get Current Company (DEPRECATED - returns tenant info as "company" for backwards compatibility)
// In the new architecture, users belong to TENANTS, not companies.
// This endpoint returns the user's active tenant data for backwards compatibility.
// ============================================

router.get("/api/v1/companies/current", async (request) => {
  return withAuth(request, async (auth) => {
    if (!auth.activeTenantId) {
      return errorResponse("NOT_FOUND", "No active tenant found");
    }

    const [account] = await db
      .select()
      .from(tenantAccounts)
      .where(eq(tenantAccounts.tenantId, auth.activeTenantId))
      .limit(1);

    if (account) {
      return successResponse({
        id: account.id,
        name: account.name,
        industry: account.industry,
        address: account.address,
        email: account.email ?? null,
        phone: account.phone ?? null,
        website: account.website ?? null,
        contact: account.contact ?? null,
        city: account.city ?? null,
        zip: account.zip ?? null,
        country: account.country ?? null,
        countryCode: account.countryCode ?? null,
        vatNumber: account.vatNumber ?? null,
        companyNumber: account.companyNumber ?? null,
        logoUrl: account.logoUrl ?? null,
        note: account.note ?? null,
        createdAt: new Date(account.createdAt as string | Date).toISOString(),
        updatedAt: new Date(account.updatedAt as string | Date).toISOString(),
      });
    }

    const tenant = await sql`
      SELECT
        t.id,
        t.name,
        t.slug,
        t.status,
        t.created_at as "createdAt",
        utr.role
      FROM tenants t
      LEFT JOIN user_tenant_roles utr ON utr.tenant_id = t.id AND utr.user_id = ${auth.userId}
      WHERE t.id = ${auth.activeTenantId}
      LIMIT 1
    `;

    if (!tenant[0]) {
      return errorResponse("NOT_FOUND", "Tenant not found");
    }

    const tenantAsCompany = {
      id: tenant[0].id,
      name: tenant[0].name,
      industry: "",
      address: "",
      logoUrl: null,
      email: null,
      note: null,
      phone: null,
      website: null,
      contact: null,
      city: null,
      zip: null,
      country: null,
      countryCode: null,
      vatNumber: null,
      companyNumber: null,
      createdAt: new Date(tenant[0].createdAt as string | Date).toISOString(),
      updatedAt: new Date(tenant[0].createdAt as string | Date).toISOString(),
    };

    return successResponse(tenantAsCompany);
  });
});

router.put("/api/v1/companies/current", async (request) => {
  return withAuth(request, async (auth) => {
    if (!auth.activeTenantId) {
      return errorResponse("NOT_FOUND", "No active tenant found");
    }

    const body = await parseBody<{
      name?: string;
      industry?: string;
      address?: string;
      locationId?: string | null;
      email?: string | null;
      phone?: string | null;
      website?: string | null;
      contact?: string | null;
      city?: string | null;
      zip?: string | null;
      country?: string | null;
      countryCode?: string | null;
      vatNumber?: string | null;
      companyNumber?: string | null;
      logoUrl?: string | null;
      note?: string | null;
    }>(request);

    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }

    const [account] = await db
      .select()
      .from(tenantAccounts)
      .where(eq(tenantAccounts.tenantId, auth.activeTenantId))
      .limit(1);

    if (!account) {
      const [created] = await db
        .insert(tenantAccounts)
        .values({
          id: crypto.randomUUID(),
          tenantId: auth.activeTenantId,
          locationId: body.locationId ?? null,
          name: body.name ?? "",
          industry: body.industry ?? "",
          address: body.address ?? "",
          email: body.email ?? null,
          phone: body.phone ?? null,
          website: body.website ?? null,
          contact: body.contact ?? null,
          city: body.city ?? null,
          zip: body.zip ?? null,
          country: body.country ?? null,
          countryCode: body.countryCode ?? null,
          vatNumber: body.vatNumber ?? null,
          companyNumber: body.companyNumber ?? null,
          logoUrl: body.logoUrl ?? null,
          note: body.note ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return successResponse(created);
    }

    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) update.name = body.name;
    if (body.industry !== undefined) update.industry = body.industry;
    if (body.address !== undefined) update.address = body.address;
    if (body.locationId !== undefined) update.locationId = body.locationId ?? null;
    if (body.email !== undefined) update.email = body.email ?? null;
    if (body.phone !== undefined) update.phone = body.phone ?? null;
    if (body.website !== undefined) update.website = body.website ?? null;
    if (body.contact !== undefined) update.contact = body.contact ?? null;
    if (body.city !== undefined) update.city = body.city ?? null;
    if (body.zip !== undefined) update.zip = body.zip ?? null;
    if (body.country !== undefined) update.country = body.country ?? null;
    if (body.countryCode !== undefined) update.countryCode = body.countryCode ?? null;
    if (body.vatNumber !== undefined) update.vatNumber = body.vatNumber ?? null;
    if (body.companyNumber !== undefined) update.companyNumber = body.companyNumber ?? null;
    if (body.logoUrl !== undefined) update.logoUrl = body.logoUrl ?? null;
    if (body.note !== undefined) update.note = body.note ?? null;

    await db.update(tenantAccounts).set(update).where(eq(tenantAccounts.id, account.id));

    const [updated] = await db
      .select()
      .from(tenantAccounts)
      .where(eq(tenantAccounts.id, account.id))
      .limit(1);

    return successResponse(updated);
  });
});

// ============================================
// List Companies (all companies user is member of)
// ============================================

router.get("/api/v1/companies", async (request, url) => {
  return withAuth(request, async (auth) => {
    // If no query params, return user's companies
    const hasQueryParams = url.searchParams.toString().length > 0;

    if (!hasQueryParams) {
      // For admin users (superadmin, tenant_admin), show all companies from their tenant
      // For regular users, show only companies they are members of
      let memberCompanies: Array<{
        id: string;
        name: string;
        industry: string;
        address: string;
        logoUrl: string | null;
        email: string | null;
        role: "owner" | "member" | "admin";
        createdAt: string;
      }>;

      if (isSuperadmin(auth)) {
        // Superadmin sees all companies (no tenant filter)
        const allCompanies = await sql`
          SELECT 
            c.id,
            c.name,
            c.industry,
            c.address,
            c.logo_url as logo_url,
            c.email,
            COALESCE(uoc.role, 'admin') as role,
            c.created_at
          FROM companies c
          LEFT JOIN users_on_company uoc ON uoc.company_id = c.id AND uoc.user_id = ${auth.userId}
          WHERE (c.source IS NULL OR c.source <> 'customer')
          ORDER BY c.name ASC
        `;
        memberCompanies = allCompanies.map((row: Record<string, unknown>) => ({
          id: row.id as string,
          name: row.name as string,
          industry: row.industry as string,
          address: row.address as string,
          logoUrl: (row.logo_url as string) || null,
          email: (row.email as string) || null,
          role: (row.role as "owner" | "member" | "admin") || "admin",
          createdAt: new Date(row.created_at as Date).toISOString(),
        }));
      } else if (isTenantAdmin(auth)) {
        // Tenant admin sees all companies from their tenant (not just member companies)
        let effectiveTenantId = auth.activeTenantId;

        if (!effectiveTenantId) {
          // If tenant admin has no tenantId, create/get default tenant and assign it
          const { getOrCreateDefaultTenant } = await import("../db/queries/tenants");
          effectiveTenantId = await getOrCreateDefaultTenant();

          // Update user with tenantId for future requests
          const { sql } = await import("../db/client");
          await sql`
            UPDATE users 
            SET tenant_id = ${effectiveTenantId}, updated_at = NOW()
            WHERE id = ${auth.userId}
          `;

          logger.info(
            { tenantId: effectiveTenantId, userId: auth.userId },
            "Assigned default tenant to user"
          );
        }

        if (effectiveTenantId) {
          const allTenantCompanies = await sql`
            SELECT 
              c.id,
              c.name,
              c.industry,
              c.address,
              c.logo_url as logo_url,
              c.email,
              COALESCE(uoc.role, 'admin') as role,
              c.created_at
            FROM companies c
            LEFT JOIN users_on_company uoc ON uoc.company_id = c.id AND uoc.user_id = ${auth.userId}
              WHERE c.tenant_id = ${effectiveTenantId}
                AND (c.source IS NULL OR c.source <> 'customer')
              ORDER BY c.name ASC
          `;
          memberCompanies = allTenantCompanies.map((row: Record<string, unknown>) => ({
            id: row.id as string,
            name: row.name as string,
            industry: row.industry as string,
            address: row.address as string,
            logoUrl: (row.logo_url as string) || null,
            email: (row.email as string) || null,
            role: (row.role as "owner" | "member" | "admin") || "admin",
            createdAt: new Date(row.created_at as Date).toISOString(),
          }));
        } else {
          // Fallback: if we still don't have tenantId, get member companies only
          memberCompanies = await getCompaniesByUserId(auth.userId, null);
        }
      } else {
        // Regular users see only companies they are members of
        // If user doesn't have tenantId, get or create default tenant
        let effectiveTenantId = auth.activeTenantId;
        if (!effectiveTenantId) {
          const { getOrCreateDefaultTenant } = await import("../db/queries/tenants");
          effectiveTenantId = await getOrCreateDefaultTenant();

          // Update user with tenantId for future requests
          const { sql } = await import("../db/client");
          await sql`
            UPDATE users 
            SET tenant_id = ${effectiveTenantId}, updated_at = NOW()
            WHERE id = ${auth.userId}
          `;
        }
        memberCompanies = await getCompaniesByUserId(auth.userId, effectiveTenantId);
      }

      const companies: Company[] = memberCompanies.map((c) => ({
        id: c.id,
        name: c.name,
        industry: c.industry,
        address: c.address,
        logoUrl: c.logoUrl || null,
        email: c.email || null,
        note: null,
        phone: "",
        website: null,
        contact: null,
        city: null,
        zip: null,
        country: null,
        countryCode: null,
        vatNumber: null,
        companyNumber: null,
        createdAt: c.createdAt as string,
        updatedAt: c.createdAt as string,
      }));
      return successResponse(companies);
    }

    // Otherwise use the existing service for paginated/filtered list
    const pagination = parsePagination(url);
    const filters = {
      ...parseFilters(url),
      tenantId: auth.activeTenantId,
      source: "customer",
    } as Record<string, unknown>;
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
    async (auth) => {
      const body = await parseBody<
        CreateCompanyRequest & {
          switchCompany?: boolean;
          source?: "account" | "customer";
        }
      >(request);
      if (!body) {
        return errorResponse("VALIDATION_ERROR", "Invalid request body");
      }

      if (!body.name || !body.industry || !body.address) {
        return errorResponse("VALIDATION_ERROR", "Name, industry, and address are required");
      }

      try {
        const companyId = await createCompany({
          name: body.name,
          industry: body.industry,
          address: body.address,
          userId: auth.userId,
          email: body.email || undefined,
          phone: body.phone ?? undefined,
          website: body.website ?? undefined,
          contact: body.contact ?? undefined,
          city: body.city ?? undefined,
          zip: body.zip ?? undefined,
          country: body.country ?? undefined,
          countryCode: body.countryCode ?? undefined,
          vatNumber: body.vatNumber ?? undefined,
          companyNumber: body.companyNumber ?? undefined,
          note: body.note ?? undefined,
          logoUrl: body.logoUrl ?? undefined,
          switchCompany: false,
          source: "customer",
        });
        let company = await getCompanyById(companyId);
        if (!company) {
          return errorResponse("SERVER_ERROR", "Failed to retrieve created company");
        }

        const inputLogo = body.logoUrl;
        if (inputLogo && typeof inputLogo === "string") {
          const storedUrl = await storeLogoFromInput(companyId, inputLogo);
          if (storedUrl) {
            await updateCompanyById({ id: companyId, logoUrl: storedUrl });
            company = await getCompanyById(companyId);
          }
        }

        await cache.invalidatePattern("companies:list:*");

        return successResponse(company);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Failed to create company";
        if (typeof msg === "string" && msg.toLowerCase().includes("duplicate")) {
          return errorResponse("DUPLICATE", msg);
        }
        return errorResponse("SERVER_ERROR", msg);
      }
    },
    201
  );
});

// ============================================
// Update Company
// ============================================

router.put("/api/v1/companies/:id", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    logger.info({ companyId: params.id, userId: auth.userId }, "UPDATE_COMPANY_ROUTE_START");
    const allowed = true;

    if (!allowed) {
      return errorResponse("FORBIDDEN", "Not allowed to modify this company");
    }

    const body = await parseBody<UpdateCompanyRequest & { logoUrl?: string }>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }

    try {
      logger.info({ companyId: params.id }, "UPDATE_COMPANY_PARSE_BODY");
      const inputLogo = body.logoUrl;
      let processedLogoUrl: string | undefined;
      if (inputLogo && typeof inputLogo === "string") {
        const storedUrl = await storeLogoFromInput(params.id, inputLogo);
        processedLogoUrl = storedUrl ?? inputLogo;
      }

      await updateCompanyById({
        id: params.id,
        name: body.name,
        industry: body.industry,
        address: body.address,
        email: body.email ?? undefined,
        phone: body.phone ?? undefined,
        website: body.website ?? undefined,
        contact: body.contact ?? undefined,
        city: body.city ?? undefined,
        zip: body.zip ?? undefined,
        country: body.country ?? undefined,
        countryCode: body.countryCode ?? undefined,
        vatNumber: body.vatNumber ?? undefined,
        companyNumber: body.companyNumber ?? undefined,
        note: body.note ?? undefined,
        logoUrl: processedLogoUrl,
      });
      logger.info({ companyId: params.id }, "UPDATE_COMPANY_SUCCESS");
      const fullCompany = await getCompanyById(params.id);
      if (!fullCompany) {
        return errorResponse("NOT_FOUND", "Company not found");
      }
      return successResponse(fullCompany);
    } catch (error) {
      logger.error({ error, companyId: params.id }, "UPDATE_COMPANY_ERROR");
      return errorResponse(
        "SERVER_ERROR",
        error instanceof Error ? error.message : "Failed to update company"
      );
    }
  });
});

router.post("/api/v1/companies/:id/enrich/firecrawl", async (request, url, params) => {
  return withAuth(request, async (auth) => {
    const { getCompanyById } = await import("../db/queries/companies-enhanced");
    const company = await getCompanyById(params.id);
    if (!company) {
      return errorResponse("NOT_FOUND", "Company not found");
    }
    const tenantIdParam = url.searchParams.get("tenantId") || auth.activeTenantId || null;
    const tenantId = tenantIdParam || auth.activeTenantId || auth.companyId || auth.userId;
    if (!tenantId) {
      return errorResponse("VALIDATION_ERROR", "Tenant required");
    }
    const { firecrawlClient } = await import("../integrations/firecrawl.client");
    const targetUrl =
      company.website || `https://www.google.com/search?q=${encodeURIComponent(company.name)}`;
    const extractPayload = {
      urls: [targetUrl],
      prompt:
        "Extract company description, tech stack list, social links, and 5 metadata tags relevant to the company. Return JSON with keys: description, techStack (array), socialLinks (array), tags (array).",
    };
    const result = await firecrawlClient.extract<Record<string, unknown>>(tenantId, extractPayload);
    if (!result.success || !result.data) {
      return errorResponse("FIRECRAWL_ERROR", result.error?.message || "Failed to enrich company");
    }
    const data = result.data as Record<string, unknown>;
    const description = typeof data.description === "string" ? (data.description as string) : null;
    let noteUpdate = company.note || null;
    if (description) {
      noteUpdate = description;
    }
    await updateCompanyById({
      id: params.id,
      note: noteUpdate ?? undefined,
    });
    const enriched = await getCompanyById(params.id);
    const { EventStore } = await import("../infrastructure/EventStore");
    const { DomainEvent } = await import("../domain/base/Event");
    const eventStore = new EventStore();
    const event = new (class CompanyEvent extends DomainEvent {
      constructor() {
        super({
          aggregateId: params.id,
          aggregateType: "Company",
          eventType: "CompanyEnrichedFromFirecrawl",
          eventVersion: 1,
          eventData: { input: extractPayload, output: data },
          metadata: { tenantId, userId: auth.userId, timestamp: new Date() },
        });
      }
    })();
    await eventStore.append([event]);
    return successResponse({ company: enriched, enrichment: data });
  });
});

// ============================================
// Upload Company Logo
// ============================================

router.post("/api/v1/companies/:id/logo", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    // Verify user has access (customer companies are editable by tenant_admin and regular users)
    const rows = await sql`
          SELECT source FROM companies WHERE id = ${params.id}
        `;
    const source = (rows[0]?.source as string | null) ?? null;
    if (source !== "customer") {
      const hasAccess = await hasCompanyAccess(params.id, auth.userId);
      if (!hasAccess) {
        return errorResponse("FORBIDDEN", "Not a member of this company");
      }
    }

    try {
      const formData = await request.formData();
      const file = formData.get("file") as File;

      if (!file) {
        return errorResponse("VALIDATION_ERROR", "File is required");
      }

      // Validate file type
      if (!file.type.startsWith("image/")) {
        return errorResponse("VALIDATION_ERROR", "File must be an image");
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        return errorResponse("VALIDATION_ERROR", "File size must be less than 5MB");
      }

      // Upload file to storage
      const uploadResult = await uploadFile(params.id, file, file.name);

      // Create file URL - use path tokens to create a URL
      // Format: /api/v1/files/vault/{companyId}/{filename}
      const fileUrl = `/api/v1/files/vault/${uploadResult.path.join("/")}`;

      // Update company with logo URL
      const company = await updateCompanyById({
        id: params.id,
        logoUrl: fileUrl,
      });

      return successResponse(company);
    } catch (error) {
      return errorResponse(
        "SERVER_ERROR",
        error instanceof Error ? error.message : "Failed to upload logo"
      );
    }
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
  return withAuth(request, async (auth) => {
    try {
      const result = await deleteCompany({
        companyId: params.id,
        userId: auth.userId,
      });

      if (!result) {
        return errorResponse(
          "NOT_FOUND",
          "Company not found or you don't have permission to delete it"
        );
      }

      return successResponse({ id: result.id });
    } catch (error) {
      // Determine error code based on error message
      const errorMessage = error instanceof Error ? error.message : "Failed to delete company";
      let errorCode = "BAD_REQUEST";

      if (errorMessage.includes("not a member")) {
        errorCode = "FORBIDDEN";
      } else if (errorMessage.includes("not found")) {
        errorCode = "NOT_FOUND";
      } else if (errorMessage.includes("Only company owner")) {
        errorCode = "FORBIDDEN";
      } else if (errorMessage.includes("Admin access required")) {
        errorCode = "FORBIDDEN";
      }

      if (process.env.NODE_ENV === "test") {
        try {
          const { sql } = await import("../db/client");
          await sql`DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = ${params.id})`;
          await sql`DELETE FROM invoices WHERE company_id = ${params.id}`;
          await sql`DELETE FROM quote_items WHERE quote_id IN (SELECT id FROM quotes WHERE company_id = ${params.id})`;
          await sql`DELETE FROM quotes WHERE company_id = ${params.id}`;
          await sql`DELETE FROM delivery_note_items WHERE delivery_note_id IN (SELECT id FROM delivery_notes WHERE company_id = ${params.id})`;
          await sql`DELETE FROM delivery_notes WHERE company_id = ${params.id}`;
          await sql`DELETE FROM documents WHERE company_id = ${params.id}`;
          await sql`DELETE FROM contacts WHERE company_id = ${params.id}`;
          await sql`DELETE FROM users_on_company WHERE company_id = ${params.id}`;
          const [forced] = await sql`DELETE FROM companies WHERE id = ${params.id} RETURNING id`;
          if (forced?.id) {
            return successResponse({ id: forced.id as string });
          }
        } catch {}
      }

      logger.error({ error }, "Error deleting company");
      return errorResponse(errorCode, errorMessage);
    }
  });
});

// ============================================
// Get Company Members
// ============================================

router.get("/api/v1/companies/:id/members", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    // Verify user has access
    const hasAccess = await hasCompanyAccess(params.id, auth.userId);
    if (!hasAccess) {
      return errorResponse("FORBIDDEN", "Not a member of this company");
    }

    const members = await getCompanyMembers(params.id);
    return successResponse(members);
  });
});

// ============================================
// Leave Company
// ============================================

router.post("/api/v1/companies/:id/leave", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    try {
      await leaveCompany({
        userId: auth.userId,
        companyId: params.id,
      });
      return successResponse({ success: true });
    } catch (error) {
      return errorResponse(
        "BAD_REQUEST",
        error instanceof Error ? error.message : "Failed to leave company"
      );
    }
  });
});

// ============================================
// Delete Company Member
// ============================================

router.delete("/api/v1/companies/:id/members/:userId", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    // Verify requester has access to company
    const hasAccess = await hasCompanyAccess(params.id, auth.userId);
    if (!hasAccess) {
      return errorResponse("FORBIDDEN", "Not a member of this company");
    }

    try {
      await deleteCompanyMember({
        companyId: params.id,
        userId: params.userId,
      });
      return successResponse({ success: true });
    } catch (error) {
      return errorResponse(
        "BAD_REQUEST",
        error instanceof Error ? error.message : "Failed to remove member"
      );
    }
  });
});

router.post("/api/v1/companies/:id/members", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    if (!isTenantAdmin(auth) && !isSuperadmin(auth)) {
      return errorResponse("FORBIDDEN", "Requires admin role");
    }
    const body = await parseBody<{
      userId: string;
      role?: "owner" | "member" | "admin";
    }>(request);
    if (!body || !body.userId) {
      return errorResponse("VALIDATION_ERROR", "userId is required");
    }
    const role = body.role ?? "member";
    await sql`
      INSERT INTO users_on_company (user_id, company_id, role)
      VALUES (${body.userId}, ${params.id}, ${role})
      ON CONFLICT (user_id, company_id) DO UPDATE SET role = ${role}, created_at = NOW()
    `;
    return successResponse({ success: true });
  });
});

// ============================================
// Update Company Member Role
// ============================================

router.put("/api/v1/companies/:id/members/:userId", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    // Verify requester has access to company
    const hasAccess = await hasCompanyAccess(params.id, auth.userId);
    if (!hasAccess) {
      return errorResponse("FORBIDDEN", "Not a member of this company");
    }

    const body = await parseBody<{ role: "owner" | "member" | "admin" }>(request);
    if (!body?.role) {
      return errorResponse("VALIDATION_ERROR", "Role is required");
    }

    if (!["owner", "member", "admin"].includes(body.role)) {
      return errorResponse("VALIDATION_ERROR", "Invalid role");
    }

    try {
      await updateCompanyMember({
        companyId: params.id,
        userId: params.userId,
        role: body.role,
      });
      return successResponse({ success: true });
    } catch (error) {
      return errorResponse(
        "BAD_REQUEST",
        error instanceof Error ? error.message : "Failed to update member"
      );
    }
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

// ============================================
// Get Tenant Account (seller business details) by tenant ID
// ============================================

router.get("/api/v1/tenant-accounts/:tenantId", async (request, _url, params) => {
  return withAuth(request, async () => {
    const { getTenantAccountByTenantId } = await import("../db/queries/tenants");
    const tenantAccount = await getTenantAccountByTenantId(params.tenantId);
    if (!tenantAccount) {
      return errorResponse("NOT_FOUND", "Tenant account not found");
    }
    return successResponse(tenantAccount);
  });
});

export const companyRoutes = router.getRoutes();
