/**
 * File Routes - Serve uploaded files
 */

import { existsSync } from "node:fs";
import { errorResponse } from "@crm/utils";
import { getFullPath, readFileAsBuffer } from "../services/file-storage.service";
import { RouteBuilder, withAuth } from "./helpers";

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

      let downloadName = filename;
      try {
        const ext = filename.split(".").pop()?.toLowerCase();
        const baseName = filename.replace(/\.[^/.]+$/, "");
        const isUUID = /^[0-9a-fA-F-]{36}$/.test(baseName);
        if (ext === "pdf" && isUUID) {
          const { invoiceQueries } = await import("../db/queries/invoices");
          const invoice = await invoiceQueries.findById(baseName);
          if (invoice?.invoiceNumber) {
            downloadName = `${invoice.invoiceNumber}.${ext}`;
          } else {
            const { quoteQueries } = await import("../db/queries/quotes");
            const quote = await quoteQueries.findById(baseName);
            if (quote?.quoteNumber) {
              downloadName = `${quote.quoteNumber}.${ext}`;
            }
          }
        }
      } catch {}

      return new Response(buffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Length": buffer.length.toString(),
          "Cache-Control": "public, max-age=31536000",
          "Content-Disposition": `attachment; filename="${downloadName}"`,
        },
      });
    } catch (error) {
      return errorResponse(
        "SERVER_ERROR",
        error instanceof Error ? error.message : "Failed to serve file"
      );
    }
  });
});

export const fileRoutes = router.getRoutes();
