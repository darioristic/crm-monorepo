/**
 * Company Routes
 */

import { errorResponse, successResponse } from "@crm/utils";
import { companiesService } from "../services/companies.service";
import { RouteBuilder, withAuth, parseBody, parsePagination, parseFilters } from "./helpers";
import type { CreateCompanyRequest, UpdateCompanyRequest } from "@crm/types";
import {
	getCompanyById,
	getCompaniesByUserId,
	getCompanyMembers,
	createCompany,
	updateCompanyById,
	deleteCompany,
	leaveCompany,
	deleteCompanyMember,
	updateCompanyMember,
	hasCompanyAccess,
} from "../db/queries/companies-members";
import { userQueries } from "../db/queries/users";
import { uploadFile } from "../services/file-storage.service";

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
      const companies = await getCompaniesByUserId(auth.userId);
      const detailed = await Promise.all(
        companies.map((c) => getCompanyById(c.id))
      );
      const fullCompanies = detailed.filter(Boolean) as Array<import("@crm/types").Company>;
      return successResponse(fullCompanies);
    }

		// Otherwise use the existing service for paginated/filtered list
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
		async (auth) => {
			const body = await parseBody<CreateCompanyRequest & { switchCompany?: boolean; source?: "account" | "customer" }>(request);
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
					logoUrl: (body as any).logoUrl || undefined,
					switchCompany: body.switchCompany ?? true, // Default to true
					source: body.source || "account", // Default to 'account' for regular company creation
				});

				const company = await getCompanyById(companyId);
				if (!company) {
					return errorResponse("SERVER_ERROR", "Failed to retrieve created company");
				}

				return successResponse(company);
			} catch (error) {
				return errorResponse(
					"SERVER_ERROR",
					error instanceof Error ? error.message : "Failed to create company",
				);
			}
		},
		201,
	);
});

// ============================================
// Update Company
// ============================================

router.put("/api/v1/companies/:id", async (request, _url, params) => {
	return withAuth(request, async (auth) => {
		// Verify user has access
		const hasAccess = await hasCompanyAccess(params.id, auth.userId);
		if (!hasAccess) {
			return errorResponse("FORBIDDEN", "Not a member of this company");
		}

		const body = await parseBody<UpdateCompanyRequest & { logoUrl?: string }>(request);
		if (!body) {
			return errorResponse("VALIDATION_ERROR", "Invalid request body");
		}

		try {
			// Handle base64 logo URL - if it's a data URL, extract the base64 part
			let logoUrl = (body as any).logoUrl;
			if (logoUrl && typeof logoUrl === "string" && logoUrl.startsWith("data:")) {
				// For now, keep base64 as-is (in production, upload to storage and get URL)
				// If base64 is too long, we might want to upload it to file storage
				if (logoUrl.length > 100000) { // ~100KB
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
				logoUrl: logoUrl,
			});

			return successResponse(company);
		} catch (error) {
			return errorResponse(
				"SERVER_ERROR",
				error instanceof Error ? error.message : "Failed to update company",
			);
		}
	});
});

// ============================================
// Upload Company Logo
// ============================================

router.post("/api/v1/companies/:id/logo", async (request, _url, params) => {
	return withAuth(request, async (auth) => {
		// Verify user has access
		const hasAccess = await hasCompanyAccess(params.id, auth.userId);
		if (!hasAccess) {
			return errorResponse("FORBIDDEN", "Not a member of this company");
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
				error instanceof Error ? error.message : "Failed to upload logo",
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
				return errorResponse("NOT_FOUND", "Company not found or you don't have permission to delete it");
			}

			return successResponse({ id: result.id });
		} catch (error) {
			return errorResponse(
				"BAD_REQUEST",
				error instanceof Error ? error.message : "Failed to delete company",
			);
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
				error instanceof Error ? error.message : "Failed to leave company",
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
				error instanceof Error ? error.message : "Failed to remove member",
			);
		}
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
				error instanceof Error ? error.message : "Failed to update member",
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
