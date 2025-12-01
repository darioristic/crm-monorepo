/**
 * Document Routes - Vault Module
 *
 * API endpoints for document management
 */

import { errorResponse } from "@crm/utils";
import {
	documentsService,
	documentTagsService,
	documentTagAssignmentsService,
} from "../services/documents.service";
import { RouteBuilder, withAuth, parseBody, json } from "./helpers";
import * as fileStorage from "../services/file-storage.service";
import { createReadStream } from "node:fs";

const router = new RouteBuilder();

// ============================================
// DOCUMENTS
// ============================================

/**
 * GET /api/v1/documents - List documents with pagination and filters
 */
router.get("/api/v1/documents", async (request, url) => {
	return withAuth(request, async (auth) => {
		const companyId = auth.companyId;
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
	});
});

/**
 * GET /api/v1/documents/recent - Get recent documents
 */
router.get("/api/v1/documents/recent", async (request, url) => {
	return withAuth(request, async (auth) => {
		const companyId = auth.companyId;
		if (!companyId) {
			return errorResponse("VALIDATION_ERROR", "Company ID required");
		}

		const limit = url.searchParams.get("limit")
			? parseInt(url.searchParams.get("limit")!, 10)
			: 5;

		return documentsService.getRecentDocuments(companyId, limit);
	});
});

/**
 * GET /api/v1/documents/count - Get document count
 */
router.get("/api/v1/documents/count", async (request) => {
	return withAuth(request, async (auth) => {
		const companyId = auth.companyId;
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
		const companyId = auth.companyId;
		if (!companyId) {
			return errorResponse("VALIDATION_ERROR", "Company ID required");
		}

		return documentsService.getDocumentById(params.id, companyId);
	});
});

/**
 * GET /api/v1/documents/:id/related - Get related documents
 */
router.get("/api/v1/documents/:id/related", async (request, url, params) => {
	return withAuth(request, async (auth) => {
		const companyId = auth.companyId;
		if (!companyId) {
			return errorResponse("VALIDATION_ERROR", "Company ID required");
		}

		const threshold = url.searchParams.get("threshold")
			? parseFloat(url.searchParams.get("threshold")!)
			: 0.3;
		const limit = url.searchParams.get("limit")
			? parseInt(url.searchParams.get("limit")!, 10)
			: 5;

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
			const companyId = auth.companyId;
			if (!companyId) {
				return errorResponse("VALIDATION_ERROR", "Company ID required");
			}

			try {
				const formData = await request.formData();
				const files: Array<{
					file: File | Blob;
					originalName: string;
					mimetype: string;
				}> = [];

				// Process uploaded files
				for (const [key, value] of formData.entries()) {
					if (value instanceof File) {
						files.push({
							file: value,
							originalName: value.name,
							mimetype: value.type || "application/octet-stream",
						});
					}
				}

				if (files.length === 0) {
					return errorResponse("VALIDATION_ERROR", "No files provided");
				}

				return documentsService.uploadFiles(companyId, auth.userId, files);
			} catch (error) {
				console.error("Upload error:", error);
				return errorResponse("INTERNAL_ERROR", "Failed to process upload");
			}
		},
		201,
	);
});

/**
 * POST /api/v1/documents/process - Process uploaded documents
 */
router.post("/api/v1/documents/process", async (request) => {
	return withAuth(request, async (auth) => {
		const companyId = auth.companyId;
		if (!companyId) {
			return errorResponse("VALIDATION_ERROR", "Company ID required");
		}

		const body =
			await parseBody<
				Array<{ filePath: string[]; mimetype: string; size: number }>
			>(request);
		if (!body || !Array.isArray(body)) {
			return errorResponse("VALIDATION_ERROR", "Invalid request body");
		}

		return documentsService.processDocuments(companyId, body);
	});
});

/**
 * PATCH /api/v1/documents/:id - Update document
 */
router.patch("/api/v1/documents/:id", async (request, _url, params) => {
	return withAuth(request, async (auth) => {
		const companyId = auth.companyId;
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
		const companyId = auth.companyId;
		if (!companyId) {
			return errorResponse("VALIDATION_ERROR", "Company ID required");
		}

		return documentsService.deleteDocument(params.id, companyId);
	});
});

/**
 * GET /api/v1/documents/download/* - Download file (wildcard path)
 * This handles paths like /api/v1/documents/download/companyId/filename.pdf
 */
router.get(
	"/api/v1/documents/download/:companyId/:filename",
	async (request, _url, params) => {
		return withAuth(request, async (auth) => {
			const companyId = auth.companyId;
			if (!companyId) {
				return json(
					errorResponse("VALIDATION_ERROR", "Company ID required"),
					400,
				);
			}

			// Ensure user can only download from their company
			if (params.companyId !== companyId) {
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

			return new Response(webStream, {
				status: 200,
				headers: {
					"Content-Type": mimetype,
					"Content-Disposition": `attachment; filename="${params.filename}"`,
					"Content-Length": fileInfo.size?.toString() || "",
				},
			});
		});
	},
);

/**
 * POST /api/v1/documents/signed-url - Get signed URL for a file
 */
router.post("/api/v1/documents/signed-url", async (request) => {
	return withAuth(request, async (auth) => {
		const companyId = auth.companyId;
		if (!companyId) {
			return errorResponse("VALIDATION_ERROR", "Company ID required");
		}

		const body = await parseBody<{ filePath: string; expireIn?: number }>(
			request,
		);
		if (!body?.filePath) {
			return errorResponse("VALIDATION_ERROR", "File path required");
		}

		return documentsService.getSignedUrl(body.filePath, body.expireIn || 3600);
	});
});

// ============================================
// DOCUMENT TAGS
// ============================================

/**
 * GET /api/v1/document-tags - List all tags
 */
router.get("/api/v1/document-tags", async (request) => {
	return withAuth(request, async (auth) => {
		const companyId = auth.companyId;
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
			const companyId = auth.companyId;
			if (!companyId) {
				return errorResponse("VALIDATION_ERROR", "Company ID required");
			}

			const body = await parseBody<{ name: string }>(request);
			if (!body?.name) {
				return errorResponse("VALIDATION_ERROR", "Tag name required");
			}

			return documentTagsService.createTag(companyId, body);
		},
		201,
	);
});

/**
 * DELETE /api/v1/document-tags/:id - Delete a tag
 */
router.delete("/api/v1/document-tags/:id", async (request, _url, params) => {
	return withAuth(request, async (auth) => {
		const companyId = auth.companyId;
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
			const companyId = auth.companyId;
			if (!companyId) {
				return errorResponse("VALIDATION_ERROR", "Company ID required");
			}

			const body = await parseBody<{ documentId: string; tagId: string }>(
				request,
			);
			if (!body?.documentId || !body?.tagId) {
				return errorResponse(
					"VALIDATION_ERROR",
					"Document ID and Tag ID required",
				);
			}

			return documentTagAssignmentsService.assignTag(companyId, body);
		},
		201,
	);
});

/**
 * DELETE /api/v1/document-tag-assignments - Remove tag from document
 */
router.delete("/api/v1/document-tag-assignments", async (request) => {
	return withAuth(request, async (auth) => {
		const companyId = auth.companyId;
		if (!companyId) {
			return errorResponse("VALIDATION_ERROR", "Company ID required");
		}

		const body = await parseBody<{ documentId: string; tagId: string }>(
			request,
		);
		if (!body?.documentId || !body?.tagId) {
			return errorResponse(
				"VALIDATION_ERROR",
				"Document ID and Tag ID required",
			);
		}

		return documentTagAssignmentsService.removeTag(companyId, body);
	});
});

export const documentRoutes = router.getRoutes();
