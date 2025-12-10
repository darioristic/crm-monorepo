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
};

// ============================================
// Document Tags Service
// ============================================

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
