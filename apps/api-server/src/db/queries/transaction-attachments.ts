/**
 * Transaction Attachments Queries
 * CRUD operations for transaction attachment management
 */

import { sql as db } from "../client";
import { serviceLogger } from "../../lib/logger";

// ==============================================
// TYPES
// ==============================================

export interface TransactionAttachment {
  id: string;
  tenantId: string;
  paymentId: string | null;
  name: string;
  filePath: string[];
  contentType: string | null;
  size: number | null;
  description: string | null;
  createdAt: string;
  createdBy: string | null;
}

export interface CreateAttachmentParams {
  tenantId: string;
  paymentId?: string;
  name: string;
  filePath: string[];
  contentType?: string;
  size?: number;
  description?: string;
  createdBy?: string;
}

export interface UpdateAttachmentParams {
  name?: string;
  description?: string;
  paymentId?: string;
}

// ==============================================
// QUERIES
// ==============================================

/**
 * Get all attachments for a payment
 */
export async function getAttachmentsByPayment(
  tenantId: string,
  paymentId: string
): Promise<TransactionAttachment[]> {
  try {
    const result = await db`
      SELECT
        id,
        tenant_id,
        payment_id,
        name,
        file_path,
        content_type,
        size,
        description,
        created_at,
        created_by
      FROM transaction_attachments
      WHERE tenant_id = ${tenantId} AND payment_id = ${paymentId}
      ORDER BY created_at DESC
    `;

    return result.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      tenantId: row.tenant_id as string,
      paymentId: row.payment_id as string | null,
      name: row.name as string,
      filePath: row.file_path as string[],
      contentType: row.content_type as string | null,
      size: row.size ? Number(row.size) : null,
      description: row.description as string | null,
      createdAt: row.created_at as string,
      createdBy: row.created_by as string | null,
    }));
  } catch (error) {
    serviceLogger.error({ error, tenantId, paymentId }, "Error getting attachments by payment");
    throw error;
  }
}

/**
 * Get all unlinked attachments for a tenant (no payment associated)
 */
export async function getUnlinkedAttachments(tenantId: string): Promise<TransactionAttachment[]> {
  try {
    const result = await db`
      SELECT
        id,
        tenant_id,
        payment_id,
        name,
        file_path,
        content_type,
        size,
        description,
        created_at,
        created_by
      FROM transaction_attachments
      WHERE tenant_id = ${tenantId} AND payment_id IS NULL
      ORDER BY created_at DESC
    `;

    return result.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      tenantId: row.tenant_id as string,
      paymentId: row.payment_id as string | null,
      name: row.name as string,
      filePath: row.file_path as string[],
      contentType: row.content_type as string | null,
      size: row.size ? Number(row.size) : null,
      description: row.description as string | null,
      createdAt: row.created_at as string,
      createdBy: row.created_by as string | null,
    }));
  } catch (error) {
    serviceLogger.error({ error, tenantId }, "Error getting unlinked attachments");
    throw error;
  }
}

/**
 * Get a single attachment by ID
 */
export async function getAttachmentById(
  tenantId: string,
  attachmentId: string
): Promise<TransactionAttachment | null> {
  try {
    const result = await db`
      SELECT
        id,
        tenant_id,
        payment_id,
        name,
        file_path,
        content_type,
        size,
        description,
        created_at,
        created_by
      FROM transaction_attachments
      WHERE id = ${attachmentId} AND tenant_id = ${tenantId}
      LIMIT 1
    `;

    if (result.length === 0) return null;

    const row = result[0];
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      paymentId: row.payment_id as string | null,
      name: row.name as string,
      filePath: row.file_path as string[],
      contentType: row.content_type as string | null,
      size: row.size ? Number(row.size) : null,
      description: row.description as string | null,
      createdAt: row.created_at as string,
      createdBy: row.created_by as string | null,
    };
  } catch (error) {
    serviceLogger.error({ error, tenantId, attachmentId }, "Error getting attachment by ID");
    throw error;
  }
}

/**
 * Create a new attachment
 */
export async function createAttachment(params: CreateAttachmentParams): Promise<TransactionAttachment> {
  try {
    const result = await db`
      INSERT INTO transaction_attachments (
        tenant_id,
        payment_id,
        name,
        file_path,
        content_type,
        size,
        description,
        created_by
      )
      VALUES (
        ${params.tenantId},
        ${params.paymentId || null},
        ${params.name},
        ${params.filePath},
        ${params.contentType || null},
        ${params.size || null},
        ${params.description || null},
        ${params.createdBy || null}
      )
      RETURNING *
    `;

    const row = result[0];
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      paymentId: row.payment_id as string | null,
      name: row.name as string,
      filePath: row.file_path as string[],
      contentType: row.content_type as string | null,
      size: row.size ? Number(row.size) : null,
      description: row.description as string | null,
      createdAt: row.created_at as string,
      createdBy: row.created_by as string | null,
    };
  } catch (error) {
    serviceLogger.error({ error, params }, "Error creating attachment");
    throw error;
  }
}

/**
 * Update an attachment
 */
export async function updateAttachment(
  tenantId: string,
  attachmentId: string,
  params: UpdateAttachmentParams
): Promise<TransactionAttachment | null> {
  try {
    const result = await db`
      UPDATE transaction_attachments
      SET
        name = COALESCE(${params.name || null}, name),
        description = COALESCE(${params.description || null}, description),
        payment_id = COALESCE(${params.paymentId || null}, payment_id)
      WHERE id = ${attachmentId} AND tenant_id = ${tenantId}
      RETURNING *
    `;

    if (result.length === 0) return null;

    const row = result[0];
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      paymentId: row.payment_id as string | null,
      name: row.name as string,
      filePath: row.file_path as string[],
      contentType: row.content_type as string | null,
      size: row.size ? Number(row.size) : null,
      description: row.description as string | null,
      createdAt: row.created_at as string,
      createdBy: row.created_by as string | null,
    };
  } catch (error) {
    serviceLogger.error({ error, tenantId, attachmentId, params }, "Error updating attachment");
    throw error;
  }
}

/**
 * Link attachment to a payment
 */
export async function linkAttachmentToPayment(
  tenantId: string,
  attachmentId: string,
  paymentId: string
): Promise<boolean> {
  try {
    const result = await db`
      UPDATE transaction_attachments
      SET payment_id = ${paymentId}
      WHERE id = ${attachmentId} AND tenant_id = ${tenantId}
      RETURNING id
    `;

    return result.length > 0;
  } catch (error) {
    serviceLogger.error({ error, tenantId, attachmentId, paymentId }, "Error linking attachment to payment");
    throw error;
  }
}

/**
 * Unlink attachment from payment
 */
export async function unlinkAttachmentFromPayment(
  tenantId: string,
  attachmentId: string
): Promise<boolean> {
  try {
    const result = await db`
      UPDATE transaction_attachments
      SET payment_id = NULL
      WHERE id = ${attachmentId} AND tenant_id = ${tenantId}
      RETURNING id
    `;

    return result.length > 0;
  } catch (error) {
    serviceLogger.error({ error, tenantId, attachmentId }, "Error unlinking attachment from payment");
    throw error;
  }
}

/**
 * Delete an attachment
 */
export async function deleteAttachment(tenantId: string, attachmentId: string): Promise<boolean> {
  try {
    const result = await db`
      DELETE FROM transaction_attachments
      WHERE id = ${attachmentId} AND tenant_id = ${tenantId}
      RETURNING id
    `;

    return result.length > 0;
  } catch (error) {
    serviceLogger.error({ error, tenantId, attachmentId }, "Error deleting attachment");
    throw error;
  }
}

/**
 * Get attachment count per payment
 */
export async function getAttachmentCounts(
  tenantId: string,
  paymentIds: string[]
): Promise<Record<string, number>> {
  try {
    if (paymentIds.length === 0) return {};

    const result = await db`
      SELECT
        payment_id,
        COUNT(*)::integer as count
      FROM transaction_attachments
      WHERE tenant_id = ${tenantId} AND payment_id = ANY(${paymentIds})
      GROUP BY payment_id
    `;

    const counts: Record<string, number> = {};
    for (const row of result) {
      counts[row.payment_id as string] = row.count as number;
    }

    return counts;
  } catch (error) {
    serviceLogger.error({ error, tenantId }, "Error getting attachment counts");
    throw error;
  }
}

/**
 * Search attachments by name
 */
export async function searchAttachments(
  tenantId: string,
  query: string
): Promise<TransactionAttachment[]> {
  try {
    const searchPattern = `%${query}%`;
    const result = await db`
      SELECT
        id,
        tenant_id,
        payment_id,
        name,
        file_path,
        content_type,
        size,
        description,
        created_at,
        created_by
      FROM transaction_attachments
      WHERE tenant_id = ${tenantId}
        AND (name ILIKE ${searchPattern} OR description ILIKE ${searchPattern})
      ORDER BY created_at DESC
      LIMIT 50
    `;

    return result.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      tenantId: row.tenant_id as string,
      paymentId: row.payment_id as string | null,
      name: row.name as string,
      filePath: row.file_path as string[],
      contentType: row.content_type as string | null,
      size: row.size ? Number(row.size) : null,
      description: row.description as string | null,
      createdAt: row.created_at as string,
      createdBy: row.created_by as string | null,
    }));
  } catch (error) {
    serviceLogger.error({ error, tenantId, query }, "Error searching attachments");
    throw error;
  }
}

export default {
  getAttachmentsByPayment,
  getUnlinkedAttachments,
  getAttachmentById,
  createAttachment,
  updateAttachment,
  linkAttachmentToPayment,
  unlinkAttachmentFromPayment,
  deleteAttachment,
  getAttachmentCounts,
  searchAttachments,
};
