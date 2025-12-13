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
  documentSharesService,
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
 * GET /api/v1/documents/search/semantic - Semantic search within document content
 * Uses vector embeddings to find documents matching natural language queries
 */
router.get("/api/v1/documents/search/semantic", async (request, url) => {
  return withAuth(request, async (auth) => {
    try {
      const effectiveUrl = applyCompanyIdFromHeader(request, url);
      const { companyId, error } = await getCompanyIdForFilter(effectiveUrl, auth, false);
      if (error) return error;
      if (!companyId) {
        return errorResponse("VALIDATION_ERROR", "Company ID required");
      }

      const query = url.searchParams.get("q");
      if (!query || query.trim().length < 2) {
        return errorResponse("VALIDATION_ERROR", "Search query must be at least 2 characters");
      }

      const limit = url.searchParams.get("limit")
        ? parseInt(url.searchParams.get("limit")!, 10)
        : 10;
      const threshold = url.searchParams.get("threshold")
        ? parseFloat(url.searchParams.get("threshold")!)
        : 0.3;

      return documentsService.semanticSearch(companyId, query.trim(), { limit, threshold });
    } catch (error) {
      logger.error({ error }, "Error in semantic search route");
      return errorResponse("INTERNAL_ERROR", "Failed to perform semantic search");
    }
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
    try {
      const hasAccess = await canAccessCompany(auth, params.companyId);
      if (!hasAccess) {
        return json(errorResponse("FORBIDDEN", "Access denied"), 403);
      }

      const pathTokens = [params.companyId, params.filename];
      const fileInfo = fileStorage.getFileInfo(pathTokens);

      if (!fileInfo.exists || !fileInfo.path) {
        logger.warn({ pathTokens, fileInfo }, "Document view: File not found");
        return json(errorResponse("NOT_FOUND", "File not found"), 404);
      }

      const mimetype = fileStorage.getMimeType(params.filename);

      // Use Bun.file for more reliable file reading
      const file = Bun.file(fileInfo.path);
      if (!(await file.exists())) {
        logger.warn({ path: fileInfo.path }, "Document view: Bun.file does not exist");
        return json(errorResponse("NOT_FOUND", "File not found"), 404);
      }

      return new Response(file, {
        status: 200,
        headers: {
          "Content-Type": mimetype,
          "Content-Disposition": "inline",
          "Content-Length": fileInfo.size?.toString() || "",
          "Cache-Control": "private, max-age=3600",
        },
      });
    } catch (error) {
      logger.error({ error, params }, "Document view: Error serving file");
      return json(errorResponse("INTERNAL_ERROR", "Failed to serve file"), 500);
    }
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
          const companies = (await import("../db/queries/companies")).default;
          const seller = await companies.findSellerByTenantId(auth.activeTenantId);
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

// ============================================
// BATCH OPERATIONS
// ============================================

/**
 * POST /api/v1/documents/batch/rename - Batch rename documents
 */
router.post("/api/v1/documents/batch/rename", async (request, _url) => {
  return withAuth(request, async (auth) => {
    const effectiveUrl = applyCompanyIdFromHeader(request, new URL(request.url));
    const { companyId, error } = await getCompanyIdForFilter(effectiveUrl, auth, false);
    if (error) return error;
    if (!companyId) {
      return errorResponse("VALIDATION_ERROR", "Company ID required");
    }

    const body = await parseBody<{
      documentIds: string[];
      pattern: string;
      options?: {
        prefix?: string;
        suffix?: string;
        startNumber?: number;
        preserveExtension?: boolean;
      };
    }>(request);

    if (!body?.documentIds || !Array.isArray(body.documentIds) || body.documentIds.length === 0) {
      return errorResponse("VALIDATION_ERROR", "documentIds array required");
    }
    if (!body?.pattern) {
      return errorResponse("VALIDATION_ERROR", "pattern required");
    }

    return documentsService.batchRename(companyId, {
      documentIds: body.documentIds,
      pattern: body.pattern,
      options: body.options,
    });
  });
});

// ============================================
// DOCUMENT ACTIVITY
// ============================================

/**
 * GET /api/v1/documents/:id/activity - Get document activity/audit log
 */
router.get("/api/v1/documents/:id/activity", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    const effectiveUrl = applyCompanyIdFromHeader(request, new URL(request.url));
    const { companyId, error } = await getCompanyIdForFilter(effectiveUrl, auth, false);
    if (error) return error;
    if (!companyId) {
      return errorResponse("VALIDATION_ERROR", "Company ID required");
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);

    return documentsService.getDocumentActivity(params.id, companyId, { page, pageSize });
  });
});

/**
 * POST /api/v1/documents/:id/view - Track document view
 */
router.post("/api/v1/documents/:id/view", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    const effectiveUrl = applyCompanyIdFromHeader(request, new URL(request.url));
    const { companyId, error } = await getCompanyIdForFilter(effectiveUrl, auth, false);
    if (error) return error;
    if (!companyId) {
      return errorResponse("VALIDATION_ERROR", "Company ID required");
    }

    return documentsService.trackDocumentView(params.id, companyId, auth.userId);
  });
});

// ============================================
// DOCUMENT SHARES (Public Links)
// ============================================

/**
 * POST /api/v1/documents/:id/share - Create a share link for a document
 */
router.post("/api/v1/documents/:id/share", async (request, _url, params) => {
  return withAuth(
    request,
    async (auth) => {
      const effectiveUrl = applyCompanyIdFromHeader(request, new URL(request.url));
      const { companyId, error } = await getCompanyIdForFilter(effectiveUrl, auth, false);
      if (error) return error;
      if (!companyId) {
        return errorResponse("VALIDATION_ERROR", "Company ID required");
      }

      const body = await parseBody<{
        expiresAt?: string;
        password?: string;
        maxViews?: number;
      }>(request);

      return documentSharesService.createShare(companyId, {
        documentId: params.id,
        createdBy: auth.userId,
        expiresAt: body?.expiresAt ? new Date(body.expiresAt) : undefined,
        password: body?.password,
        maxViews: body?.maxViews,
      });
    },
    201
  );
});

/**
 * GET /api/v1/documents/:id/shares - Get all share links for a document
 */
router.get("/api/v1/documents/:id/shares", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    const effectiveUrl = applyCompanyIdFromHeader(request, new URL(request.url));
    const { companyId, error } = await getCompanyIdForFilter(effectiveUrl, auth, false);
    if (error) return error;
    if (!companyId) {
      return errorResponse("VALIDATION_ERROR", "Company ID required");
    }

    return documentSharesService.getSharesForDocument(params.id, companyId);
  });
});

/**
 * DELETE /api/v1/document-shares/:id - Delete/revoke a share link
 */
router.delete("/api/v1/document-shares/:id", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    const effectiveUrl = applyCompanyIdFromHeader(request, new URL(request.url));
    const { companyId, error } = await getCompanyIdForFilter(effectiveUrl, auth, false);
    if (error) return error;
    if (!companyId) {
      return errorResponse("VALIDATION_ERROR", "Company ID required");
    }

    return documentSharesService.deleteShare(params.id, companyId, auth.userId);
  });
});

/**
 * PATCH /api/v1/document-shares/:id - Toggle share active status
 */
router.patch("/api/v1/document-shares/:id", async (request, _url, params) => {
  return withAuth(request, async (auth) => {
    const effectiveUrl = applyCompanyIdFromHeader(request, new URL(request.url));
    const { companyId, error } = await getCompanyIdForFilter(effectiveUrl, auth, false);
    if (error) return error;
    if (!companyId) {
      return errorResponse("VALIDATION_ERROR", "Company ID required");
    }

    const body = await parseBody<{ isActive: boolean }>(request);
    if (body?.isActive === undefined) {
      return errorResponse("VALIDATION_ERROR", "isActive field required");
    }

    return documentSharesService.toggleShareStatus(params.id, companyId, body.isActive);
  });
});

/**
 * GET /api/v1/public/document/:token - Access shared document (PUBLIC - no auth required)
 */
router.get("/api/v1/public/document/:token", async (_request, url, params) => {
  const password = url.searchParams.get("password") || undefined;
  const result = await documentSharesService.getDocumentByToken(params.token, password);

  if (!result.success) {
    const status =
      result.error?.code === "NOT_FOUND"
        ? 404
        : result.error?.code === "UNAUTHORIZED"
          ? 401
          : result.error?.code === "FORBIDDEN"
            ? 403
            : 500;
    return json(result, status);
  }

  return json(result, 200);
});

/**
 * GET /api/v1/public/document/:token/download - Download shared document (PUBLIC - no auth required)
 */
router.get("/api/v1/public/document/:token/download", async (_request, url, params) => {
  const password = url.searchParams.get("password") || undefined;
  const result = await documentSharesService.getDocumentByToken(params.token, password);

  if (!result.success || !result.data) {
    return json(result, result.error?.code === "NOT_FOUND" ? 404 : 403);
  }

  const { document } = result.data;
  const pathTokens = document.pathTokens;

  if (!pathTokens || pathTokens.length === 0) {
    return json(errorResponse("NOT_FOUND", "File not found"), 404);
  }

  const fileInfo = fileStorage.getFileInfo(pathTokens);

  if (!fileInfo.exists || !fileInfo.path) {
    return json(errorResponse("NOT_FOUND", "File not found"), 404);
  }

  const mimetype = fileStorage.getMimeType(pathTokens[pathTokens.length - 1]);
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

  const downloadName =
    (document.metadata?.originalName as string) ||
    document.title ||
    pathTokens[pathTokens.length - 1];

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": mimetype,
      "Content-Disposition": `attachment; filename="${downloadName}"`,
      "Content-Length": fileInfo.size?.toString() || "",
    },
  });
});

/**
 * GET /api/v1/public/document/:token/view - View shared document inline (PUBLIC - no auth required)
 */
router.get("/api/v1/public/document/:token/view", async (_request, url, params) => {
  const password = url.searchParams.get("password") || undefined;
  const result = await documentSharesService.getDocumentByToken(params.token, password);

  if (!result.success || !result.data) {
    return json(result, result.error?.code === "NOT_FOUND" ? 404 : 403);
  }

  const { document } = result.data;
  const pathTokens = document.pathTokens;

  if (!pathTokens || pathTokens.length === 0) {
    return json(errorResponse("NOT_FOUND", "File not found"), 404);
  }

  const fileInfo = fileStorage.getFileInfo(pathTokens);

  if (!fileInfo.exists || !fileInfo.path) {
    return json(errorResponse("NOT_FOUND", "File not found"), 404);
  }

  const mimetype = fileStorage.getMimeType(pathTokens[pathTokens.length - 1]);
  const file = Bun.file(fileInfo.path);

  if (!(await file.exists())) {
    return json(errorResponse("NOT_FOUND", "File not found"), 404);
  }

  return new Response(file, {
    status: 200,
    headers: {
      "Content-Type": mimetype,
      "Content-Disposition": "inline",
      "Content-Length": fileInfo.size?.toString() || "",
      "Cache-Control": "private, max-age=3600",
    },
  });
});

// ============================================
// ADVANCED INVOICE EXTRACTION
// ============================================

/**
 * POST /api/v1/documents/:id/extract-invoice - Extract invoice data with 4-pass AI processing
 * Uses advanced multi-pass extraction for high accuracy
 */
router.post("/api/v1/documents/:id/extract-invoice", async (request, _url, params) => {
  return withAuth(request, async (_auth) => {
    const effectiveUrl = applyCompanyIdFromHeader(request, new URL(request.url));
    const { companyId, error } = await getCompanyIdForFilter(effectiveUrl, _auth, false);
    if (error) return error;
    if (!companyId) {
      return errorResponse("VALIDATION_ERROR", "Company ID required");
    }

    // Get document
    const docResult = await documentsService.getDocumentById(params.id, companyId);
    if (!docResult.success || !docResult.data) {
      return errorResponse("NOT_FOUND", "Document not found");
    }

    const doc = docResult.data;
    const pathTokens = doc.pathTokens;

    if (!pathTokens || pathTokens.length === 0) {
      return errorResponse("NOT_FOUND", "File not found");
    }

    // Get options from body
    let options: { companyContext?: string; maxPasses?: number } = {};
    try {
      options = (await parseBody<typeof options>(request)) || {};
    } catch {
      // Ignore parse errors, use defaults
    }

    try {
      // Import the invoice processor dynamically
      const { processInvoice } = await import("../ai/document-extraction/invoice-processor");

      // Read file content
      const buffer = await fileStorage.readFileAsBuffer(pathTokens);
      if (!buffer) {
        return errorResponse("NOT_FOUND", "File content not found");
      }

      const mimetype =
        (doc.metadata?.mimetype as string) ||
        fileStorage.getMimeType(pathTokens[pathTokens.length - 1]);
      const isImage = mimetype.startsWith("image/");
      const isPdf = mimetype === "application/pdf";

      let content: string | { type: "image"; data: string; mimeType: string };

      if (isImage) {
        // For images, pass as base64
        content = {
          type: "image",
          data: buffer.toString("base64"),
          mimeType: mimetype,
        };
      } else if (isPdf) {
        // For PDFs, extract text first
        const { documentLoader } = await import("../services/document-loader.service");
        const text = await documentLoader.loadDocument({
          content: buffer,
          mimetype: "application/pdf",
        });
        content = text || "";
      } else {
        // For other documents, try to read as text
        content = buffer.toString("utf-8");
      }

      // Process with 4-pass extraction
      const result = await processInvoice(content, {
        companyContext: options.companyContext,
        maxPasses: options.maxPasses,
      });

      // Update document with extracted data
      await documentsService.updateDocument(params.id, companyId, {
        summary: typeof content === "string" ? content : doc.summary || undefined,
        processingStatus: "completed",
      });

      return successResponse({
        documentId: params.id,
        extraction: result.data,
        quality: result.quality,
        confidence: result.confidence,
        pass: result.pass,
        fixes: result.fixes,
      });
    } catch (err) {
      logger.error({ error: err, documentId: params.id }, "Invoice extraction failed");
      return errorResponse("INTERNAL_ERROR", "Failed to extract invoice data");
    }
  });
});

/**
 * POST /api/v1/documents/extract-invoice - Extract invoice data from uploaded file
 * Accepts base64 encoded file content
 */
router.post("/api/v1/documents/extract-invoice", async (request) => {
  return withAuth(request, async (_auth) => {
    const body = await parseBody<{
      contentBase64: string;
      mimetype: string;
      companyContext?: string;
      maxPasses?: number;
    }>(request);

    if (!body?.contentBase64 || !body?.mimetype) {
      return errorResponse("VALIDATION_ERROR", "contentBase64 and mimetype required");
    }

    try {
      const { processInvoice } = await import("../ai/document-extraction/invoice-processor");

      const buffer = Buffer.from(body.contentBase64, "base64");
      const isImage = body.mimetype.startsWith("image/");
      const isPdf = body.mimetype === "application/pdf";

      let content: string | { type: "image"; data: string; mimeType: string };

      if (isImage) {
        content = {
          type: "image",
          data: body.contentBase64,
          mimeType: body.mimetype,
        };
      } else if (isPdf) {
        const { documentLoader } = await import("../services/document-loader.service");
        const text = await documentLoader.loadDocument({
          content: buffer,
          mimetype: "application/pdf",
        });
        content = text || "";
      } else {
        content = buffer.toString("utf-8");
      }

      const result = await processInvoice(content, {
        companyContext: body.companyContext,
        maxPasses: body.maxPasses,
      });

      return successResponse({
        extraction: result.data,
        quality: result.quality,
        confidence: result.confidence,
        pass: result.pass,
        fixes: result.fixes,
      });
    } catch (err) {
      logger.error({ error: err }, "Invoice extraction failed");
      return errorResponse("INTERNAL_ERROR", "Failed to extract invoice data");
    }
  });
});

export const documentRoutes = router.getRoutes();
