/**
 * File Routes - Serve uploaded files
 */

import { RouteBuilder, withAuth } from "./helpers";
import { errorResponse } from "@crm/utils";
import { readFileAsBuffer, getFullPath } from "../services/file-storage.service";
import { existsSync } from "node:fs";

const router = new RouteBuilder();

/**
 * GET /api/v1/files/vault/:companyId/:filename
 * Serve files from vault storage
 */
router.get("/api/v1/files/vault/:companyId/:filename", async (request, _url, params) => {
	return withAuth(request, async (auth) => {
		const { companyId, filename } = params;

		// Verify user has access to this company's files
		const { hasCompanyAccess } = await import("../db/queries/companies-members");
		const hasAccess = await hasCompanyAccess(companyId, auth.userId);
		
		if (!hasAccess && auth.role !== "tenant_admin" && auth.role !== "superadmin") {
			return errorResponse("FORBIDDEN", "Access denied");
		}

		try {
			const pathTokens = [companyId, filename];
			const filePath = getFullPath(pathTokens);

			// Check if file exists
			if (!existsSync(filePath)) {
				return errorResponse("NOT_FOUND", "File not found");
			}

			// Read file as buffer
			const buffer = await readFileAsBuffer(pathTokens);
			if (!buffer) {
				return errorResponse("NOT_FOUND", "File not found");
			}

			// Determine content type from file extension
			const ext = filename.split(".").pop()?.toLowerCase();
			const contentTypeMap: Record<string, string> = {
				jpg: "image/jpeg",
				jpeg: "image/jpeg",
				png: "image/png",
				gif: "image/gif",
				webp: "image/webp",
				svg: "image/svg+xml",
				pdf: "application/pdf",
			};
			const contentType = contentTypeMap[ext || ""] || "application/octet-stream";

			// Return file with appropriate headers
			return new Response(buffer, {
				headers: {
					"Content-Type": contentType,
					"Content-Length": buffer.length.toString(),
					"Cache-Control": "public, max-age=31536000", // Cache for 1 year
				},
			});
		} catch (error) {
			return errorResponse(
				"SERVER_ERROR",
				error instanceof Error ? error.message : "Failed to serve file",
			);
		}
	});
});

export const fileRoutes = router.getRoutes();
