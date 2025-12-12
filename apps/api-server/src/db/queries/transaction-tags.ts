/**
 * Transaction Tags Queries
 * CRUD operations for tags and transaction-tag assignments
 */

import { serviceLogger } from "../../lib/logger";
import { sql as db } from "../client";

// ==============================================
// TYPES
// ==============================================

export interface Tag {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionTag {
  id: string;
  tenantId: string;
  paymentId: string;
  tagId: string;
  createdAt: string;
  tag?: Tag;
}

export interface CreateTagParams {
  tenantId: string;
  name: string;
  color?: string;
}

export interface UpdateTagParams {
  name?: string;
  color?: string;
}

// ==============================================
// HELPER FUNCTIONS
// ==============================================

/**
 * Generate a URL-safe slug from a name
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function mapTagRow(row: Record<string, unknown>): Tag {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    name: row.name as string,
    slug: row.slug as string,
    color: row.color as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ==============================================
// TAG QUERIES
// ==============================================

/**
 * Get all tags for a tenant
 */
export async function getTags(tenantId: string): Promise<Tag[]> {
  try {
    const result = await db`
      SELECT
        id,
        tenant_id,
        name,
        slug,
        color,
        created_at,
        updated_at
      FROM tags
      WHERE tenant_id = ${tenantId}
      ORDER BY name ASC
    `;

    return result.map((row: Record<string, unknown>) => mapTagRow(row));
  } catch (error) {
    serviceLogger.error({ error, tenantId }, "Error getting tags");
    throw error;
  }
}

/**
 * Get a single tag by ID
 */
export async function getTagById(tenantId: string, tagId: string): Promise<Tag | null> {
  try {
    const result = await db`
      SELECT
        id,
        tenant_id,
        name,
        slug,
        color,
        created_at,
        updated_at
      FROM tags
      WHERE id = ${tagId} AND tenant_id = ${tenantId}
      LIMIT 1
    `;

    if (result.length === 0) return null;
    return mapTagRow(result[0]);
  } catch (error) {
    serviceLogger.error({ error, tenantId, tagId }, "Error getting tag by ID");
    throw error;
  }
}

/**
 * Get a tag by slug
 */
export async function getTagBySlug(tenantId: string, slug: string): Promise<Tag | null> {
  try {
    const result = await db`
      SELECT
        id,
        tenant_id,
        name,
        slug,
        color,
        created_at,
        updated_at
      FROM tags
      WHERE slug = ${slug} AND tenant_id = ${tenantId}
      LIMIT 1
    `;

    if (result.length === 0) return null;
    return mapTagRow(result[0]);
  } catch (error) {
    serviceLogger.error({ error, tenantId, slug }, "Error getting tag by slug");
    throw error;
  }
}

/**
 * Create a new tag
 */
export async function createTag(params: CreateTagParams): Promise<Tag> {
  try {
    const slug = slugify(params.name);

    const result = await db`
      INSERT INTO tags (
        tenant_id,
        name,
        slug,
        color
      )
      VALUES (
        ${params.tenantId},
        ${params.name},
        ${slug},
        ${params.color || "#6366F1"}
      )
      RETURNING *
    `;

    return mapTagRow(result[0]);
  } catch (error) {
    serviceLogger.error({ error, params }, "Error creating tag");
    throw error;
  }
}

/**
 * Update a tag
 */
export async function updateTag(
  tenantId: string,
  tagId: string,
  params: UpdateTagParams
): Promise<Tag | null> {
  try {
    const slug = params.name ? slugify(params.name) : undefined;

    const result = await db`
      UPDATE tags
      SET
        name = COALESCE(${params.name || null}, name),
        slug = COALESCE(${slug || null}, slug),
        color = COALESCE(${params.color || null}, color),
        updated_at = NOW()
      WHERE id = ${tagId} AND tenant_id = ${tenantId}
      RETURNING *
    `;

    if (result.length === 0) return null;
    return mapTagRow(result[0]);
  } catch (error) {
    serviceLogger.error({ error, tenantId, tagId, params }, "Error updating tag");
    throw error;
  }
}

/**
 * Delete a tag
 */
export async function deleteTag(tenantId: string, tagId: string): Promise<boolean> {
  try {
    const result = await db`
      DELETE FROM tags
      WHERE id = ${tagId} AND tenant_id = ${tenantId}
      RETURNING id
    `;

    return result.length > 0;
  } catch (error) {
    serviceLogger.error({ error, tenantId, tagId }, "Error deleting tag");
    throw error;
  }
}

// ==============================================
// TRANSACTION TAG QUERIES
// ==============================================

/**
 * Get all tags for a transaction
 */
export async function getTransactionTags(
  tenantId: string,
  paymentId: string
): Promise<TransactionTag[]> {
  try {
    const result = await db`
      SELECT
        tt.id,
        tt.tenant_id,
        tt.payment_id,
        tt.tag_id,
        tt.created_at,
        t.name as tag_name,
        t.slug as tag_slug,
        t.color as tag_color,
        t.updated_at as tag_updated_at
      FROM transaction_tags tt
      JOIN tags t ON t.id = tt.tag_id
      WHERE tt.payment_id = ${paymentId} AND tt.tenant_id = ${tenantId}
      ORDER BY t.name ASC
    `;

    return result.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      tenantId: row.tenant_id as string,
      paymentId: row.payment_id as string,
      tagId: row.tag_id as string,
      createdAt: row.created_at as string,
      tag: {
        id: row.tag_id as string,
        tenantId: row.tenant_id as string,
        name: row.tag_name as string,
        slug: row.tag_slug as string,
        color: row.tag_color as string | null,
        createdAt: row.created_at as string,
        updatedAt: row.tag_updated_at as string,
      },
    }));
  } catch (error) {
    serviceLogger.error({ error, tenantId, paymentId }, "Error getting transaction tags");
    throw error;
  }
}

/**
 * Add a tag to a transaction
 */
export async function addTagToTransaction(
  tenantId: string,
  paymentId: string,
  tagId: string
): Promise<TransactionTag> {
  try {
    const result = await db`
      INSERT INTO transaction_tags (
        tenant_id,
        payment_id,
        tag_id
      )
      VALUES (
        ${tenantId},
        ${paymentId},
        ${tagId}
      )
      ON CONFLICT (payment_id, tag_id) DO NOTHING
      RETURNING *
    `;

    if (result.length === 0) {
      // Tag already exists, fetch it
      const existing = await db`
        SELECT * FROM transaction_tags
        WHERE payment_id = ${paymentId} AND tag_id = ${tagId} AND tenant_id = ${tenantId}
        LIMIT 1
      `;
      if (existing.length === 0) {
        throw new Error("Failed to add or find transaction tag");
      }
      return {
        id: existing[0].id as string,
        tenantId: existing[0].tenant_id as string,
        paymentId: existing[0].payment_id as string,
        tagId: existing[0].tag_id as string,
        createdAt: existing[0].created_at as string,
      };
    }

    return {
      id: result[0].id as string,
      tenantId: result[0].tenant_id as string,
      paymentId: result[0].payment_id as string,
      tagId: result[0].tag_id as string,
      createdAt: result[0].created_at as string,
    };
  } catch (error) {
    serviceLogger.error({ error, tenantId, paymentId, tagId }, "Error adding tag to transaction");
    throw error;
  }
}

/**
 * Remove a tag from a transaction
 */
export async function removeTagFromTransaction(
  tenantId: string,
  paymentId: string,
  tagId: string
): Promise<boolean> {
  try {
    const result = await db`
      DELETE FROM transaction_tags
      WHERE payment_id = ${paymentId}
        AND tag_id = ${tagId}
        AND tenant_id = ${tenantId}
      RETURNING id
    `;

    return result.length > 0;
  } catch (error) {
    serviceLogger.error(
      { error, tenantId, paymentId, tagId },
      "Error removing tag from transaction"
    );
    throw error;
  }
}

/**
 * Set tags for a transaction (replace all existing)
 */
export async function setTransactionTags(
  tenantId: string,
  paymentId: string,
  tagIds: string[]
): Promise<TransactionTag[]> {
  try {
    // Delete existing tags
    await db`
      DELETE FROM transaction_tags
      WHERE payment_id = ${paymentId} AND tenant_id = ${tenantId}
    `;

    // If no tags, return empty
    if (tagIds.length === 0) {
      return [];
    }

    // Insert new tags
    const values = tagIds.map((tagId) => ({
      tenant_id: tenantId,
      payment_id: paymentId,
      tag_id: tagId,
    }));

    await db`
      INSERT INTO transaction_tags ${db(values)}
    `;

    // Return updated tags
    return getTransactionTags(tenantId, paymentId);
  } catch (error) {
    serviceLogger.error({ error, tenantId, paymentId, tagIds }, "Error setting transaction tags");
    throw error;
  }
}

/**
 * Get tag usage count (number of transactions)
 */
export async function getTagUsage(
  tenantId: string
): Promise<Array<{ tagId: string; name: string; count: number }>> {
  try {
    const result = await db`
      SELECT
        t.id as tag_id,
        t.name,
        COUNT(tt.id)::integer as count
      FROM tags t
      LEFT JOIN transaction_tags tt ON tt.tag_id = t.id
      WHERE t.tenant_id = ${tenantId}
      GROUP BY t.id, t.name
      ORDER BY count DESC, t.name ASC
    `;

    return result.map((row: Record<string, unknown>) => ({
      tagId: row.tag_id as string,
      name: row.name as string,
      count: row.count as number,
    }));
  } catch (error) {
    serviceLogger.error({ error, tenantId }, "Error getting tag usage");
    throw error;
  }
}

/**
 * Get transactions by tag
 */
export async function getTransactionsByTag(
  tenantId: string,
  tagId: string,
  options?: { limit?: number; offset?: number }
): Promise<{ paymentIds: string[]; total: number }> {
  try {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const [countResult, result] = await Promise.all([
      db`
        SELECT COUNT(*)::integer as total
        FROM transaction_tags
        WHERE tag_id = ${tagId} AND tenant_id = ${tenantId}
      `,
      db`
        SELECT payment_id
        FROM transaction_tags
        WHERE tag_id = ${tagId} AND tenant_id = ${tenantId}
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `,
    ]);

    return {
      paymentIds: result.map((row: Record<string, unknown>) => row.payment_id as string),
      total: (countResult[0]?.total as number) || 0,
    };
  } catch (error) {
    serviceLogger.error({ error, tenantId, tagId, options }, "Error getting transactions by tag");
    throw error;
  }
}

export default {
  // Tag operations
  getTags,
  getTagById,
  getTagBySlug,
  createTag,
  updateTag,
  deleteTag,
  // Transaction tag operations
  getTransactionTags,
  addTagToTransaction,
  removeTagFromTransaction,
  setTransactionTags,
  getTagUsage,
  getTransactionsByTag,
};
