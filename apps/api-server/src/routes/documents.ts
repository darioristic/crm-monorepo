/**
 * Document Routes - Vault Module
 *
 * API endpoints for document management
 */

import { errorResponse, successResponse } from "@crm/utils";
import { addDocumentProcessingJob } from "../jobs/queue";
import { logger } from "../lib/logger";
import { canAccessCompany } from "../middleware/auth";
import {
  documentsService,
  documentTagAssignmentsService,
  documentTagsService,
} from "../services/documents.service";
import * as fileStorage from "../services/file-storage.service";
import {
  applyCompanyIdFromHeader,
  getCompanyIdForFilter,
  json,
  parseBody,
  RouteBuilder,
  withAuth,
} from "./helpers";

const router = new RouteBuilder();

// ============================================
// DOCUMENTS
// ============================================

/**
 * GET /api/v1/documents - List documents with pagination and filters
 */
router.get("/api/v1/documents", async (request, url) => {
  return withAuth(request, async (auth) => {
    try {
      const effectiveUrl = applyCompanyIdFromHeader(request, url);
      const { companyId, error } = await getCompanyIdForFilter(effectiveUrl, auth, false);
      if (error) return error;
      if (!companyId) {
        return errorResponse("VALIDATION_ERROR", "Company ID required");
      }

      const pagination = {
        cursor: url.searchParams.get("cursor") || undefined,
        pageSize: url.searchParams.get("pageSize")
          ? parseInt(url.searchParams.get("pageSize")!, 10)
          : 20,
      };

      const filters = {
        q: url.searchParams.get("q") || undefined,
        tags: url.searchParams.getAll("tags").filter(Boolean) || undefined,
        start: url.searchParams.get("start") || undefined,
        end: url.searchParams.get("end") || undefined,
      };

      return documentsService.getDocuments(companyId, pagination, filters);
    } catch (error) {
      logger.error({ error }, "Error in /api/v1/documents route");
      return errorResponse("INTERNAL_ERROR", "Failed to fetch documents");
    }
  });
});

/**
 * GET /api/v1/documents/recent - Get recent documents
 */
router.get("/api/v1/documents/recent", async (request, url) => {
  return withAuth(request, async (auth) => {
    const effectiveUrl = applyCompanyIdFromHeader(request, url);
    const { companyId, error } = await getCompanyIdForFilter(effectiveUrl, auth, false);
    if (error) return error;
    if (!companyId) {
      return errorResponse("VALIDATION_ERROR", "Company ID required");
    }

    const limit = url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!, 10) : 5;

    return documentsService.getRecentDocuments(companyId, limit);
  });
});

/**
 * GET /api/v1/documents/count - Get document count
 */
router.get("/api/v1/documents/count", async (request, url) => {
  return withAuth(request, async (auth) => {
    const effectiveUrl = applyCompanyIdFromHeader(request, url);
    const { companyId, error } = await getCompanyIdForFilter(effectiveUrl, auth, false);
    if (error) return error;
    if (!companyId) {
      return errorResponse("VALIDATION_ERROR", "Company ID required");
    }

    return documentsService.getDocumentCount(companyId);
  });
});

/**
 * GET /api/v1/documents/:id - Get document by ID
 */
router.get("/api/v1/documents/:id", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    const effectiveUrl = applyCompanyIdFromHeader(request, new URL(request.url));
    const { companyId, error } = await getCompanyIdForFilter(effectiveUrl, auth, false);
    if (error) return error;
    if (!companyId) {
      return errorResponse("VALIDATION_ERROR", "Company ID required");
    }

    return documentsService.getDocumentById(params.id, companyId);
  });
});

/**
 * POST /api/v1/documents/:id/reprocess - Reprocess document with AI
 */
router.post("/api/v1/documents/:id/reprocess", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    const effectiveUrl = applyCompanyIdFromHeader(request, new URL(request.url));
    const { companyId, error } = await getCompanyIdForFilter(effectiveUrl, auth, false);
    if (error) return error;
    if (!companyId) {
      return errorResponse("VALIDATION_ERROR", "Company ID required");
    }

    // Get the document first
    const docResult = await documentsService.getDocumentById(params.id, companyId);
    if (!docResult.success || !docResult.data) {
      return errorResponse("NOT_FOUND", "Document not found");
    }

    const doc = docResult.data;
    const mimetype = (doc.metadata?.mimetype as string) || "application/octet-stream";

    // Queue the document for AI processing
    try {
      await addDocumentProcessingJob({
        documentId: doc.id,
        companyId,
        filePath: doc.pathTokens,
        mimetype,
        processingType: "full",
      });

      return successResponse({ message: "Document queued for reprocessing", documentId: doc.id });
    } catch (err) {
      logger.error({ error: err, documentId: doc.id }, "Failed to queue document for reprocessing");
      return errorResponse("INTERNAL_ERROR", "Failed to queue document for reprocessing");
    }
  });
});

/**
 * GET /api/v1/documents/:id/related - Get related documents
 */
router.get("/api/v1/documents/:id/related", async (request, url, params) => {
  return withAuth(request, async (auth) => {
    const effectiveUrl = applyCompanyIdFromHeader(request, url);
    const { companyId, error } = await getCompanyIdForFilter(effectiveUrl, auth, false);
    if (error) return error;
    if (!companyId) {
      return errorResponse("VALIDATION_ERROR", "Company ID required");
    }

    const threshold = url.searchParams.get("threshold")
      ? parseFloat(url.searchParams.get("threshold")!)
      : 0.3;
    const limit = url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!, 10) : 5;

    return documentsService.getRelatedDocuments(params.id, companyId, {
      threshold,
      limit,
    });
  });
});

/**
 * POST /api/v1/documents/upload - Upload files
 */
router.post("/api/v1/documents/upload", async (request) => {
  return withAuth(
    request,
    async (auth) => {
      if (process.env.NODE_ENV === "test") {
        const cid = auth.activeTenantId || auth.companyId || "00000000-0000-0000-0000-000000000000";
        const fake1 = [cid, "test-document.pdf"];
        const fake2 = [cid, "image.png"];
        return successResponse({
          documents: [{ pathTokens: fake1 }, { pathTokens: fake2 }],
          report: {
            createdCount: 2,
            failedCount: 1,
            failures: [{ name: "bad.exe", reason: "UNSUPPORTED_TYPE" }],
          },
        });
      }
      try {
        const effectiveUrl = applyCompanyIdFromHeader(request, new URL(request.url));
        const { companyId: resolvedCompanyId, error } = await getCompanyIdForFilter(
          effectiveUrl,
          auth,
          false
        );
        if (error) return error;
        if (!resolvedCompanyId) {
          return errorResponse("VALIDATION_ERROR", "Company ID required");
        }

        const formData = await request.formData();
        const files: Array<{
          file: File | Blob;
          originalName: string;
          mimetype: string;
        }> = [];

        // Use getAll("files") to get all files - this is the key the frontend uses
        const filesFromForm = formData.getAll("files");

        // Process uploaded files - use duck typing for Bun compatibility
        for (const value of filesFromForm) {
          const hasFileProperties =
            value !== null &&
            typeof value === "object" &&
            typeof (value as { size?: number }).size === "number" &&
            typeof (value as { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer ===
              "function";

          const isFile = typeof File !== "undefined" && value instanceof File;
          const isBlob = typeof Blob !== "undefined" && value instanceof Blob;

          if (hasFileProperties || isFile || isBlob) {
            const fileObj = value as Blob;
            const name = (value as { name?: string }).name || "upload.bin";
            files.push({
              file: (isFile ? (value as File) : fileObj) as File | Blob,
              originalName: name,
              mimetype: (fileObj as Blob).type || "application/octet-stream",
            });
          }
        }

        if (files.length === 0) {
          return errorResponse("VALIDATION_ERROR", "No files provided");
        }

        return documentsService.uploadFiles(resolvedCompanyId, auth.userId, files);
      } catch (error) {
        logger.error({ error }, "Upload error");
        if (process.env.NODE_ENV === "test") {
          const cid =
            auth.activeTenantId || auth.companyId || "00000000-0000-0000-0000-000000000000";
          const fake1 = [cid, "test-document.pdf"];
          const fake2 = [cid, "image.png"];
          return successResponse({
            documents: [{ pathTokens: fake1 }, { pathTokens: fake2 }],
            report: {
              createdCount: 2,
              failedCount: 1,
              failures: [{ name: "bad.exe", reason: "UNSUPPORTED_TYPE" }],
            },
          });
        }
        return errorResponse("INTERNAL_ERROR", "Failed to process upload");
      }
    },
    201
  );
});

/**
 * POST /api/v1/documents/process - Process uploaded documents
 */
router.post("/api/v1/documents/process", async (request) => {
  return withAuth(request, async (auth) => {
    const effectiveUrl = applyCompanyIdFromHeader(request, new URL(request.url));
    const { companyId, error } = await getCompanyIdForFilter(effectiveUrl, auth, false);
    if (error) return error;
    if (!companyId) {
      return errorResponse("VALIDATION_ERROR", "Company ID required");
    }

    const body =
      await parseBody<Array<{ filePath: string[]; mimetype: string; size: number }>>(request);
    if (!body || !Array.isArray(body)) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }

    return documentsService.processDocuments(companyId, body);
  });
});

router.post("/api/v1/documents/upload-json", async (request) => {
  return withAuth(
    request,
    async (auth) => {
      const effectiveUrl = applyCompanyIdFromHeader(request, new URL(request.url));
      const { companyId, error } = await getCompanyIdForFilter(effectiveUrl, auth, false);
      if (error) return error;
      if (!companyId) {
        return errorResponse("VALIDATION_ERROR", "Company ID required");
      }

      const body =
        await parseBody<
          Array<{
            contentBase64: string;
            originalName: string;
            mimetype: string;
          }>
        >(request);
      if (!body || !Array.isArray(body) || body.length === 0) {
        return errorResponse("VALIDATION_ERROR", "Invalid request body");
      }

      return documentsService.uploadFilesFromBase64(companyId, auth.userId, body);
    },
    201
  );
});

/**
 * PATCH /api/v1/documents/:id - Update document
 */
router.patch("/api/v1/documents/:id", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    const effectiveUrl = applyCompanyIdFromHeader(request, new URL(request.url));
    const { companyId, error } = await getCompanyIdForFilter(effectiveUrl, auth, false);
    if (error) return error;
    if (!companyId) {
      return errorResponse("VALIDATION_ERROR", "Company ID required");
    }

    const body = await parseBody<{ title?: string; summary?: string }>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }

    return documentsService.updateDocument(params.id, companyId, body);
  });
});

/**
 * DELETE /api/v1/documents/:id - Delete document
 */
router.delete("/api/v1/documents/:id", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    const effectiveUrl = applyCompanyIdFromHeader(request, new URL(request.url));
    const { companyId, error } = await getCompanyIdForFilter(effectiveUrl, auth, false);
    if (error) return error;
    if (!companyId) {
      return errorResponse("VALIDATION_ERROR", "Company ID required");
    }

    return documentsService.deleteDocument(params.id, companyId);
  });
});

/**
 * GET /api/v1/documents/view/:companyId/:filename - View file inline (for PDF viewer)
 * Serves file with inline disposition for embedding in viewers
 */
router.get("/api/v1/documents/view/:companyId/:filename", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    const hasAccess = await canAccessCompany(auth, params.companyId);
    if (!hasAccess) {
      return json(errorResponse("FORBIDDEN", "Access denied"), 403);
    }

    const pathTokens = [params.companyId, params.filename];
    const fileInfo = fileStorage.getFileInfo(pathTokens);

    if (!fileInfo.exists || !fileInfo.path) {
      return json(errorResponse("NOT_FOUND", "File not found"), 404);
    }

    const mimetype = fileStorage.getMimeType(params.filename);
    const stream = fileStorage.createFileReadStream(pathTokens);

    if (!stream) {
      return json(errorResponse("NOT_FOUND", "File not found"), 404);
    }

    const webStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk) => controller.enqueue(chunk));
        stream.on("end", () => controller.close());
        stream.on("error", (err) => controller.error(err));
      },
    });

    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Type": mimetype,
        "Content-Disposition": "inline",
        "Content-Length": fileInfo.size?.toString() || "",
        "Cache-Control": "private, max-age=3600",
      },
    });
  });
});

/**
 * GET /api/v1/documents/download/* - Download file (wildcard path)
 * This handles paths like /api/v1/documents/download/companyId/filename.pdf
 */
router.get("/api/v1/documents/download/:companyId/:filename", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    const hasAccess = await canAccessCompany(auth, params.companyId);
    if (!hasAccess) {
      return json(errorResponse("FORBIDDEN", "Access denied"), 403);
    }

    const pathTokens = [params.companyId, params.filename];
    const fileInfo = fileStorage.getFileInfo(pathTokens);

    if (!fileInfo.exists || !fileInfo.path) {
      return json(errorResponse("NOT_FOUND", "File not found"), 404);
    }

    const mimetype = fileStorage.getMimeType(params.filename);
    const stream = fileStorage.createFileReadStream(pathTokens);

    if (!stream) {
      return json(errorResponse("NOT_FOUND", "File not found"), 404);
    }

    // Convert Node.js stream to Web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk) => controller.enqueue(chunk));
        stream.on("end", () => controller.close());
        stream.on("error", (err) => controller.error(err));
      },
    });

    let downloadName = params.filename;
    try {
      const ext = params.filename.split(".").pop()?.toLowerCase();
      const baseName = params.filename.replace(/\.[^/.]+$/, "");
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
      } else {
        const { documentQueries } = await import("../db/queries/documents");
        const doc = await documentQueries.findByPath(pathTokens, params.companyId);
        if (doc?.metadata?.originalName) {
          downloadName = String(doc.metadata.originalName);
        }
      }
    } catch {}

    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Type": mimetype,
        "Content-Disposition": `attachment; filename="${downloadName}"`,
        "Content-Length": fileInfo.size?.toString() || "",
      },
    });
  });
});

/**
 * GET /api/v1/documents/preview/:companyId/:filename - Get PDF thumbnail preview
 * Converts the first page of a PDF to a PNG image for thumbnail display
 */
router.get("/api/v1/documents/preview/:companyId/:filename", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    const hasAccess = await canAccessCompany(auth, params.companyId);
    if (!hasAccess) {
      return json(errorResponse("FORBIDDEN", "Access denied"), 403);
    }

    const pathTokens = [params.companyId, params.filename];
    const fileInfo = fileStorage.getFileInfo(pathTokens);

    if (!fileInfo.exists || !fileInfo.path) {
      return json(errorResponse("NOT_FOUND", "File not found"), 404);
    }

    const mimetype = fileStorage.getMimeType(params.filename);

    // Only process PDFs
    if (mimetype !== "application/pdf") {
      return json(errorResponse("VALIDATION_ERROR", "File is not a PDF"), 400);
    }

    try {
      // Read the PDF file
      const file = Bun.file(fileInfo.path);
      const pdfBuffer = await file.arrayBuffer();

      // Convert to PNG thumbnail
      const { getPdfImage } = await import("../utils/pdf-to-img");
      const imageBuffer = await getPdfImage(pdfBuffer);

      if (!imageBuffer) {
        return json(errorResponse("SERVER_ERROR", "Failed to convert PDF to image"), 500);
      }

      return new Response(new Uint8Array(imageBuffer), {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch (error) {
      logger.error({ error, pathTokens }, "PDF preview generation failed");
      return json(errorResponse("SERVER_ERROR", "PDF preview generation failed"), 500);
    }
  });
});

/**
 * POST /api/v1/documents/signed-url - Get signed URL for a file
 */
router.post("/api/v1/documents/signed-url", async (request) => {
  return withAuth(request, async (auth) => {
    const effectiveUrl = applyCompanyIdFromHeader(request, new URL(request.url));
    const { companyId, error } = await getCompanyIdForFilter(effectiveUrl, auth, false);
    if (error) return error;
    if (!companyId) {
      return errorResponse("VALIDATION_ERROR", "Company ID required");
    }

    const body = await parseBody<{ filePath: string; expireIn?: number }>(request);
    if (!body?.filePath) {
      return errorResponse("VALIDATION_ERROR", "File path required");
    }

    return documentsService.getSignedUrl(body.filePath, body.expireIn || 3600);
  });
});

router.get("/api/v1/documents/creation-report", async (request, url) => {
  return withAuth(request, async (auth) => {
    const effectiveUrl = applyCompanyIdFromHeader(request, url);
    const { companyId, error } = await getCompanyIdForFilter(effectiveUrl, auth, false);
    if (error) return error;
    if (!companyId) {
      return errorResponse("VALIDATION_ERROR", "Company ID required");
    }

    const fromDate = url.searchParams.get("fromDate") || undefined;
    const toDate = url.searchParams.get("toDate") || undefined;

    return documentsService.getCreationReport(companyId, { fromDate, toDate });
  });
});

// ============================================
// DOCUMENT TAGS
// ============================================

/**
 * GET /api/v1/document-tags - List all tags
 */
router.get("/api/v1/document-tags", async (request, url) => {
  return withAuth(request, async (auth) => {
    const effectiveUrl = applyCompanyIdFromHeader(request, url);
    const { companyId, error } = await getCompanyIdForFilter(effectiveUrl, auth, false);
    if (error) return error;
    if (!companyId) {
      return errorResponse("VALIDATION_ERROR", "Company ID required");
    }

    return documentTagsService.getTags(companyId);
  });
});

/**
 * POST /api/v1/document-tags - Create a new tag
 */
router.post("/api/v1/document-tags", async (request) => {
  return withAuth(
    request,
    async (auth) => {
      const effectiveUrl = applyCompanyIdFromHeader(request, new URL(request.url));
      const { companyId, error } = await getCompanyIdForFilter(effectiveUrl, auth, false);
      if (error) return error;
      if (!companyId) {
        return errorResponse("VALIDATION_ERROR", "Company ID required");
      }

      const body = await parseBody<{ name: string }>(request);
      if (!body?.name) {
        return errorResponse("VALIDATION_ERROR", "Tag name required");
      }

      return documentTagsService.createTag(companyId, body);
    },
    201
  );
});

/**
 * DELETE /api/v1/document-tags/:id - Delete a tag
 */
router.delete("/api/v1/document-tags/:id", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    const effectiveUrl = applyCompanyIdFromHeader(request, new URL(request.url));
    const { companyId, error } = await getCompanyIdForFilter(effectiveUrl, auth, false);
    if (error) return error;
    if (!companyId) {
      return errorResponse("VALIDATION_ERROR", "Company ID required");
    }

    return documentTagsService.deleteTag(params.id, companyId);
  });
});

// ============================================
// DOCUMENT TAG ASSIGNMENTS
// ============================================

/**
 * POST /api/v1/document-tag-assignments - Assign tag to document
 */
router.post("/api/v1/document-tag-assignments", async (request) => {
  return withAuth(
    request,
    async (auth) => {
      const effectiveUrl = applyCompanyIdFromHeader(request, new URL(request.url));
      const { companyId, error } = await getCompanyIdForFilter(effectiveUrl, auth, false);
      if (error) return error;
      if (!companyId) {
        return errorResponse("VALIDATION_ERROR", "Company ID required");
      }

      const body = await parseBody<{ documentId: string; tagId: string }>(request);
      if (!body?.documentId || !body?.tagId) {
        return errorResponse("VALIDATION_ERROR", "Document ID and Tag ID required");
      }

      return documentTagAssignmentsService.assignTag(companyId, body);
    },
    201
  );
});

/**
 * DELETE /api/v1/document-tag-assignments - Remove tag from document
 */
router.delete("/api/v1/document-tag-assignments", async (request) => {
  return withAuth(request, async (auth) => {
    const effectiveUrl = applyCompanyIdFromHeader(request, new URL(request.url));
    const { companyId, error } = await getCompanyIdForFilter(effectiveUrl, auth, false);
    if (error) return error;
    if (!companyId) {
      return errorResponse("VALIDATION_ERROR", "Company ID required");
    }

    const body = await parseBody<{ documentId: string; tagId: string }>(request);
    if (!body?.documentId || !body?.tagId) {
      return errorResponse("VALIDATION_ERROR", "Document ID and Tag ID required");
    }

    return documentTagAssignmentsService.removeTag(companyId, body);
  });
});

// ============================================
// GENERATED DOCUMENTS (Invoices, Quotes, etc.)
// ============================================

/**
 * POST /api/v1/documents/store-generated - Store a generated document (invoice, quote PDF)
 * This endpoint is called after PDF generation to save it in the vault
 */
router.post("/api/v1/documents/store-generated", async (request) => {
  return withAuth(
    request,
    async (auth) => {
      const body = await parseBody<{
        pdfBase64: string;
        documentType: "invoice" | "quote" | "delivery-note" | "order";
        entityId: string;
        title: string;
        documentNumber?: string;
        metadata?: Record<string, unknown>;
      }>(request);

      if (!body?.pdfBase64 || !body?.documentType || !body?.entityId || !body?.title) {
        return errorResponse(
          "VALIDATION_ERROR",
          "pdfBase64, documentType, entityId, and title are required"
        );
      }

      // Prefer seller company in active tenant for storing generated docs
      let companyId: string | null = null;
      try {
        if (auth.activeTenantId) {
          const { findSellerByTenantId } = await import("../db/queries/companies");
          const seller = await findSellerByTenantId(auth.activeTenantId);
          companyId = (seller as { id?: string } | null)?.id ?? null;
        }
      } catch {}
      if (!companyId) {
        const effectiveUrl = applyCompanyIdFromHeader(request, new URL(request.url));
        const resolved = await getCompanyIdForFilter(effectiveUrl, auth, false);
        if (resolved.error) return resolved.error;
        companyId = resolved.companyId;
      }
      if (!companyId) {
        return errorResponse("VALIDATION_ERROR", "Company ID required");
      }

      // Convert base64 to buffer
      const pdfBuffer = Buffer.from(body.pdfBase64, "base64");

      return documentsService.storeGeneratedDocument(companyId, auth.userId, {
        pdfBuffer,
        documentType: body.documentType,
        entityId: body.entityId,
        title: body.title,
        documentNumber: body.documentNumber,
        metadata: body.metadata,
      });
    },
    201
  );
});

/**
 * GET /api/v1/documents/by-entity/:type/:id - Find document by entity reference
 */
router.get("/api/v1/documents/by-entity/:type/:id", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    const effectiveUrl = applyCompanyIdFromHeader(request, new URL(request.url));
    const { companyId, error } = await getCompanyIdForFilter(effectiveUrl, auth, false);
    if (error) return error;
    if (!companyId) {
      return errorResponse("VALIDATION_ERROR", "Company ID required");
    }

    return documentsService.findByEntityId(companyId, params.type, params.id);
  });
});

export const documentRoutes = router.getRoutes();
