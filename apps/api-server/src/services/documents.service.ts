/**
 * Documents Service for Vault Module
 *
 * Business logic for document management
 */

import { errorResponse, successResponse } from "@crm/utils";
import type { ApiResponse } from "@crm/types";
import {
	documentQueries,
	documentTagQueries,
	documentTagAssignmentQueries,
	type Document,
	type DocumentWithTags,
	type DocumentTag,
	type DocumentTagAssignment,
	type DocumentsFilterParams,
	type DocumentsPaginationParams,
	type DocumentsListResult,
	type DocumentMetadata,
	type DocumentProcessingStatus,
} from "../db/queries/documents";
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
			console.error("Error fetching documents:", error);
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
			console.error("Error fetching document:", error);
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
	): Promise<ApiResponse<Document[]>> {
		try {
			const uploadedDocuments: Document[] = [];

			for (const { file, originalName, mimetype } of files) {
				// Validate file size
				if (file.size > (process.env.MAX_FILE_SIZE ? parseInt(process.env.MAX_FILE_SIZE) : 5 * 1024 * 1024)) {
					return errorResponse("VALIDATION_ERROR", `File "${originalName}" exceeds maximum size`);
				}

				// Validate mime type
				if (!fileStorage.isSupportedMimeType(mimetype)) {
					return errorResponse("VALIDATION_ERROR", `File type "${mimetype}" is not supported`);
				}

				// Upload file to storage
				const uploadResult = await fileStorage.uploadFile(companyId, file, originalName);

				// Create document record in database
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

				uploadedDocuments.push(document);
			}

			return successResponse(uploadedDocuments);
		} catch (error) {
			console.error("Error uploading files:", error);
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
			// For now, just mark documents as completed
			// In a real implementation, this would trigger background jobs for processing
			const names = documents.map((doc) => doc.filePath.join("/"));
			await documentQueries.updateProcessingStatus(names, companyId, "completed");
			return successResponse(undefined);
		} catch (error) {
			console.error("Error processing documents:", error);
			return errorResponse("INTERNAL_ERROR", "Failed to process documents");
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
			console.error("Error updating document:", error);
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
			console.error("Error deleting document:", error);
			return errorResponse("INTERNAL_ERROR", "Failed to delete document");
		}
	},

	/**
	 * Get download info for a document
	 */
	async getDownloadInfo(
		pathTokens: string[],
		companyId: string
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
			console.error("Error getting download info:", error);
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
			console.error("Error getting signed URL:", error);
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
			console.error("Error getting document count:", error);
			return errorResponse("INTERNAL_ERROR", "Failed to get document count");
		}
	},

	/**
	 * Get recent documents
	 */
	async getRecentDocuments(
		companyId: string,
		limit: number = 5
	): Promise<ApiResponse<Document[]>> {
		try {
			const documents = await documentQueries.findRecent(companyId, limit);
			return successResponse(documents);
		} catch (error) {
			console.error("Error fetching recent documents:", error);
			return errorResponse("INTERNAL_ERROR", "Failed to fetch recent documents");
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
			console.error("Error fetching tags:", error);
			return errorResponse("INTERNAL_ERROR", "Failed to fetch tags");
		}
	},

	/**
	 * Create a new tag
	 */
	async createTag(
		companyId: string,
		data: { name: string }
	): Promise<ApiResponse<DocumentTag>> {
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
			console.error("Error creating tag:", error);
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
			console.error("Error deleting tag:", error);
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
			console.error("Error assigning tag:", error);
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
			console.error("Error removing tag:", error);
			return errorResponse("INTERNAL_ERROR", "Failed to remove tag");
		}
	},
};

