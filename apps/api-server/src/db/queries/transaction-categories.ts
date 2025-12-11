/**
 * Transaction Categories Queries
 * CRUD operations for transaction category management
 */

import { sql as db } from "../client";
import { serviceLogger } from "../../lib/logger";

// ==============================================
// TYPES
// ==============================================

export interface TransactionCategory {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  parentSlug: string | null;
  vatRate: number;
  embeddingText: string | null;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryParams {
  tenantId: string;
  slug: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  parentSlug?: string;
  vatRate?: number;
  embeddingText?: string;
  isSystem?: boolean;
}

export interface UpdateCategoryParams {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  parentSlug?: string;
  vatRate?: number;
  embeddingText?: string;
}

// ==============================================
// QUERIES
// ==============================================

/**
 * Get all categories for a tenant
 */
export async function getCategories(tenantId: string): Promise<TransactionCategory[]> {
  try {
    const result = await db`
      SELECT
        id,
        tenant_id,
        slug,
        name,
        description,
        color,
        icon,
        parent_slug,
        vat_rate,
        embedding_text,
        is_system,
        created_at,
        updated_at
      FROM transaction_categories
      WHERE tenant_id = ${tenantId}
      ORDER BY
        CASE WHEN parent_slug IS NULL THEN 0 ELSE 1 END,
        name ASC
    `;

    return result.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      tenantId: row.tenant_id as string,
      slug: row.slug as string,
      name: row.name as string,
      description: row.description as string | null,
      color: row.color as string | null,
      icon: row.icon as string | null,
      parentSlug: row.parent_slug as string | null,
      vatRate: Number(row.vat_rate) || 0,
      embeddingText: row.embedding_text as string | null,
      isSystem: row.is_system as boolean,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }));
  } catch (error) {
    serviceLogger.error({ error, tenantId }, "Error getting categories");
    throw error;
  }
}

/**
 * Get a single category by ID
 */
export async function getCategoryById(
  tenantId: string,
  categoryId: string
): Promise<TransactionCategory | null> {
  try {
    const result = await db`
      SELECT
        id,
        tenant_id,
        slug,
        name,
        description,
        color,
        icon,
        parent_slug,
        vat_rate,
        embedding_text,
        is_system,
        created_at,
        updated_at
      FROM transaction_categories
      WHERE id = ${categoryId} AND tenant_id = ${tenantId}
      LIMIT 1
    `;

    if (result.length === 0) return null;

    const row = result[0];
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      slug: row.slug as string,
      name: row.name as string,
      description: row.description as string | null,
      color: row.color as string | null,
      icon: row.icon as string | null,
      parentSlug: row.parent_slug as string | null,
      vatRate: Number(row.vat_rate) || 0,
      embeddingText: row.embedding_text as string | null,
      isSystem: row.is_system as boolean,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  } catch (error) {
    serviceLogger.error({ error, tenantId, categoryId }, "Error getting category by ID");
    throw error;
  }
}

/**
 * Get a category by slug
 */
export async function getCategoryBySlug(
  tenantId: string,
  slug: string
): Promise<TransactionCategory | null> {
  try {
    const result = await db`
      SELECT
        id,
        tenant_id,
        slug,
        name,
        description,
        color,
        icon,
        parent_slug,
        vat_rate,
        embedding_text,
        is_system,
        created_at,
        updated_at
      FROM transaction_categories
      WHERE slug = ${slug} AND tenant_id = ${tenantId}
      LIMIT 1
    `;

    if (result.length === 0) return null;

    const row = result[0];
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      slug: row.slug as string,
      name: row.name as string,
      description: row.description as string | null,
      color: row.color as string | null,
      icon: row.icon as string | null,
      parentSlug: row.parent_slug as string | null,
      vatRate: Number(row.vat_rate) || 0,
      embeddingText: row.embedding_text as string | null,
      isSystem: row.is_system as boolean,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  } catch (error) {
    serviceLogger.error({ error, tenantId, slug }, "Error getting category by slug");
    throw error;
  }
}

/**
 * Create a new category
 */
export async function createCategory(params: CreateCategoryParams): Promise<TransactionCategory> {
  try {
    const result = await db`
      INSERT INTO transaction_categories (
        tenant_id,
        slug,
        name,
        description,
        color,
        icon,
        parent_slug,
        vat_rate,
        embedding_text,
        is_system
      )
      VALUES (
        ${params.tenantId},
        ${params.slug},
        ${params.name},
        ${params.description || null},
        ${params.color || null},
        ${params.icon || null},
        ${params.parentSlug || null},
        ${params.vatRate || 0},
        ${params.embeddingText || null},
        ${params.isSystem || false}
      )
      RETURNING *
    `;

    const row = result[0];
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      slug: row.slug as string,
      name: row.name as string,
      description: row.description as string | null,
      color: row.color as string | null,
      icon: row.icon as string | null,
      parentSlug: row.parent_slug as string | null,
      vatRate: Number(row.vat_rate) || 0,
      embeddingText: row.embedding_text as string | null,
      isSystem: row.is_system as boolean,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  } catch (error) {
    serviceLogger.error({ error, params }, "Error creating category");
    throw error;
  }
}

/**
 * Update a category
 */
export async function updateCategory(
  tenantId: string,
  categoryId: string,
  params: UpdateCategoryParams
): Promise<TransactionCategory | null> {
  try {
    // Build dynamic update
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (params.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(params.name);
    }
    if (params.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(params.description);
    }
    if (params.color !== undefined) {
      updates.push(`color = $${paramIndex++}`);
      values.push(params.color);
    }
    if (params.icon !== undefined) {
      updates.push(`icon = $${paramIndex++}`);
      values.push(params.icon);
    }
    if (params.parentSlug !== undefined) {
      updates.push(`parent_slug = $${paramIndex++}`);
      values.push(params.parentSlug);
    }
    if (params.vatRate !== undefined) {
      updates.push(`vat_rate = $${paramIndex++}`);
      values.push(params.vatRate);
    }
    if (params.embeddingText !== undefined) {
      updates.push(`embedding_text = $${paramIndex++}`);
      values.push(params.embeddingText);
    }

    if (updates.length === 0) {
      return getCategoryById(tenantId, categoryId);
    }

    // Use simple update since we can't use dynamic SQL easily with tagged templates
    const result = await db`
      UPDATE transaction_categories
      SET
        name = COALESCE(${params.name || null}, name),
        description = COALESCE(${params.description || null}, description),
        color = COALESCE(${params.color || null}, color),
        icon = COALESCE(${params.icon || null}, icon),
        parent_slug = COALESCE(${params.parentSlug || null}, parent_slug),
        vat_rate = COALESCE(${params.vatRate ?? null}, vat_rate),
        embedding_text = COALESCE(${params.embeddingText || null}, embedding_text),
        updated_at = NOW()
      WHERE id = ${categoryId} AND tenant_id = ${tenantId} AND is_system = false
      RETURNING *
    `;

    if (result.length === 0) return null;

    const row = result[0];
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      slug: row.slug as string,
      name: row.name as string,
      description: row.description as string | null,
      color: row.color as string | null,
      icon: row.icon as string | null,
      parentSlug: row.parent_slug as string | null,
      vatRate: Number(row.vat_rate) || 0,
      embeddingText: row.embedding_text as string | null,
      isSystem: row.is_system as boolean,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  } catch (error) {
    serviceLogger.error({ error, tenantId, categoryId, params }, "Error updating category");
    throw error;
  }
}

/**
 * Delete a category (only non-system categories)
 */
export async function deleteCategory(tenantId: string, categoryId: string): Promise<boolean> {
  try {
    const result = await db`
      DELETE FROM transaction_categories
      WHERE id = ${categoryId} AND tenant_id = ${tenantId} AND is_system = false
      RETURNING id
    `;

    return result.length > 0;
  } catch (error) {
    serviceLogger.error({ error, tenantId, categoryId }, "Error deleting category");
    throw error;
  }
}

/**
 * Seed default categories for a tenant
 */
export async function seedDefaultCategories(tenantId: string): Promise<void> {
  try {
    await db`SELECT seed_default_transaction_categories(${tenantId})`;
    serviceLogger.info({ tenantId }, "Default categories seeded");
  } catch (error) {
    serviceLogger.error({ error, tenantId }, "Error seeding default categories");
    throw error;
  }
}

/**
 * Get category usage count (number of transactions)
 */
export async function getCategoryUsage(tenantId: string): Promise<Array<{ slug: string; count: number }>> {
  try {
    const result = await db`
      SELECT
        tc.slug,
        COUNT(p.id)::integer as count
      FROM transaction_categories tc
      LEFT JOIN payments p ON p.category_slug = tc.slug
      LEFT JOIN invoices i ON p.invoice_id = i.id AND i.tenant_id = ${tenantId}
      WHERE tc.tenant_id = ${tenantId}
      GROUP BY tc.slug
      ORDER BY count DESC
    `;

    return result.map((row: Record<string, unknown>) => ({
      slug: row.slug as string,
      count: row.count as number,
    }));
  } catch (error) {
    serviceLogger.error({ error, tenantId }, "Error getting category usage");
    throw error;
  }
}

export default {
  getCategories,
  getCategoryById,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
  seedDefaultCategories,
  getCategoryUsage,
};
