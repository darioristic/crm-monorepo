/**
 * Company Routes
 */

import type { Company, CreateCompanyRequest, UpdateCompanyRequest } from "@crm/types";
import { errorResponse, successResponse } from "@crm/utils";
import { cache } from "../cache/redis";
import { sql } from "../db/client";
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
import { userQueries } from "../db/queries/users";
import { logger } from "../lib/logger";
import { isSuperadmin, isTenantAdmin } from "../middleware/auth";
import { companiesService } from "../services/companies.service";
import { uploadFile } from "../services/file-storage.service";
import { parseBody, parseFilters, parsePagination, RouteBuilder, withAuth } from "./helpers";

const router = new RouteBuilder();

// ============================================
// List Companies
// ============================================

// ============================================
// Get Current Company (active company for user)
// ============================================

router.get("/api/v1/companies/current", async (request) => {
  return withAuth(request, async (auth) => {
    const companyId = await userQueries.getUserCompanyId(auth.userId);
    if (!companyId) {
      return errorResponse("NOT_FOUND", "No active company");
    }

    const company = await getCompanyById(companyId);
    if (!company) {
      return errorResponse("NOT_FOUND", "Company not found");
    }

    return successResponse(company);
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
        memberCompanies = allCompanies.map((row: any) => ({
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
        let effectiveTenantId = auth.tenantId;

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
          memberCompanies = allTenantCompanies.map((row: any) => ({
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
        let effectiveTenantId = auth.tenantId;
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
        createdAt: c.createdAt,
        updatedAt: c.createdAt,
      }));
      return successResponse(companies);
    }

    // Otherwise use the existing service for paginated/filtered list
    const pagination = parsePagination(url);
    const filters = {
      ...parseFilters(url),
      tenantId: auth.tenantId,
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
          phone: (body as any).phone || undefined,
          website: (body as any).website || undefined,
          contact: (body as any).contact || undefined,
          city: (body as any).city || undefined,
          zip: (body as any).zip || undefined,
          country: (body as any).country || undefined,
          countryCode: (body as any).countryCode || undefined,
          vatNumber: (body as any).vatNumber || undefined,
          companyNumber: (body as any).companyNumber || undefined,
          note: (body as any).note || undefined,
          logoUrl: (body as any).logoUrl || undefined,
          switchCompany: false,
          source: "customer",
        });

        const company = await getCompanyById(companyId);
        if (!company) {
          return errorResponse("SERVER_ERROR", "Failed to retrieve created company");
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
      // Handle base64 logo URL - if it's a data URL, extract the base64 part
      const logoUrl = (body as any).logoUrl;
      if (logoUrl && typeof logoUrl === "string" && logoUrl.startsWith("data:")) {
        // For now, keep base64 as-is (in production, upload to storage and get URL)
        // If base64 is too long, we might want to upload it to file storage
        if (logoUrl.length > 100000) {
          // ~100KB
          // For large images, we should upload to storage
          // For now, just truncate or reject
          return errorResponse("VALIDATION_ERROR", "Image too large. Please use a smaller image.");
        }
      }

      const company = await updateCompanyById({
        id: params.id,
        name: body.name,
        industry: body.industry,
        address: body.address,
        email: body.email ?? undefined,
        phone: (body as any).phone ?? undefined,
        website: (body as any).website ?? undefined,
        contact: (body as any).contact ?? undefined,
        city: (body as any).city ?? undefined,
        zip: (body as any).zip ?? undefined,
        country: (body as any).country ?? undefined,
        countryCode: (body as any).countryCode ?? undefined,
        vatNumber: (body as any).vatNumber ?? undefined,
        companyNumber: (body as any).companyNumber ?? undefined,
        note: (body as any).note ?? undefined,
        logoUrl: logoUrl,
      });
      logger.info({ companyId: params.id }, "UPDATE_COMPANY_SUCCESS");

      return successResponse(company);
    } catch (error) {
      logger.error({ error, companyId: params.id }, "UPDATE_COMPANY_ERROR");
      return errorResponse(
        "SERVER_ERROR",
        error instanceof Error ? error.message : "Failed to update company"
      );
    }
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
      } else if (errorMessage.includes("Cannot delete company")) {
        errorCode = "CONFLICT";
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

export const companyRoutes = router.getRoutes();
