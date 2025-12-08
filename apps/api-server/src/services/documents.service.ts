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
import { serviceLogger } from "../lib/logger";
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
          uploadedDocuments.push(document);
        } catch (err: unknown) {
          failures.push({ name: originalName, reason: "UPLOAD_FAILED" });
          auditService.logAction({
            userId: ownerId,
            action: "DOCUMENT_FAILED",
            entityType: "document",
            metadata: {
              name: originalName,
              reason: String(err?.message || err),
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
          uploadedDocuments.push(document);
        } catch (err: unknown) {
          failures.push({ name: originalName, reason: "UPLOAD_FAILED" });
          auditService.logAction({
            userId: ownerId,
            action: "DOCUMENT_FAILED",
            entityType: "document",
            metadata: {
              name: originalName,
              reason: String(err?.message || err),
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
   * Process documents (update metadata after upload)
   */
  async processDocuments(
    companyId: string,
    documents: Array<{ filePath: string[]; mimetype: string; size: number }>
  ): Promise<ApiResponse<void>> {
    try {
      const names = documents.map((doc) => doc.filePath.join("/"));
      await documentQueries.updateProcessingStatus(names, companyId, "processing");
      await documentQueries.updateProcessingStatus(names, companyId, "completed");
      for (const n of names) {
        auditService.logAction({
          action: "PROCESS_DOCUMENT",
          entityType: "document",
          metadata: { name: n },
        });
      }
      return successResponse(undefined);
    } catch (error: unknown) {
      try {
        const names = documents.map((doc) => doc.filePath.join("/"));
        await documentQueries.updateProcessingStatus(names, companyId, "failed");
        for (const n of names) {
          auditService.logAction({
            action: "DOCUMENT_FAILED",
            entityType: "document",
            metadata: { name: n, reason: String(error?.message || error) },
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
      const counts = await db.unsafe(
        `SELECT
				  COUNT(*)::int AS total_created,
				  SUM(CASE WHEN processing_status = 'completed' THEN 1 ELSE 0 END)::int AS total_completed,
				  SUM(CASE WHEN processing_status = 'failed' THEN 1 ELSE 0 END)::int AS total_failed
				 FROM documents ${whereClause}`,
        params
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
