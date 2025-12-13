/**
 * Document Queries for Vault Module
 *
 * CRUD operations for documents, document tags, and tag assignments
 */

import { logger } from "../../lib/logger";
import { sql as db } from "../client";
import type { QueryParam } from "../query-builder";

// ============================================
// Types
// ============================================

export interface Document {
  id: string;
  name: string | null;
  title: string | null;
  summary: string | null;
  content: string | null;
  body: string | null;
  tag: string | null;
  date: string | null;
  language: string | null;
  pathTokens: string[];
  metadata: DocumentMetadata;
  processingStatus: DocumentProcessingStatus;
  companyId: string;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentMetadata {
  size?: number;
  mimetype?: string;
  originalName?: string;
  [key: string]: unknown;
}

export type DocumentProcessingStatus = "pending" | "processing" | "completed" | "failed";

export interface DocumentTag {
  id: string;
  name: string;
  slug: string;
  companyId: string;
  createdAt: string;
}

export interface DocumentTagAssignment {
  documentId: string;
  tagId: string;
  companyId: string;
  createdAt: string;
}

export interface DocumentWithTags extends Document {
  documentTagAssignments?: Array<{
    documentTag: DocumentTag;
  }>;
}

export interface DocumentsFilterParams {
  q?: string | null;
  tags?: string[] | null;
  start?: string | null;
  end?: string | null;
}

export interface DocumentsPaginationParams {
  cursor?: string | null;
  pageSize?: number;
}

export interface DocumentsListResult {
  data: DocumentWithTags[];
  meta: {
    cursor: string | undefined;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

// ============================================
// Helper Functions
// ============================================

function toISOString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return String(value);
}

function mapDocument(row: Record<string, unknown>): Document {
  return {
    id: row.id as string,
    name: row.name as string | null,
    title: row.title as string | null,
    summary: row.summary as string | null,
    content: row.content as string | null,
    body: row.body as string | null,
    tag: row.tag as string | null,
    date: row.date ? toISOString(row.date) : null,
    language: row.language as string | null,
    pathTokens: (row.path_tokens as string[]) || [],
    metadata: (row.metadata as DocumentMetadata) || {},
    processingStatus: row.processing_status as DocumentProcessingStatus,
    companyId: row.company_id as string,
    ownerId: row.owner_id as string | null,
    createdAt: toISOString(row.created_at),
    updatedAt: toISOString(row.updated_at),
  };
}

function mapDocumentTag(row: Record<string, unknown>): DocumentTag {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    companyId: row.company_id as string,
    createdAt: toISOString(row.created_at),
  };
}

// ============================================
// Document Queries
// ============================================

export const documentQueries = {
  /**
   * Get documents with cursor pagination and filters
   */
  async findAll(
    companyId: string,
    pagination: DocumentsPaginationParams,
    filters: DocumentsFilterParams
  ): Promise<DocumentsListResult> {
    const { pageSize = 20, cursor } = pagination;
    const { q, tags, start, end } = filters;

    // Convert cursor to offset
    const offset = cursor ? Number.parseInt(cursor, 10) : 0;
    const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));

    // Build WHERE conditions - use tenant_id as primary filter
    // Documents are stored with seller company's companyId, so we filter by tenant_id
    // to ensure all tenant documents (invoices, quotes, etc.) are visible
    const conditions: string[] = [];
    const values: QueryParam[] = [];
    let paramIndex = 1;

    // Resolve tenant_id from company and use it as the primary filter
    let resolvedTenantId: string | null = null;
    try {
      const tenantRow = await db`
        SELECT tenant_id FROM companies WHERE id = ${companyId} LIMIT 1
      `;
      resolvedTenantId = tenantRow.length > 0 ? (tenantRow[0].tenant_id as string) : null;
      if (resolvedTenantId) {
        conditions.push(`tenant_id = $${paramIndex}`);
        values.push(resolvedTenantId);
        paramIndex++;
      } else {
        // Fallback to company_id if no tenant_id found
        conditions.push(`company_id = $${paramIndex}`);
        values.push(companyId);
        paramIndex++;
      }
    } catch (error) {
      logger.warn({ error, companyId }, "Failed to resolve tenant_id for document list");
      // Fallback to company_id
      conditions.push(`company_id = $${paramIndex}`);
      values.push(companyId);
      paramIndex++;
    }

    // Exclude folder placeholders
    conditions.push(`(name IS NULL OR name NOT LIKE '%.folderPlaceholder')`);

    // Date range filter
    if (start) {
      conditions.push(`date >= $${paramIndex}`);
      values.push(start);
      paramIndex++;
    }
    if (end) {
      conditions.push(`date <= $${paramIndex}`);
      values.push(end);
      paramIndex++;
    }

    // Text search
    if (q) {
      conditions.push(
        `(title ILIKE $${paramIndex} OR name ILIKE $${paramIndex} OR summary ILIKE $${paramIndex})`
      );
      values.push(`%${q}%`);
      paramIndex++;
    }

    // Tag filtering
    if (tags && tags.length > 0) {
      // Get document IDs that have the specified tags
      // Use tenant_id to filter documents, since documents may be stored with seller's company_id
      const tagPlaceholders = tags.map((_, i) => `$${paramIndex + i}`).join(", ");
      const tagConditionQuery = resolvedTenantId
        ? `
				SELECT DISTINCT dta.document_id
				FROM document_tag_assignments dta
				JOIN documents d ON d.id = dta.document_id
				WHERE d.tenant_id = $1 AND dta.tag_id IN (${tagPlaceholders})
			`
        : `
				SELECT DISTINCT document_id
				FROM document_tag_assignments
				WHERE company_id = $1 AND tag_id IN (${tagPlaceholders})
			`;

      const filterValue = resolvedTenantId || companyId;
      const docIdsResult = await db.unsafe(tagConditionQuery, [
        filterValue,
        ...tags,
      ] as QueryParam[]);
      const documentIds = docIdsResult.map((row) => row.document_id as string);

      if (documentIds.length === 0) {
        return {
          data: [],
          meta: {
            cursor: undefined,
            hasPreviousPage: offset > 0,
            hasNextPage: false,
            totalCount: 0,
            page: Math.floor(offset / safePageSize) + 1,
            pageSize: safePageSize,
            totalPages: 0,
          },
        };
      }

      const idPlaceholders = documentIds.map((_, i) => `$${paramIndex + i}`).join(", ");
      conditions.push(`id IN (${idPlaceholders})`);
      values.push(...documentIds);
      paramIndex += documentIds.length;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Execute query with error handling
    let data: Record<string, unknown>[] = [];
    try {
      const selectQuery = `
				SELECT id, name, title, summary, date, metadata, path_tokens, processing_status,
				       company_id, owner_id, created_at, updated_at
				FROM documents
				${whereClause}
				ORDER BY created_at DESC
				LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
			`;

      data = await db.unsafe(selectQuery, [...values, safePageSize, offset] as QueryParam[]);
    } catch (error) {
      logger.error({ error }, "Error selecting documents");
      logger.error({ companyId }, "CompanyId");
      logger.error({ whereClause }, "WhereClause");
      logger.error({ values: [...values, safePageSize, offset] }, "Values");
      data = [];
    }

    // Fetch tag assignments for each document
    const documentsWithTags: DocumentWithTags[] = await Promise.all(
      data.map(async (row: Record<string, unknown>) => {
        const doc = mapDocument(row);
        const tagAssignments = await db`
					SELECT dta.document_id, dta.tag_id,
					       dt.id as tag_id, dt.name as tag_name, dt.slug as tag_slug, dt.company_id as tag_company_id, dt.created_at as tag_created_at
					FROM document_tag_assignments dta
					JOIN document_tags dt ON dta.tag_id = dt.id
					WHERE dta.document_id = ${doc.id}
				`;

        return {
          ...doc,
          documentTagAssignments: tagAssignments.map((ta) => ({
            documentTag: {
              id: ta.tag_id as string,
              name: ta.tag_name as string,
              slug: ta.tag_slug as string,
              companyId: ta.tag_company_id as string,
              createdAt: toISOString(ta.tag_created_at),
            },
          })),
        };
      })
    );

    // Get total count for pagination
    let totalCount = 0;
    try {
      const countQuery = `SELECT COUNT(*) as count FROM documents ${whereClause}`;
      const countResult = await db.unsafe(countQuery, values as QueryParam[]);
      totalCount = Number(countResult[0]?.count ?? 0);
    } catch (error) {
      logger.error({ error }, "Error counting documents");
    }

    // Calculate pagination info
    const currentPage = Math.floor(offset / safePageSize) + 1;
    const totalPages = Math.ceil(totalCount / safePageSize);

    // Generate next cursor
    const nextCursor =
      data.length === safePageSize ? (offset + safePageSize).toString() : undefined;

    return {
      data: documentsWithTags,
      meta: {
        cursor: nextCursor,
        hasPreviousPage: offset > 0,
        hasNextPage: data.length === safePageSize,
        totalCount,
        page: currentPage,
        pageSize: safePageSize,
        totalPages,
      },
    };
  },

  /**
   * Get a single document by ID (uses tenant_id for proper scoping)
   */
  async findById(id: string, companyId: string): Promise<DocumentWithTags | null> {
    // Resolve tenant_id from company
    const tenantRow = await db`
      SELECT tenant_id FROM companies WHERE id = ${companyId} LIMIT 1
    `;
    const tenantId = tenantRow.length > 0 ? (tenantRow[0].tenant_id as string) : null;

    // Query by tenant_id if available, otherwise fallback to company_id
    const result = tenantId
      ? await db`SELECT * FROM documents WHERE id = ${id} AND tenant_id = ${tenantId}`
      : await db`SELECT * FROM documents WHERE id = ${id} AND company_id = ${companyId}`;

    if (result.length === 0) return null;

    const doc = mapDocument(result[0]);

    // Fetch tag assignments
    const tagAssignments = await db`
			SELECT dta.document_id, dta.tag_id,
			       dt.id as tag_id, dt.name as tag_name, dt.slug as tag_slug, dt.company_id as tag_company_id, dt.created_at as tag_created_at
			FROM document_tag_assignments dta
			JOIN document_tags dt ON dta.tag_id = dt.id
			WHERE dta.document_id = ${id}
		`;

    return {
      ...doc,
      documentTagAssignments: tagAssignments.map((ta) => ({
        documentTag: {
          id: ta.tag_id as string,
          name: ta.tag_name as string,
          slug: ta.tag_slug as string,
          companyId: ta.tag_company_id as string,
          createdAt: toISOString(ta.tag_created_at),
        },
      })),
    };
  },

  /**
   * Get a document by file path
   */
  async findByPath(pathTokens: string[], companyId: string): Promise<Document | null> {
    const name = pathTokens.join("/");
    const result = await db`
			SELECT * FROM documents WHERE name = ${name} AND company_id = ${companyId}
		`;

    if (result.length === 0) return null;
    return mapDocument(result[0]);
  },

  /**
   * Create a new document
   */
  async create(data: {
    name: string;
    pathTokens: string[];
    metadata: DocumentMetadata;
    companyId: string;
    ownerId?: string;
    title?: string;
    summary?: string;
    processingStatus?: DocumentProcessingStatus;
  }): Promise<Document> {
    // Serialize metadata to JSON string for proper JSONB insertion
    const metadataJson = JSON.stringify(data.metadata);
    // Default to 'completed' since most uploads don't need processing
    const status = data.processingStatus || "completed";
    // Resolve tenant_id from company
    const tenantRow = await db`
      SELECT tenant_id FROM companies WHERE id = ${data.companyId} LIMIT 1
    `;
    const tenantId = tenantRow.length > 0 ? (tenantRow[0].tenant_id as string) : null;

    const result = await db`
            INSERT INTO documents (
                name, path_tokens, metadata, tenant_id, company_id, owner_id, title, summary, processing_status, created_at, updated_at
            ) VALUES (
                ${data.name},
                ${data.pathTokens},
                ${metadataJson}::jsonb,
                ${tenantId},
                ${data.companyId},
                ${data.ownerId || null},
                ${data.title || null},
                ${data.summary || null},
                ${status},
                NOW(),
                NOW()
            )
            RETURNING *
        `;

    return mapDocument(result[0]);
  },

  /**
   * Update a document (uses tenant_id for proper scoping)
   */
  async update(
    id: string,
    companyId: string,
    data: Partial<{
      title: string;
      summary: string;
      content: string;
      body: string;
      tag: string;
      date: string;
      language: string;
      processingStatus: DocumentProcessingStatus;
      metadata: DocumentMetadata;
    }>
  ): Promise<Document | null> {
    // Resolve tenant_id from company
    const tenantRow = await db`
      SELECT tenant_id FROM companies WHERE id = ${companyId} LIMIT 1
    `;
    const tenantId = tenantRow.length > 0 ? (tenantRow[0].tenant_id as string) : null;

    // Serialize metadata to JSON string for proper JSONB handling
    const metadataJson = data.metadata ? JSON.stringify(data.metadata) : null;
    const result = tenantId
      ? await db`
			UPDATE documents SET
				title = COALESCE(${data.title ?? null}, title),
				summary = COALESCE(${data.summary ?? null}, summary),
				content = COALESCE(${data.content ?? null}, content),
				body = COALESCE(${data.body ?? null}, body),
				tag = COALESCE(${data.tag ?? null}, tag),
				date = COALESCE(${data.date ?? null}, date),
				language = COALESCE(${data.language ?? null}, language),
				processing_status = COALESCE(${data.processingStatus ?? null}, processing_status),
				metadata = COALESCE(${metadataJson}::jsonb, metadata),
				updated_at = NOW()
			WHERE id = ${id} AND tenant_id = ${tenantId}
			RETURNING *
		`
      : await db`
			UPDATE documents SET
				title = COALESCE(${data.title ?? null}, title),
				summary = COALESCE(${data.summary ?? null}, summary),
				content = COALESCE(${data.content ?? null}, content),
				body = COALESCE(${data.body ?? null}, body),
				tag = COALESCE(${data.tag ?? null}, tag),
				date = COALESCE(${data.date ?? null}, date),
				language = COALESCE(${data.language ?? null}, language),
				processing_status = COALESCE(${data.processingStatus ?? null}, processing_status),
				metadata = COALESCE(${metadataJson}::jsonb, metadata),
				updated_at = NOW()
			WHERE id = ${id} AND company_id = ${companyId}
			RETURNING *
		`;

    if (result.length === 0) return null;
    return mapDocument(result[0]);
  },

  /**
   * Update processing status for multiple documents (uses tenant_id)
   */
  async updateProcessingStatus(
    names: string[],
    companyId: string,
    status: DocumentProcessingStatus
  ): Promise<Document[]> {
    if (names.length === 0) return [];

    // Resolve tenant_id from company
    const tenantRow = await db`
      SELECT tenant_id FROM companies WHERE id = ${companyId} LIMIT 1
    `;
    const tenantId = tenantRow.length > 0 ? (tenantRow[0].tenant_id as string) : null;

    const result = tenantId
      ? await db`
			UPDATE documents
			SET processing_status = ${status}, updated_at = NOW()
			WHERE name = ANY(${names}) AND tenant_id = ${tenantId}
			RETURNING *
		`
      : await db`
			UPDATE documents
			SET processing_status = ${status}, updated_at = NOW()
			WHERE name = ANY(${names}) AND company_id = ${companyId}
			RETURNING *
		`;

    return result.map(mapDocument);
  },

  /**
   * Delete a document (uses tenant_id for proper scoping)
   */
  async delete(
    id: string,
    companyId: string
  ): Promise<{ id: string; pathTokens: string[] } | null> {
    // Resolve tenant_id from company
    const tenantRow = await db`
      SELECT tenant_id FROM companies WHERE id = ${companyId} LIMIT 1
    `;
    const tenantId = tenantRow.length > 0 ? (tenantRow[0].tenant_id as string) : null;

    const result = tenantId
      ? await db`
			DELETE FROM documents
			WHERE id = ${id} AND tenant_id = ${tenantId}
			RETURNING id, path_tokens
		`
      : await db`
			DELETE FROM documents
			WHERE id = ${id} AND company_id = ${companyId}
			RETURNING id, path_tokens
		`;

    if (result.length === 0) return null;
    return {
      id: result[0].id as string,
      pathTokens: (result[0].path_tokens as string[]) || [],
    };
  },

  /**
   * Count documents for a company (uses tenant_id for accurate count)
   */
  async count(companyId: string): Promise<number> {
    // Resolve tenant_id from company to count all tenant documents
    const tenantRow = await db`
      SELECT tenant_id FROM companies WHERE id = ${companyId} LIMIT 1
    `;
    const tenantId = tenantRow.length > 0 ? (tenantRow[0].tenant_id as string) : null;

    const result = tenantId
      ? await db`SELECT COUNT(*) FROM documents WHERE tenant_id = ${tenantId}`
      : await db`SELECT COUNT(*) FROM documents WHERE company_id = ${companyId}`;

    return Number.parseInt(result[0].count as string, 10);
  },

  /**
   * Get recent documents (uses tenant_id to include all tenant documents)
   */
  async findRecent(companyId: string, limit: number = 5): Promise<Document[]> {
    // Resolve tenant_id from company to get all tenant documents
    const tenantRow = await db`
      SELECT tenant_id FROM companies WHERE id = ${companyId} LIMIT 1
    `;
    const tenantId = tenantRow.length > 0 ? (tenantRow[0].tenant_id as string) : null;

    const result = tenantId
      ? await db`
			SELECT * FROM documents
			WHERE tenant_id = ${tenantId}
			  AND (name IS NULL OR name NOT LIKE '%.folderPlaceholder')
			ORDER BY created_at DESC
			LIMIT ${limit}
		`
      : await db`
			SELECT * FROM documents
			WHERE company_id = ${companyId}
			  AND (name IS NULL OR name NOT LIKE '%.folderPlaceholder')
			ORDER BY created_at DESC
			LIMIT ${limit}
		`;

    return result.map(mapDocument);
  },

  /**
   * Find related/similar documents based on title similarity
   */
  async findRelated(
    documentId: string,
    companyId: string,
    options: { threshold?: number; limit?: number } = {}
  ): Promise<Array<Document & { similarityScore: number }>> {
    const { threshold = 0.3, limit = 5 } = options;

    // Resolve tenant_id from company
    const tenantRow = await db`
      SELECT tenant_id FROM companies WHERE id = ${companyId} LIMIT 1
    `;
    const tenantId = tenantRow.length > 0 ? (tenantRow[0].tenant_id as string) : null;

    try {
      const result = await db`
				SELECT * FROM match_similar_documents_by_title(
					${documentId}::uuid,
					${companyId}::uuid,
					${threshold}::float,
					${limit}::int
				)
			`;

      return result.map((row) => ({
        ...mapDocument(row),
        similarityScore: row.similarity_score as number,
      }));
    } catch (error) {
      // If the function doesn't exist yet, fall back to simple query
      logger.warn({ error }, "match_similar_documents_by_title function not found, using fallback");

      // Fallback: get recent documents excluding current one (use tenant_id)
      const fallbackResult = tenantId
        ? await db`
				SELECT * FROM documents
				WHERE tenant_id = ${tenantId}
				  AND id != ${documentId}
				  AND processing_status = 'completed'
				  AND (name IS NULL OR name NOT LIKE '%.folderPlaceholder')
				ORDER BY created_at DESC
				LIMIT ${limit}
			`
        : await db`
				SELECT * FROM documents
				WHERE company_id = ${companyId}
				  AND id != ${documentId}
				  AND processing_status = 'completed'
				  AND (name IS NULL OR name NOT LIKE '%.folderPlaceholder')
				ORDER BY created_at DESC
				LIMIT ${limit}
			`;

      return fallbackResult.map((row) => ({
        ...mapDocument(row),
        similarityScore: 0,
      }));
    }
  },
};

// ============================================
// Document Tag Queries
// ============================================

export const documentTagQueries = {
  /**
   * Get all tags for a company
   */
  async findAll(companyId: string): Promise<DocumentTag[]> {
    const result = await db`
			SELECT * FROM document_tags
			WHERE company_id = ${companyId}
			ORDER BY created_at DESC
		`;

    return result.map(mapDocumentTag);
  },

  /**
   * Get a tag by ID
   */
  async findById(id: string, companyId: string): Promise<DocumentTag | null> {
    const result = await db`
			SELECT * FROM document_tags WHERE id = ${id} AND company_id = ${companyId}
		`;

    if (result.length === 0) return null;
    return mapDocumentTag(result[0]);
  },

  /**
   * Get a tag by slug
   */
  async findBySlug(slug: string, companyId: string): Promise<DocumentTag | null> {
    const result = await db`
			SELECT * FROM document_tags WHERE slug = ${slug} AND company_id = ${companyId}
		`;

    if (result.length === 0) return null;
    return mapDocumentTag(result[0]);
  },

  /**
   * Create a new tag
   */
  async create(data: { name: string; slug: string; companyId: string }): Promise<DocumentTag> {
    const result = await db`
			INSERT INTO document_tags (name, slug, company_id, created_at)
			VALUES (${data.name}, ${data.slug}, ${data.companyId}, NOW())
			RETURNING *
		`;

    return mapDocumentTag(result[0]);
  },

  /**
   * Upsert tags (insert or update on conflict)
   */
  async upsert(
    tags: Array<{ name: string; slug: string; companyId: string }>
  ): Promise<Array<{ id: string; slug: string }>> {
    if (tags.length === 0) return [];

    const results: Array<{ id: string; slug: string }> = [];

    for (const tag of tags) {
      const result = await db`
				INSERT INTO document_tags (name, slug, company_id, created_at)
				VALUES (${tag.name}, ${tag.slug}, ${tag.companyId}, NOW())
				ON CONFLICT (slug, company_id) DO UPDATE SET name = EXCLUDED.name
				RETURNING id, slug
			`;
      results.push({
        id: result[0].id as string,
        slug: result[0].slug as string,
      });
    }

    return results;
  },

  /**
   * Delete a tag
   */
  async delete(id: string, companyId: string): Promise<{ id: string } | null> {
    const result = await db`
			DELETE FROM document_tags
			WHERE id = ${id} AND company_id = ${companyId}
			RETURNING id
		`;

    if (result.length === 0) return null;
    return { id: result[0].id as string };
  },
};

// ============================================
// Document Tag Assignment Queries
// ============================================

export const documentTagAssignmentQueries = {
  /**
   * Create a tag assignment
   */
  async create(data: {
    documentId: string;
    tagId: string;
    companyId: string;
  }): Promise<DocumentTagAssignment> {
    const result = await db`
			INSERT INTO document_tag_assignments (document_id, tag_id, company_id, created_at)
			VALUES (${data.documentId}, ${data.tagId}, ${data.companyId}, NOW())
			ON CONFLICT (document_id, tag_id) DO NOTHING
			RETURNING *
		`;

    if (result.length === 0) {
      // Already exists, return existing
      const existing = await db`
				SELECT * FROM document_tag_assignments
				WHERE document_id = ${data.documentId} AND tag_id = ${data.tagId}
			`;
      return {
        documentId: existing[0].document_id as string,
        tagId: existing[0].tag_id as string,
        companyId: existing[0].company_id as string,
        createdAt: toISOString(existing[0].created_at),
      };
    }

    return {
      documentId: result[0].document_id as string,
      tagId: result[0].tag_id as string,
      companyId: result[0].company_id as string,
      createdAt: toISOString(result[0].created_at),
    };
  },

  /**
   * Bulk create tag assignments
   */
  async createMany(
    assignments: Array<{
      documentId: string;
      tagId: string;
      companyId: string;
    }>
  ): Promise<DocumentTagAssignment[]> {
    if (assignments.length === 0) return [];

    const results: DocumentTagAssignment[] = [];

    for (const assignment of assignments) {
      const result = await this.create(assignment);
      results.push(result);
    }

    return results;
  },

  /**
   * Delete a tag assignment
   */
  async delete(data: {
    documentId: string;
    tagId: string;
    companyId: string;
  }): Promise<DocumentTagAssignment | null> {
    const result = await db`
			DELETE FROM document_tag_assignments
			WHERE document_id = ${data.documentId}
			  AND tag_id = ${data.tagId}
			  AND company_id = ${data.companyId}
			RETURNING *
		`;

    if (result.length === 0) return null;

    return {
      documentId: result[0].document_id as string,
      tagId: result[0].tag_id as string,
      companyId: result[0].company_id as string,
      createdAt: toISOString(result[0].created_at),
    };
  },

  /**
   * Get all tag assignments for a document
   */
  async findByDocument(documentId: string): Promise<DocumentTagAssignment[]> {
    const result = await db`
			SELECT * FROM document_tag_assignments WHERE document_id = ${documentId}
		`;

    return result.map((row) => ({
      documentId: row.document_id as string,
      tagId: row.tag_id as string,
      companyId: row.company_id as string,
      createdAt: toISOString(row.created_at),
    }));
  },
};
