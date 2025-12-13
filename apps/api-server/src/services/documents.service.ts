/**
 * Documents Service for Vault Module
 *
 * Business logic for document management
 */

import type { ApiResponse } from "@crm/types";
import { errorResponse, successResponse } from "@crm/utils";
import { sql as db } from "../db/client";
import {
  type Document,
  type DocumentProcessingStatus,
  type DocumentsFilterParams,
  type DocumentsListResult,
  type DocumentsPaginationParams,
  type DocumentTag,
  type DocumentTagAssignment,
  type DocumentWithTags,
  documentQueries,
  documentTagAssignmentQueries,
  documentTagQueries,
} from "../db/queries/documents";
import { addDocumentProcessingJob } from "../jobs/queue";
import { serviceLogger } from "../lib/logger";
import { aiService } from "./ai.service";
import { auditService } from "./audit.service";
import * as fileStorage from "./file-storage.service";

// ============================================
// Document Service
// ============================================

export const documentsService = {
  /**
   * Get documents list with pagination and filters
   */
  async getDocuments(
    companyId: string,
    pagination: DocumentsPaginationParams,
    filters: DocumentsFilterParams
  ): Promise<ApiResponse<DocumentsListResult>> {
    try {
      const result = await documentQueries.findAll(companyId, pagination, filters);
      return successResponse(result);
    } catch (error) {
      serviceLogger.error(error, "Error fetching documents");
      return errorResponse("INTERNAL_ERROR", "Failed to fetch documents");
    }
  },

  /**
   * Get a single document by ID
   */
  async getDocumentById(
    id: string,
    companyId: string
  ): Promise<ApiResponse<DocumentWithTags | null>> {
    try {
      const document = await documentQueries.findById(id, companyId);
      if (!document) {
        return errorResponse("NOT_FOUND", "Document not found");
      }
      return successResponse(document);
    } catch (error) {
      serviceLogger.error(error, "Error fetching document");
      return errorResponse("INTERNAL_ERROR", "Failed to fetch document");
    }
  },

  /**
   * Upload files to vault
   */
  async uploadFiles(
    companyId: string,
    ownerId: string,
    files: Array<{ file: File | Blob; originalName: string; mimetype: string }>
  ): Promise<
    ApiResponse<{
      documents: Document[];
      report: {
        createdCount: number;
        failedCount: number;
        failures: Array<{ name: string; reason: string }>;
      };
    }>
  > {
    try {
      const uploadedDocuments: Document[] = [];
      const failures: Array<{ name: string; reason: string }> = [];

      for (const { file, originalName, mimetype } of files) {
        const size = file.size;
        if (!fileStorage.isValidFileSize(size)) {
          failures.push({ name: originalName, reason: "INVALID_SIZE" });
          continue;
        }
        if (!fileStorage.isSupportedMimeType(mimetype)) {
          failures.push({ name: originalName, reason: "UNSUPPORTED_TYPE" });
          continue;
        }

        try {
          const uploadResult = await fileStorage.uploadFile(companyId, file, originalName);
          const document = await documentQueries.create({
            name: uploadResult.path.join("/"),
            pathTokens: uploadResult.path,
            metadata: {
              size: uploadResult.size,
              mimetype: uploadResult.mimetype,
              originalName: uploadResult.originalName,
            },
            companyId,
            ownerId,
          });
          auditService.logAction({
            userId: ownerId,
            action: "CREATE_DOCUMENT",
            entityType: "document",
            entityId: document.id,
            metadata: { name: originalName },
          });

          // Trigger AI processing in background
          try {
            await addDocumentProcessingJob({
              documentId: document.id,
              companyId,
              filePath: uploadResult.path,
              mimetype: uploadResult.mimetype,
              processingType: "full",
            });
            serviceLogger.info({ documentId: document.id }, "Document processing job queued");
          } catch (jobErr) {
            serviceLogger.warn(
              { error: jobErr, documentId: document.id },
              "Failed to queue document processing job"
            );
          }

          uploadedDocuments.push(document);
        } catch (err: unknown) {
          serviceLogger.error({ error: err, originalName }, "Error uploading document");
          failures.push({ name: originalName, reason: "UPLOAD_FAILED" });
          auditService.logAction({
            userId: ownerId,
            action: "DOCUMENT_FAILED",
            entityType: "document",
            metadata: {
              name: originalName,
              reason: err instanceof Error ? err.message : String(err),
            },
          });
        }
      }

      return successResponse({
        documents: uploadedDocuments,
        report: {
          createdCount: uploadedDocuments.length,
          failedCount: failures.length,
          failures,
        },
      });
    } catch (error) {
      serviceLogger.error(error, "Error uploading files");
      return errorResponse("INTERNAL_ERROR", "Failed to upload files");
    }
  },

  async uploadFilesFromBase64(
    companyId: string,
    ownerId: string,
    files: Array<{
      contentBase64: string;
      originalName: string;
      mimetype: string;
    }>
  ): Promise<
    ApiResponse<{
      documents: Document[];
      report: {
        createdCount: number;
        failedCount: number;
        failures: Array<{ name: string; reason: string }>;
      };
    }>
  > {
    try {
      const uploadedDocuments: Document[] = [];
      const failures: Array<{ name: string; reason: string }> = [];

      for (const { contentBase64, originalName, mimetype } of files) {
        const buffer = Buffer.from(contentBase64, "base64");
        if (!fileStorage.isValidFileSize(buffer.length)) {
          failures.push({ name: originalName, reason: "INVALID_SIZE" });
          continue;
        }
        if (!fileStorage.isSupportedMimeType(mimetype)) {
          failures.push({ name: originalName, reason: "UNSUPPORTED_TYPE" });
          continue;
        }

        try {
          const uploadResult = await fileStorage.uploadFileFromBuffer(
            companyId,
            buffer,
            originalName,
            mimetype
          );
          const document = await documentQueries.create({
            name: uploadResult.path.join("/"),
            pathTokens: uploadResult.path,
            metadata: {
              size: uploadResult.size,
              mimetype: uploadResult.mimetype,
              originalName: uploadResult.originalName,
            },
            companyId,
            ownerId,
          });
          auditService.logAction({
            userId: ownerId,
            action: "CREATE_DOCUMENT",
            entityType: "document",
            entityId: document.id,
            metadata: { name: originalName },
          });

          // Trigger AI processing in background
          try {
            await addDocumentProcessingJob({
              documentId: document.id,
              companyId,
              filePath: uploadResult.path,
              mimetype: uploadResult.mimetype,
              processingType: "full",
            });
            serviceLogger.info({ documentId: document.id }, "Document processing job queued");
          } catch (jobErr) {
            serviceLogger.warn(
              { error: jobErr, documentId: document.id },
              "Failed to queue document processing job"
            );
          }

          uploadedDocuments.push(document);
        } catch (err: unknown) {
          failures.push({ name: originalName, reason: "UPLOAD_FAILED" });
          auditService.logAction({
            userId: ownerId,
            action: "DOCUMENT_FAILED",
            entityType: "document",
            metadata: {
              name: originalName,
              reason: err instanceof Error ? err.message : String(err),
            },
          });
        }
      }

      return successResponse({
        documents: uploadedDocuments,
        report: {
          createdCount: uploadedDocuments.length,
          failedCount: failures.length,
          failures,
        },
      });
    } catch (error) {
      serviceLogger.error(error, "Error uploading files from base64");
      return errorResponse("INTERNAL_ERROR", "Failed to upload files");
    }
  },

  /**
   * Process documents (update metadata after upload using AI classification)
   */
  async processDocuments(
    companyId: string,
    documents: Array<{ filePath: string[]; mimetype: string; size: number }>
  ): Promise<ApiResponse<void>> {
    try {
      const names = documents.map((doc) => doc.filePath.join("/"));
      await documentQueries.updateProcessingStatus(names, companyId, "processing");

      // Process each document with AI classification
      for (const doc of documents) {
        const name = doc.filePath.join("/");
        try {
          // Get the document from DB to get its ID
          const existingDoc = await documentQueries.findByPath(doc.filePath, companyId);
          if (!existingDoc) {
            serviceLogger.warn({ name, companyId }, "Document not found for AI processing");
            continue;
          }

          // Check if AI is configured
          if (aiService.isConfigured()) {
            // Classify document using AI
            const classification = await aiService.classifyDocument({
              documentId: existingDoc.id,
              companyId,
              filePath: doc.filePath,
              mimetype: doc.mimetype,
            });

            // Update document with AI-extracted metadata
            await documentQueries.update(existingDoc.id, companyId, {
              title: classification.title || existingDoc.title || undefined,
              summary: classification.summary || existingDoc.summary || undefined,
              language: classification.language || undefined,
              date: classification.date || undefined,
            });

            // Create tags if any were suggested
            if (classification.tags && classification.tags.length > 0) {
              for (const tagName of classification.tags) {
                try {
                  const tagSlug = tagName.toLowerCase().replace(/\s+/g, "-");
                  // Find or create the tag
                  let tag = await documentTagQueries.findBySlug(tagSlug, companyId);
                  if (!tag) {
                    tag = await documentTagQueries.create({
                      name: tagName,
                      slug: tagSlug,
                      companyId,
                    });
                  }
                  // Assign tag to document
                  await documentTagAssignmentQueries.create({
                    documentId: existingDoc.id,
                    tagId: tag.id,
                    companyId,
                  });
                } catch (tagError) {
                  serviceLogger.warn({ tagError, tagName }, "Failed to create/assign tag");
                }
              }
            }

            serviceLogger.info(
              { documentId: existingDoc.id, classification },
              "Document classified with AI"
            );
          } else {
            // AI not configured - use basic filename-based title
            const filename = doc.filePath[doc.filePath.length - 1] || "document";
            const basicTitle = filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
            await documentQueries.update(existingDoc.id, companyId, {
              title: basicTitle,
            });
          }

          auditService.logAction({
            action: "PROCESS_DOCUMENT",
            entityType: "document",
            entityId: existingDoc.id,
            metadata: { name },
          });
        } catch (docError) {
          serviceLogger.error({ docError, name }, "Error processing individual document");
        }
      }

      // Mark all as completed
      await documentQueries.updateProcessingStatus(names, companyId, "completed");

      return successResponse(undefined);
    } catch (error: unknown) {
      try {
        const names = documents.map((doc) => doc.filePath.join("/"));
        await documentQueries.updateProcessingStatus(names, companyId, "failed");
        for (const n of names) {
          auditService.logAction({
            action: "DOCUMENT_FAILED",
            entityType: "document",
            metadata: { name: n, reason: error instanceof Error ? error.message : String(error) },
          });
        }
      } catch {}
      serviceLogger.error(error, "Error processing documents");
      return errorResponse("INTERNAL_ERROR", "Failed to process documents");
    }
  },

  async getCreationReport(
    companyId: string,
    options: { fromDate?: string; toDate?: string } = {}
  ): Promise<
    ApiResponse<{
      totalCreated: number;
      totalCompleted: number;
      totalFailed: number;
      recentFailures: Array<{ name: string; reason?: string; at: string }>;
    }>
  > {
    try {
      const whereParts: string[] = ["company_id = $1"];
      const params: unknown[] = [companyId];
      let p = 2;
      if (options.fromDate) {
        whereParts.push(`created_at >= $${p}`);
        params.push(options.fromDate);
        p++;
      }
      if (options.toDate) {
        whereParts.push(`created_at <= $${p}`);
        params.push(options.toDate);
        p++;
      }
      const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
      const pgParams = params as Array<string | number | boolean | null | Date>;
      const counts = await db.unsafe(
        `SELECT
				  COUNT(*)::int AS total_created,
				  SUM(CASE WHEN processing_status = 'completed' THEN 1 ELSE 0 END)::int AS total_completed,
				  SUM(CASE WHEN processing_status = 'failed' THEN 1 ELSE 0 END)::int AS total_failed
				 FROM documents ${whereClause}`,
        pgParams
      );
      const audit = await auditService.getLogs({
        entityType: "document",
        action: "DOCUMENT_FAILED",
        fromDate: options.fromDate,
        toDate: options.toDate,
        page: 1,
        pageSize: 50,
      });
      const recentFailures = audit.data.map((a) => ({
        name: (a.metadata?.name as string) || "",
        reason: (a.metadata?.reason as string) || undefined,
        at: a.createdAt,
      }));
      return successResponse({
        totalCreated: counts[0].total_created as number,
        totalCompleted: counts[0].total_completed as number,
        totalFailed: counts[0].total_failed as number,
        recentFailures,
      });
    } catch (error) {
      serviceLogger.error(error, "Error generating creation report");
      return errorResponse("INTERNAL_ERROR", "Failed to generate report");
    }
  },

  /**
   * Update a document
   */
  async updateDocument(
    id: string,
    companyId: string,
    data: Partial<{
      title: string;
      summary: string;
      processingStatus: DocumentProcessingStatus;
    }>
  ): Promise<ApiResponse<Document | null>> {
    try {
      const document = await documentQueries.update(id, companyId, data);
      if (!document) {
        return errorResponse("NOT_FOUND", "Document not found");
      }
      return successResponse(document);
    } catch (error) {
      serviceLogger.error(error, "Error updating document");
      return errorResponse("INTERNAL_ERROR", "Failed to update document");
    }
  },

  /**
   * Delete a document
   */
  async deleteDocument(id: string, companyId: string): Promise<ApiResponse<{ id: string }>> {
    try {
      const result = await documentQueries.delete(id, companyId);
      if (!result) {
        return errorResponse("NOT_FOUND", "Document not found");
      }

      // Delete file from storage
      if (result.pathTokens && result.pathTokens.length > 0) {
        await fileStorage.deleteFile(result.pathTokens);
      }

      return successResponse({ id: result.id });
    } catch (error) {
      serviceLogger.error(error, "Error deleting document");
      return errorResponse("INTERNAL_ERROR", "Failed to delete document");
    }
  },

  /**
   * Get download info for a document
   */
  async getDownloadInfo(
    pathTokens: string[],
    _companyId: string
  ): Promise<ApiResponse<{ filePath: string; exists: boolean; mimetype: string }>> {
    try {
      const fileInfo = fileStorage.getFileInfo(pathTokens);

      if (!fileInfo.exists || !fileInfo.path) {
        return errorResponse("NOT_FOUND", "File not found");
      }

      const filename = pathTokens[pathTokens.length - 1];
      const mimetype = fileStorage.getMimeType(filename);

      return successResponse({
        filePath: fileInfo.path,
        exists: true,
        mimetype,
      });
    } catch (error) {
      serviceLogger.error(error, "Error getting download info");
      return errorResponse("INTERNAL_ERROR", "Failed to get file info");
    }
  },

  /**
   * Get signed URL for a document
   */
  async getSignedUrl(
    filePath: string,
    expireIn: number = 3600
  ): Promise<ApiResponse<{ signedUrl: string }>> {
    try {
      const pathTokens = filePath.split("/");
      const signedUrl = fileStorage.getSignedUrl(pathTokens, expireIn);
      return successResponse({ signedUrl });
    } catch (error) {
      serviceLogger.error(error, "Error getting signed URL");
      return errorResponse("INTERNAL_ERROR", "Failed to get signed URL");
    }
  },

  /**
   * Get document count for a company
   */
  async getDocumentCount(companyId: string): Promise<ApiResponse<{ count: number }>> {
    try {
      const count = await documentQueries.count(companyId);
      return successResponse({ count });
    } catch (error) {
      serviceLogger.error(error, "Error getting document count");
      return errorResponse("INTERNAL_ERROR", "Failed to get document count");
    }
  },

  /**
   * Get recent documents
   */
  async getRecentDocuments(companyId: string, limit: number = 5): Promise<ApiResponse<Document[]>> {
    try {
      const documents = await documentQueries.findRecent(companyId, limit);
      return successResponse(documents);
    } catch (error) {
      serviceLogger.error(error, "Error fetching recent documents");
      return errorResponse("INTERNAL_ERROR", "Failed to fetch recent documents");
    }
  },

  /**
   * Get related/similar documents
   */
  async getRelatedDocuments(
    documentId: string,
    companyId: string,
    options: { threshold?: number; limit?: number } = {}
  ): Promise<ApiResponse<Array<Document & { similarityScore: number }>>> {
    try {
      const documents = await documentQueries.findRelated(documentId, companyId, options);
      return successResponse(documents);
    } catch (error) {
      serviceLogger.error(error, "Error fetching related documents");
      return errorResponse("INTERNAL_ERROR", "Failed to fetch related documents");
    }
  },

  /**
   * Store a generated document (invoice, quote, etc.) in the vault
   * This is used to automatically add system-generated PDFs to the vault
   */
  async storeGeneratedDocument(
    companyId: string,
    ownerId: string,
    params: {
      pdfBuffer: Buffer;
      documentType: "invoice" | "quote" | "delivery-note" | "order";
      entityId: string;
      title: string;
      documentNumber?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<ApiResponse<Document>> {
    try {
      const { pdfBuffer, documentType, entityId, title, documentNumber, metadata } = params;

      // Generate filename based on document type and number
      const filename = documentNumber
        ? `${documentType}-${documentNumber}.pdf`
        : `${documentType}-${entityId}.pdf`;

      // Store file in vault under a special folder for generated documents
      const uploadResult = await fileStorage.uploadFileFromBuffer(
        companyId,
        pdfBuffer,
        filename,
        "application/pdf"
      );

      // Generate a descriptive summary
      const docTypeName =
        documentType.charAt(0).toUpperCase() + documentType.slice(1).replace("-", " ");
      const customerName = metadata?.customerName || metadata?.companyName;
      const total = metadata?.total;
      const currency = metadata?.currency;

      let summary = `${docTypeName} ${documentNumber || entityId}`;
      if (customerName) {
        summary += ` for ${customerName}`;
      }
      if (total && currency) {
        summary += ` - ${currency} ${Number(total).toLocaleString()}`;
      }

      // Create document record with pre-filled metadata
      const document = await documentQueries.create({
        name: uploadResult.path.join("/"),
        pathTokens: uploadResult.path,
        title,
        summary,
        metadata: {
          size: uploadResult.size,
          mimetype: "application/pdf",
          originalName: filename,
          documentType,
          entityId,
          ...metadata,
        },
        companyId,
        ownerId,
        processingStatus: "completed" as DocumentProcessingStatus,
      });

      // Assign appropriate tag based on document type
      const tagName =
        documentType === "invoice"
          ? "Invoice"
          : documentType === "quote"
            ? "Quote"
            : documentType === "delivery-note"
              ? "Delivery Note"
              : "Order";

      try {
        const tagSlug = tagName.toLowerCase().replace(/\s+/g, "-");
        let tag = await documentTagQueries.findBySlug(tagSlug, companyId);
        if (!tag) {
          tag = await documentTagQueries.create({
            name: tagName,
            slug: tagSlug,
            companyId,
          });
        }
        await documentTagAssignmentQueries.create({
          documentId: document.id,
          tagId: tag.id,
          companyId,
        });
      } catch (tagError) {
        serviceLogger.warn({ tagError, tagName }, "Failed to assign tag to generated document");
      }

      auditService.logAction({
        userId: ownerId,
        action: "CREATE_DOCUMENT",
        entityType: "document",
        entityId: document.id,
        metadata: { name: filename, documentType, entityId },
      });

      serviceLogger.info(
        { documentId: document.id, documentType, entityId },
        "Generated document stored in vault"
      );

      return successResponse(document);
    } catch (error) {
      serviceLogger.error(error, "Error storing generated document");
      return errorResponse("INTERNAL_ERROR", "Failed to store generated document");
    }
  },

  /**
   * Find document by entity reference (e.g., invoice ID)
   */
  async findByEntityId(
    companyId: string,
    documentType: string,
    entityId: string
  ): Promise<ApiResponse<Document | null>> {
    try {
      // Search in metadata for matching entity
      const result = await db`
        SELECT * FROM documents
        WHERE company_id = ${companyId}
        AND metadata->>'documentType' = ${documentType}
        AND metadata->>'entityId' = ${entityId}
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (result.length === 0) {
        return successResponse(null);
      }

      return successResponse(result[0] as unknown as Document);
    } catch (error) {
      serviceLogger.error(error, "Error finding document by entity ID");
      return errorResponse("INTERNAL_ERROR", "Failed to find document");
    }
  },

  /**
   * Semantic search within document content
   * Uses vector embeddings to find documents matching natural language queries
   */
  async semanticSearch(
    companyId: string,
    query: string,
    options: { limit?: number; threshold?: number } = {}
  ): Promise<ApiResponse<Array<DocumentWithTags & { similarity: number }>>> {
    const { limit = 10, threshold = 0.3 } = options;

    try {
      // First, resolve tenant_id from company
      const tenantRow = await db`
        SELECT tenant_id FROM companies WHERE id = ${companyId} LIMIT 1
      `;
      const tenantId = tenantRow.length > 0 ? (tenantRow[0].tenant_id as string) : null;

      if (!tenantId) {
        return errorResponse("NOT_FOUND", "Company not found");
      }

      // Generate embedding for the search query
      const { generateEmbedding } = await import("./embeddings");
      const { embedding } = await generateEmbedding(query);

      // Use pgvector to find similar documents
      const vectorString = `[${embedding.join(",")}]`;
      const results = await db`
        SELECT
          d.*,
          1 - (de.embedding <=> ${vectorString}::vector) as similarity,
          de.source_text
        FROM documents d
        JOIN document_embeddings de ON d.id = de.document_id
        WHERE de.tenant_id = ${tenantId}
          AND 1 - (de.embedding <=> ${vectorString}::vector) >= ${threshold}
        ORDER BY de.embedding <=> ${vectorString}::vector
        LIMIT ${limit}
      `;

      // Map results and fetch tags
      const documentsWithTags: Array<DocumentWithTags & { similarity: number }> = await Promise.all(
        results.map(async (row) => {
          const tagAssignments = await db`
            SELECT dta.document_id, dt.id as tag_id, dt.name as tag_name, dt.slug as tag_slug, dt.company_id as tag_company_id, dt.created_at as tag_created_at
            FROM document_tag_assignments dta
            JOIN document_tags dt ON dta.tag_id = dt.id
            WHERE dta.document_id = ${row.id as string}
          `;

          return {
            id: row.id as string,
            name: row.name as string | null,
            title: row.title as string | null,
            summary: row.summary as string | null,
            content: row.content as string | null,
            body: row.body as string | null,
            tag: row.tag as string | null,
            date: row.date ? (row.date as Date).toISOString() : null,
            language: row.language as string | null,
            pathTokens: (row.path_tokens as string[]) || [],
            metadata: (row.metadata as Record<string, unknown>) || {},
            processingStatus: row.processing_status as
              | "pending"
              | "processing"
              | "completed"
              | "failed",
            companyId: row.company_id as string,
            ownerId: row.owner_id as string | null,
            createdAt: (row.created_at as Date).toISOString(),
            updatedAt: (row.updated_at as Date).toISOString(),
            similarity: Number(row.similarity),
            documentTagAssignments: tagAssignments.map((ta) => ({
              documentTag: {
                id: ta.tag_id as string,
                name: ta.tag_name as string,
                slug: ta.tag_slug as string,
                companyId: ta.tag_company_id as string,
                createdAt: (ta.tag_created_at as Date).toISOString(),
              },
            })),
          };
        })
      );

      serviceLogger.info(
        { query, resultsCount: documentsWithTags.length, threshold },
        "Semantic search completed"
      );

      return successResponse(documentsWithTags);
    } catch (error) {
      serviceLogger.error({ error, query }, "Error in semantic search");
      return errorResponse("INTERNAL_ERROR", "Failed to perform semantic search");
    }
  },

  /**
   * Batch rename documents
   */
  async batchRename(
    companyId: string,
    data: {
      documentIds: string[];
      pattern: string;
      options?: {
        prefix?: string;
        suffix?: string;
        startNumber?: number;
        preserveExtension?: boolean;
      };
    }
  ): Promise<
    ApiResponse<{
      renamed: Array<{ id: string; oldTitle: string; newTitle: string }>;
      failed: Array<{ id: string; reason: string }>;
    }>
  > {
    try {
      const { documentIds, pattern, options = {} } = data;
      const { prefix = "", suffix = "", startNumber = 1, preserveExtension = true } = options;

      const renamed: Array<{ id: string; oldTitle: string; newTitle: string }> = [];
      const failed: Array<{ id: string; reason: string }> = [];

      for (let i = 0; i < documentIds.length; i++) {
        const docId = documentIds[i];

        try {
          const doc = await documentQueries.findById(docId, companyId);
          if (!doc) {
            failed.push({ id: docId, reason: "Document not found" });
            continue;
          }

          const oldTitle =
            doc.title ||
            (doc.metadata?.originalName as string) ||
            doc.pathTokens?.at(-1) ||
            "Untitled";
          const extension = preserveExtension ? oldTitle.match(/\.[^.]+$/)?.[0] || "" : "";
          const nameWithoutExt = oldTitle.replace(/\.[^.]+$/, "");

          // Build new title based on pattern
          let newTitle = pattern
            .replace("{name}", nameWithoutExt)
            .replace("{n}", String(startNumber + i))
            .replace("{N}", String(startNumber + i).padStart(3, "0"))
            .replace("{date}", new Date().toISOString().split("T")[0]);

          newTitle = `${prefix}${newTitle}${suffix}${extension}`;

          await documentQueries.update(docId, companyId, { title: newTitle });
          renamed.push({ id: docId, oldTitle, newTitle });
        } catch (error) {
          serviceLogger.error({ error, docId }, "Failed to rename document");
          failed.push({ id: docId, reason: "Update failed" });
        }
      }

      return successResponse({ renamed, failed });
    } catch (error) {
      serviceLogger.error(error, "Error in batch rename");
      return errorResponse("INTERNAL_ERROR", "Failed to batch rename documents");
    }
  },

  /**
   * Track document view
   */
  async trackDocumentView(
    documentId: string,
    companyId: string,
    userId?: string
  ): Promise<ApiResponse<void>> {
    try {
      auditService.logAction({
        userId,
        action: "VIEW_DOCUMENT",
        entityType: "document",
        entityId: documentId,
        metadata: { companyId },
      });
      return successResponse(undefined);
    } catch (error) {
      serviceLogger.error(error, "Error tracking document view");
      return errorResponse("INTERNAL_ERROR", "Failed to track view");
    }
  },

  /**
   * Track document download
   */
  async trackDocumentDownload(
    documentId: string,
    companyId: string,
    userId?: string
  ): Promise<ApiResponse<void>> {
    try {
      auditService.logAction({
        userId,
        action: "DOWNLOAD_DOCUMENT",
        entityType: "document",
        entityId: documentId,
        metadata: { companyId },
      });
      return successResponse(undefined);
    } catch (error) {
      serviceLogger.error(error, "Error tracking document download");
      return errorResponse("INTERNAL_ERROR", "Failed to track download");
    }
  },

  /**
   * Get document activity/audit log
   */
  async getDocumentActivity(
    documentId: string,
    _companyId: string,
    options: { page?: number; pageSize?: number } = {}
  ): Promise<
    ApiResponse<{
      activities: Array<{
        id: string;
        action: string;
        userId: string | null;
        userName?: string;
        createdAt: string;
        metadata: Record<string, unknown> | null;
      }>;
      totalCount: number;
    }>
  > {
    try {
      const { page = 1, pageSize = 20 } = options;

      const result = await auditService.getLogs({
        entityType: "document",
        entityId: documentId,
        page,
        pageSize,
      });

      // Get user names for the activities
      const userIds = [...new Set(result.data.map((a) => a.userId).filter(Boolean))] as string[];

      // biome-ignore lint/suspicious/noExplicitAny: Dynamic SQL query result
      let userMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const users = await db`
          SELECT id, first_name, last_name, email
          FROM users
          WHERE id = ANY(${userIds})
        `;
        userMap = Object.fromEntries(users.map((u) => [u.id, u]));
      }

      const activities = result.data.map((log) => {
        const user = log.userId ? userMap[log.userId] : null;
        return {
          id: log.id,
          action: log.action,
          userId: log.userId,
          userName: user ? `${user.first_name} ${user.last_name}`.trim() || user.email : null,
          createdAt: log.createdAt,
          metadata: log.metadata,
        };
      });

      return successResponse({
        activities,
        totalCount: result.total,
      });
    } catch (error) {
      serviceLogger.error(error, "Error fetching document activity");
      return errorResponse("INTERNAL_ERROR", "Failed to fetch activity");
    }
  },
};

// ============================================
// Document Tags Service
// ============================================

// ============================================
// Document Shares Service
// ============================================

export interface DocumentShare {
  id: string;
  documentId: string;
  companyId: string;
  token: string;
  createdBy: string | null;
  expiresAt: string | null;
  passwordHash: string | null;
  viewCount: number;
  maxViews: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const documentSharesService = {
  /**
   * Generate a unique share token
   */
  generateToken(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `doc_${timestamp}_${randomPart}`;
  },

  /**
   * Create a share link for a document
   */
  async createShare(
    companyId: string,
    data: {
      documentId: string;
      createdBy?: string;
      expiresAt?: Date;
      password?: string;
      maxViews?: number;
    }
  ): Promise<ApiResponse<DocumentShare>> {
    try {
      // Verify document exists and belongs to company
      const document = await documentQueries.findById(data.documentId, companyId);
      if (!document) {
        return errorResponse("NOT_FOUND", "Document not found");
      }

      const token = this.generateToken();
      let passwordHash: string | null = null;

      if (data.password) {
        // Simple hash for password (in production, use bcrypt)
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data.password);
        const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        passwordHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      }

      const result = await db`
        INSERT INTO document_shares (
          document_id, company_id, token, created_by, expires_at, password_hash, max_views
        ) VALUES (
          ${data.documentId}, ${companyId}, ${token}, ${data.createdBy || null},
          ${data.expiresAt || null}, ${passwordHash}, ${data.maxViews || null}
        )
        RETURNING *
      `;

      const share = {
        id: result[0].id as string,
        documentId: result[0].document_id as string,
        companyId: result[0].company_id as string,
        token: result[0].token as string,
        createdBy: result[0].created_by as string | null,
        expiresAt: result[0].expires_at ? (result[0].expires_at as Date).toISOString() : null,
        passwordHash: result[0].password_hash as string | null,
        viewCount: result[0].view_count as number,
        maxViews: result[0].max_views as number | null,
        isActive: result[0].is_active as boolean,
        createdAt: (result[0].created_at as Date).toISOString(),
        updatedAt: (result[0].updated_at as Date).toISOString(),
      };

      auditService.logAction({
        userId: data.createdBy,
        action: "CREATE_DOCUMENT_SHARE",
        entityType: "document_share",
        entityId: share.id,
        metadata: { documentId: data.documentId, token },
      });

      return successResponse(share);
    } catch (error) {
      serviceLogger.error(error, "Error creating document share");
      return errorResponse("INTERNAL_ERROR", "Failed to create share link");
    }
  },

  /**
   * Get shares for a document
   */
  async getSharesForDocument(
    documentId: string,
    companyId: string
  ): Promise<ApiResponse<DocumentShare[]>> {
    try {
      const result = await db`
        SELECT * FROM document_shares
        WHERE document_id = ${documentId}
        AND company_id = ${companyId}
        ORDER BY created_at DESC
      `;

      const shares = result.map((row) => ({
        id: row.id as string,
        documentId: row.document_id as string,
        companyId: row.company_id as string,
        token: row.token as string,
        createdBy: row.created_by as string | null,
        expiresAt: row.expires_at ? (row.expires_at as Date).toISOString() : null,
        passwordHash: row.password_hash as string | null,
        viewCount: row.view_count as number,
        maxViews: row.max_views as number | null,
        isActive: row.is_active as boolean,
        createdAt: (row.created_at as Date).toISOString(),
        updatedAt: (row.updated_at as Date).toISOString(),
      }));

      return successResponse(shares);
    } catch (error) {
      serviceLogger.error(error, "Error fetching document shares");
      return errorResponse("INTERNAL_ERROR", "Failed to fetch shares");
    }
  },

  /**
   * Get document by share token (for public access)
   */
  async getDocumentByToken(
    token: string,
    password?: string
  ): Promise<ApiResponse<{ document: DocumentWithTags; share: DocumentShare }>> {
    try {
      // Find share by token
      const shareResult = await db`
        SELECT * FROM document_shares
        WHERE token = ${token}
        AND is_active = true
      `;

      if (shareResult.length === 0) {
        return errorResponse("NOT_FOUND", "Share link not found or expired");
      }

      const shareRow = shareResult[0];

      // Check if expired
      if (shareRow.expires_at && new Date(shareRow.expires_at as string) < new Date()) {
        return errorResponse("FORBIDDEN", "Share link has expired");
      }

      // Check max views
      if (
        shareRow.max_views !== null &&
        (shareRow.view_count as number) >= (shareRow.max_views as number)
      ) {
        return errorResponse("FORBIDDEN", "Share link has reached maximum views");
      }

      // Check password if required
      if (shareRow.password_hash) {
        if (!password) {
          return errorResponse("UNAUTHORIZED", "Password required");
        }

        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const passwordHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

        if (passwordHash !== shareRow.password_hash) {
          return errorResponse("UNAUTHORIZED", "Invalid password");
        }
      }

      // Increment view count
      await db`
        UPDATE document_shares
        SET view_count = view_count + 1, updated_at = NOW()
        WHERE id = ${shareRow.id as string}
      `;

      // Get document
      const document = await documentQueries.findById(
        shareRow.document_id as string,
        shareRow.company_id as string
      );

      if (!document) {
        return errorResponse("NOT_FOUND", "Document not found");
      }

      const share: DocumentShare = {
        id: shareRow.id as string,
        documentId: shareRow.document_id as string,
        companyId: shareRow.company_id as string,
        token: shareRow.token as string,
        createdBy: shareRow.created_by as string | null,
        expiresAt: shareRow.expires_at ? (shareRow.expires_at as Date).toISOString() : null,
        passwordHash: null, // Don't expose hash
        viewCount: (shareRow.view_count as number) + 1,
        maxViews: shareRow.max_views as number | null,
        isActive: shareRow.is_active as boolean,
        createdAt: (shareRow.created_at as Date).toISOString(),
        updatedAt: (shareRow.updated_at as Date).toISOString(),
      };

      return successResponse({ document, share });
    } catch (error) {
      serviceLogger.error(error, "Error getting document by share token");
      return errorResponse("INTERNAL_ERROR", "Failed to access shared document");
    }
  },

  /**
   * Delete/revoke a share link
   */
  async deleteShare(
    shareId: string,
    companyId: string,
    userId?: string
  ): Promise<ApiResponse<{ id: string }>> {
    try {
      const result = await db`
        DELETE FROM document_shares
        WHERE id = ${shareId}
        AND company_id = ${companyId}
        RETURNING id
      `;

      if (result.length === 0) {
        return errorResponse("NOT_FOUND", "Share not found");
      }

      auditService.logAction({
        userId,
        action: "DELETE_DOCUMENT_SHARE",
        entityType: "document_share",
        entityId: shareId,
      });

      return successResponse({ id: result[0].id as string });
    } catch (error) {
      serviceLogger.error(error, "Error deleting document share");
      return errorResponse("INTERNAL_ERROR", "Failed to delete share");
    }
  },

  /**
   * Toggle share active status
   */
  async toggleShareStatus(
    shareId: string,
    companyId: string,
    isActive: boolean
  ): Promise<ApiResponse<DocumentShare>> {
    try {
      const result = await db`
        UPDATE document_shares
        SET is_active = ${isActive}, updated_at = NOW()
        WHERE id = ${shareId}
        AND company_id = ${companyId}
        RETURNING *
      `;

      if (result.length === 0) {
        return errorResponse("NOT_FOUND", "Share not found");
      }

      const share = {
        id: result[0].id as string,
        documentId: result[0].document_id as string,
        companyId: result[0].company_id as string,
        token: result[0].token as string,
        createdBy: result[0].created_by as string | null,
        expiresAt: result[0].expires_at ? (result[0].expires_at as Date).toISOString() : null,
        passwordHash: result[0].password_hash as string | null,
        viewCount: result[0].view_count as number,
        maxViews: result[0].max_views as number | null,
        isActive: result[0].is_active as boolean,
        createdAt: (result[0].created_at as Date).toISOString(),
        updatedAt: (result[0].updated_at as Date).toISOString(),
      };

      return successResponse(share);
    } catch (error) {
      serviceLogger.error(error, "Error toggling share status");
      return errorResponse("INTERNAL_ERROR", "Failed to update share");
    }
  },
};

export const documentTagsService = {
  /**
   * Get all tags for a company
   */
  async getTags(companyId: string): Promise<ApiResponse<DocumentTag[]>> {
    try {
      const tags = await documentTagQueries.findAll(companyId);
      return successResponse(tags);
    } catch (error) {
      serviceLogger.error(error, "Error fetching tags");
      return errorResponse("INTERNAL_ERROR", "Failed to fetch tags");
    }
  },

  /**
   * Create a new tag
   */
  async createTag(companyId: string, data: { name: string }): Promise<ApiResponse<DocumentTag>> {
    try {
      // Generate slug from name
      const slug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      // Check if tag already exists
      const existingTag = await documentTagQueries.findBySlug(slug, companyId);
      if (existingTag) {
        return errorResponse("CONFLICT", "Tag with this name already exists");
      }

      const tag = await documentTagQueries.create({
        name: data.name,
        slug,
        companyId,
      });

      return successResponse(tag);
    } catch (error) {
      serviceLogger.error(error, "Error creating tag");
      return errorResponse("INTERNAL_ERROR", "Failed to create tag");
    }
  },

  /**
   * Delete a tag
   */
  async deleteTag(id: string, companyId: string): Promise<ApiResponse<{ id: string }>> {
    try {
      const result = await documentTagQueries.delete(id, companyId);
      if (!result) {
        return errorResponse("NOT_FOUND", "Tag not found");
      }
      return successResponse({ id: result.id });
    } catch (error) {
      serviceLogger.error(error, "Error deleting tag");
      return errorResponse("INTERNAL_ERROR", "Failed to delete tag");
    }
  },
};

// ============================================
// Document Tag Assignments Service
// ============================================

export const documentTagAssignmentsService = {
  /**
   * Assign a tag to a document
   */
  async assignTag(
    companyId: string,
    data: { documentId: string; tagId: string }
  ): Promise<ApiResponse<DocumentTagAssignment>> {
    try {
      const assignment = await documentTagAssignmentQueries.create({
        documentId: data.documentId,
        tagId: data.tagId,
        companyId,
      });
      return successResponse(assignment);
    } catch (error) {
      serviceLogger.error(error, "Error assigning tag");
      return errorResponse("INTERNAL_ERROR", "Failed to assign tag");
    }
  },

  /**
   * Remove a tag from a document
   */
  async removeTag(
    companyId: string,
    data: { documentId: string; tagId: string }
  ): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const result = await documentTagAssignmentQueries.delete({
        documentId: data.documentId,
        tagId: data.tagId,
        companyId,
      });

      if (!result) {
        return errorResponse("NOT_FOUND", "Tag assignment not found");
      }

      return successResponse({ success: true });
    } catch (error) {
      serviceLogger.error(error, "Error removing tag");
      return errorResponse("INTERNAL_ERROR", "Failed to remove tag");
    }
  },
};
