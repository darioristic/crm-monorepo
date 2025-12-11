/**
 * Magic Inbox Database Queries
 * Adapted from Midday's Magic Inbox feature
 */

import { sql as db } from "../client";
import { serviceLogger } from "../../lib/logger";

// ==============================================
// TYPES
// ==============================================

export type InboxStatus =
  | "new"
  | "processing"
  | "analyzing"
  | "pending"
  | "suggested_match"
  | "no_match"
  | "done"
  | "archived"
  | "deleted";

export type InboxType = "invoice" | "expense" | "receipt" | "other";

export type InboxBlocklistType = "email" | "domain";

export interface InboxItem {
  id: string;
  tenantId: string;
  inboxAccountId: string | null;
  referenceId: string | null;
  senderEmail: string | null;
  forwardedTo: string | null;
  fileName: string | null;
  filePath: string[] | null;
  contentType: string | null;
  size: number | null;
  displayName: string | null;
  description: string | null;
  amount: number | null;
  baseAmount: number | null;
  currency: string | null;
  baseCurrency: string | null;
  date: string | null;
  taxAmount: number | null;
  taxRate: number | null;
  taxType: string | null;
  type: InboxType | null;
  status: InboxStatus;
  website: string | null;
  transactionId: string | null;
  attachmentId: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface InboxAccount {
  id: string;
  tenantId: string;
  email: string;
  provider: string;
  externalId: string;
  accessToken: string;
  refreshToken: string;
  expiryDate: string;
  status: string;
  lastAccessed: string;
  scheduleId: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InboxBlocklistItem {
  id: string;
  tenantId: string;
  type: InboxBlocklistType;
  value: string;
  createdAt: string;
}

export interface MatchSuggestion {
  id: string;
  tenantId: string;
  inboxId: string;
  transactionId: string;
  confidenceScore: number;
  amountScore: number | null;
  currencyScore: number | null;
  dateScore: number | null;
  embeddingScore: number | null;
  nameScore: number | null;
  matchType: string;
  matchDetails: Record<string, unknown> | null;
  status: string;
  userActionAt: string | null;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ==============================================
// SCORING FUNCTIONS
// ==============================================

export function calculateAmountScore(
  item1: { amount: number | null },
  item2: { amount: number | null }
): number {
  const amount1 = item1.amount;
  const amount2 = item2.amount;

  if (amount1 === null || amount2 === null) return 0.0;

  const abs1 = Math.abs(amount1);
  const abs2 = Math.abs(amount2);

  if (abs1 === abs2) return 1.0;

  const diff = Math.abs(abs1 - abs2);
  const max = Math.max(abs1, abs2);
  const percentDiff = diff / max;

  if (percentDiff <= 0.05) return 0.9;
  if (percentDiff <= 0.15) return 0.7;
  return 0.3;
}

export function calculateCurrencyScore(
  currency1?: string,
  currency2?: string
): number {
  if (!currency1 || !currency2) return 0.5;
  if (currency1 === currency2) return 1.0;
  return 0.3;
}

export function calculateDateScore(
  inboxDate: string | null,
  transactionDate: string | null,
  _inboxType?: InboxType | null
): number {
  if (!inboxDate || !transactionDate) return 0.5;

  const inboxDateObj = new Date(inboxDate);
  const transactionDateObj = new Date(transactionDate);
  const diffTime = Math.abs(transactionDateObj.getTime() - inboxDateObj.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 1.0;
  if (diffDays <= 1) return 0.9;
  if (diffDays <= 3) return 0.8;
  if (diffDays <= 7) return 0.7;
  if (diffDays <= 14) return 0.6;
  return 0.5;
}

// ==============================================
// INBOX QUERIES
// ==============================================

export interface GetInboxParams {
  tenantId: string;
  cursor?: string | null;
  order?: string | null;
  sort?: string | null;
  pageSize?: number;
  q?: string | null;
  status?: InboxStatus | null;
}

export async function getInbox(params: GetInboxParams) {
  const { tenantId, cursor, order, sort, pageSize = 20, q, status } = params;
  const offset = cursor ? parseInt(cursor, 10) : 0;

  try {
    // Build dynamic query based on filters
    let result;

    if (q && status) {
      const searchPattern = `%${q}%`;
      result = await db`
        SELECT
          i.id,
          i.file_name,
          i.file_path,
          i.display_name,
          i.transaction_id,
          i.amount,
          i.currency,
          i.content_type,
          i.date,
          i.status,
          i.created_at,
          i.website,
          i.sender_email,
          i.description,
          i.inbox_account_id,
          ia.id as account_id,
          ia.email as account_email,
          ia.provider as account_provider
        FROM inbox i
        LEFT JOIN inbox_accounts ia ON i.inbox_account_id = ia.id
        WHERE i.tenant_id = ${tenantId}
          AND i.status != 'deleted'
          AND i.status = ${status}
          AND (
            i.display_name ILIKE ${searchPattern}
            OR i.file_name ILIKE ${searchPattern}
            OR i.description ILIKE ${searchPattern}
          )
        ORDER BY ${sort === "alphabetical" ? db`i.display_name` : db`i.created_at`} ${order === "desc" ? db`DESC` : db`ASC`}
        LIMIT ${pageSize} OFFSET ${offset}
      `;
    } else if (q) {
      const searchPattern = `%${q}%`;
      result = await db`
        SELECT
          i.id,
          i.file_name,
          i.file_path,
          i.display_name,
          i.transaction_id,
          i.amount,
          i.currency,
          i.content_type,
          i.date,
          i.status,
          i.created_at,
          i.website,
          i.sender_email,
          i.description,
          i.inbox_account_id,
          ia.id as account_id,
          ia.email as account_email,
          ia.provider as account_provider
        FROM inbox i
        LEFT JOIN inbox_accounts ia ON i.inbox_account_id = ia.id
        WHERE i.tenant_id = ${tenantId}
          AND i.status != 'deleted'
          AND (
            i.display_name ILIKE ${searchPattern}
            OR i.file_name ILIKE ${searchPattern}
            OR i.description ILIKE ${searchPattern}
          )
        ORDER BY i.created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `;
    } else if (status) {
      result = await db`
        SELECT
          i.id,
          i.file_name,
          i.file_path,
          i.display_name,
          i.transaction_id,
          i.amount,
          i.currency,
          i.content_type,
          i.date,
          i.status,
          i.created_at,
          i.website,
          i.sender_email,
          i.description,
          i.inbox_account_id,
          ia.id as account_id,
          ia.email as account_email,
          ia.provider as account_provider
        FROM inbox i
        LEFT JOIN inbox_accounts ia ON i.inbox_account_id = ia.id
        WHERE i.tenant_id = ${tenantId}
          AND i.status != 'deleted'
          AND i.status = ${status}
        ORDER BY i.created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `;
    } else {
      result = await db`
        SELECT
          i.id,
          i.file_name,
          i.file_path,
          i.display_name,
          i.transaction_id,
          i.amount,
          i.currency,
          i.content_type,
          i.date,
          i.status,
          i.created_at,
          i.website,
          i.sender_email,
          i.description,
          i.inbox_account_id,
          ia.id as account_id,
          ia.email as account_email,
          ia.provider as account_provider
        FROM inbox i
        LEFT JOIN inbox_accounts ia ON i.inbox_account_id = ia.id
        WHERE i.tenant_id = ${tenantId}
          AND i.status != 'deleted'
        ORDER BY i.created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `;
    }

    const data = result.map((row: Record<string, unknown>) => ({
      id: row.id,
      fileName: row.file_name,
      filePath: row.file_path,
      displayName: row.display_name,
      transactionId: row.transaction_id,
      amount: row.amount ? Number(row.amount) : null,
      currency: row.currency,
      contentType: row.content_type,
      date: row.date,
      status: row.status,
      createdAt: row.created_at,
      website: row.website,
      senderEmail: row.sender_email,
      description: row.description,
      inboxAccountId: row.inbox_account_id,
      inboxAccount: row.account_id
        ? {
            id: row.account_id,
            email: row.account_email,
            provider: row.account_provider,
          }
        : null,
    }));

    const nextCursor =
      data.length === pageSize ? (offset + pageSize).toString() : undefined;

    return {
      meta: {
        cursor: nextCursor,
        hasPreviousPage: offset > 0,
        hasNextPage: data.length === pageSize,
      },
      data,
    };
  } catch (error) {
    serviceLogger.error({ error }, "Error in getInbox");
    throw error;
  }
}

export async function getInboxById(id: string, tenantId: string) {
  try {
    const result = await db`
      SELECT
        i.*,
        ia.id as account_id,
        ia.email as account_email,
        ia.provider as account_provider,
        tms.id as suggestion_id,
        tms.transaction_id as suggested_transaction_id,
        tms.confidence_score,
        tms.match_type,
        tms.status as suggestion_status
      FROM inbox i
      LEFT JOIN inbox_accounts ia ON i.inbox_account_id = ia.id
      LEFT JOIN transaction_match_suggestions tms ON tms.inbox_id = i.id AND tms.status = 'pending'
      WHERE i.id = ${id} AND i.tenant_id = ${tenantId}
      LIMIT 1
    `;

    if (result.length === 0) return null;

    const row = result[0] as Record<string, unknown>;

    return {
      id: row.id,
      fileName: row.file_name,
      filePath: row.file_path,
      displayName: row.display_name,
      transactionId: row.transaction_id,
      amount: row.amount ? Number(row.amount) : null,
      currency: row.currency,
      contentType: row.content_type,
      date: row.date,
      status: row.status,
      createdAt: row.created_at,
      website: row.website,
      senderEmail: row.sender_email,
      description: row.description,
      inboxAccountId: row.inbox_account_id,
      inboxAccount: row.account_id
        ? {
            id: row.account_id,
            email: row.account_email,
            provider: row.account_provider,
          }
        : null,
      suggestion: row.suggestion_id
        ? {
            id: row.suggestion_id,
            transactionId: row.suggested_transaction_id,
            confidenceScore: Number(row.confidence_score),
            matchType: row.match_type,
            status: row.suggestion_status,
          }
        : null,
    };
  } catch (error) {
    serviceLogger.error({ error }, "Error in getInboxById");
    throw error;
  }
}

export interface CreateInboxParams {
  tenantId: string;
  displayName: string;
  filePath: string[];
  fileName: string;
  contentType: string;
  size: number;
  referenceId?: string;
  website?: string;
  senderEmail?: string;
  inboxAccountId?: string;
  status?: InboxStatus;
}

export async function createInbox(params: CreateInboxParams) {
  const {
    tenantId,
    displayName,
    filePath,
    fileName,
    contentType,
    size,
    referenceId,
    website,
    senderEmail,
    inboxAccountId,
    status = "new",
  } = params;

  try {
    const result = await db`
      INSERT INTO inbox (
        tenant_id, display_name, file_path, file_name, content_type, size,
        reference_id, website, sender_email, inbox_account_id, status
      ) VALUES (
        ${tenantId}, ${displayName}, ${filePath}, ${fileName}, ${contentType}, ${size},
        ${referenceId || null}, ${website || null}, ${senderEmail || null}, ${inboxAccountId || null}, ${status}
      )
      RETURNING *
    `;

    return result[0];
  } catch (error) {
    serviceLogger.error({ error }, "Error in createInbox");
    throw error;
  }
}

export interface UpdateInboxParams {
  id: string;
  tenantId: string;
  status?: InboxStatus;
  displayName?: string;
  amount?: number;
  currency?: string;
  date?: string;
  taxAmount?: number;
  taxRate?: number;
  taxType?: string;
  type?: InboxType | null;
  website?: string;
}

export async function updateInbox(params: UpdateInboxParams) {
  const { id, tenantId, status, displayName, amount, currency, date, website, type } = params;

  try {
    const result = await db`
      UPDATE inbox
      SET
        status = COALESCE(${status || null}, status),
        display_name = COALESCE(${displayName || null}, display_name),
        amount = COALESCE(${amount || null}, amount),
        currency = COALESCE(${currency || null}, currency),
        date = COALESCE(${date || null}, date),
        website = COALESCE(${website || null}, website),
        type = COALESCE(${type || null}, type),
        updated_at = NOW()
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *
    `;

    return result[0] || null;
  } catch (error) {
    serviceLogger.error({ error }, "Error in updateInbox");
    throw error;
  }
}

export async function deleteInbox(id: string, tenantId: string) {
  try {
    const result = await db`
      UPDATE inbox
      SET status = 'deleted', transaction_id = NULL, attachment_id = NULL, updated_at = NOW()
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING id, file_path
    `;

    return result[0] || null;
  } catch (error) {
    serviceLogger.error({ error }, "Error in deleteInbox");
    throw error;
  }
}

// ==============================================
// INBOX ACCOUNTS QUERIES
// ==============================================

export async function getInboxAccounts(tenantId: string) {
  try {
    const result = await db`
      SELECT id, email, provider, last_accessed, status, error_message
      FROM inbox_accounts
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
    `;

    return result;
  } catch (error) {
    serviceLogger.error({ error }, "Error in getInboxAccounts");
    throw error;
  }
}

export async function getInboxAccountById(id: string, tenantId: string) {
  try {
    const result = await db`
      SELECT id, email, provider, access_token, refresh_token, expiry_date, last_accessed
      FROM inbox_accounts
      WHERE id = ${id} AND tenant_id = ${tenantId}
      LIMIT 1
    `;

    return result[0] || null;
  } catch (error) {
    serviceLogger.error({ error }, "Error in getInboxAccountById");
    throw error;
  }
}

export interface UpsertInboxAccountParams {
  tenantId: string;
  provider: string;
  accessToken: string;
  refreshToken: string;
  email: string;
  lastAccessed: string;
  externalId: string;
  expiryDate: string;
}

export async function upsertInboxAccount(params: UpsertInboxAccountParams) {
  try {
    const result = await db`
      INSERT INTO inbox_accounts (
        tenant_id, provider, access_token, refresh_token, email, last_accessed, external_id, expiry_date
      ) VALUES (
        ${params.tenantId}, ${params.provider}, ${params.accessToken}, ${params.refreshToken},
        ${params.email}, ${params.lastAccessed}, ${params.externalId}, ${params.expiryDate}
      )
      ON CONFLICT (external_id) DO UPDATE SET
        access_token = ${params.accessToken},
        refresh_token = ${params.refreshToken},
        last_accessed = ${params.lastAccessed},
        expiry_date = ${params.expiryDate},
        status = 'connected',
        error_message = NULL
      RETURNING id, provider, external_id
    `;

    return result[0];
  } catch (error) {
    serviceLogger.error({ error }, "Error in upsertInboxAccount");
    throw error;
  }
}

export async function updateInboxAccount(
  id: string,
  updates: {
    refreshToken?: string;
    accessToken?: string;
    expiryDate?: string;
    scheduleId?: string;
    lastAccessed?: string;
    status?: "connected" | "disconnected" | "error";
    errorMessage?: string | null;
  }
) {
  try {
    const result = await db`
      UPDATE inbox_accounts
      SET
        refresh_token = COALESCE(${updates.refreshToken || null}, refresh_token),
        access_token = COALESCE(${updates.accessToken || null}, access_token),
        expiry_date = COALESCE(${updates.expiryDate || null}, expiry_date),
        schedule_id = COALESCE(${updates.scheduleId || null}, schedule_id),
        last_accessed = COALESCE(${updates.lastAccessed || null}, last_accessed),
        status = COALESCE(${updates.status || null}, status),
        error_message = COALESCE(${updates.errorMessage ?? null}, error_message),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    return result[0] || null;
  } catch (error) {
    serviceLogger.error({ error }, "Error in updateInboxAccount");
    throw error;
  }
}

export async function deleteInboxAccount(id: string, tenantId: string) {
  try {
    const result = await db`
      DELETE FROM inbox_accounts
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING id, schedule_id
    `;

    return result[0] || null;
  } catch (error) {
    serviceLogger.error({ error }, "Error in deleteInboxAccount");
    throw error;
  }
}

// ==============================================
// INBOX BLOCKLIST QUERIES
// ==============================================

export async function getInboxBlocklist(tenantId: string) {
  try {
    const result = await db`
      SELECT id, tenant_id, type, value, created_at
      FROM inbox_blocklist
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at
    `;

    return result;
  } catch (error) {
    serviceLogger.error({ error }, "Error in getInboxBlocklist");
    throw error;
  }
}

export async function createInboxBlocklist(
  tenantId: string,
  type: InboxBlocklistType,
  value: string
) {
  try {
    const result = await db`
      INSERT INTO inbox_blocklist (tenant_id, type, value)
      VALUES (${tenantId}, ${type}, ${value})
      RETURNING id, tenant_id, type, value, created_at
    `;

    return result[0];
  } catch (error) {
    serviceLogger.error({ error }, "Error in createInboxBlocklist");
    throw error;
  }
}

export async function deleteInboxBlocklist(id: string, tenantId: string) {
  try {
    const result = await db`
      DELETE FROM inbox_blocklist
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING id
    `;

    return result[0] || null;
  } catch (error) {
    serviceLogger.error({ error }, "Error in deleteInboxBlocklist");
    throw error;
  }
}

// ==============================================
// INBOX EMBEDDINGS QUERIES
// ==============================================

export async function getInboxForEmbedding(inboxId: string) {
  try {
    const result = await db`
      SELECT id, display_name, website, description
      FROM inbox
      WHERE id = ${inboxId}
      LIMIT 1
    `;

    return result[0] || null;
  } catch (error) {
    serviceLogger.error({ error }, "Error in getInboxForEmbedding");
    throw error;
  }
}

export async function createInboxEmbedding(params: {
  inboxId: string;
  tenantId: string;
  embedding: number[];
  sourceText: string;
  model: string;
}) {
  try {
    const embeddingStr = `[${params.embedding.join(",")}]`;
    const result = await db`
      INSERT INTO inbox_embeddings (inbox_id, tenant_id, embedding, source_text, model)
      VALUES (${params.inboxId}, ${params.tenantId}, ${embeddingStr}::vector, ${params.sourceText}, ${params.model})
      RETURNING id, inbox_id
    `;

    return result[0];
  } catch (error) {
    serviceLogger.error({ error }, "Error in createInboxEmbedding");
    throw error;
  }
}

export async function checkInboxEmbeddingExists(inboxId: string): Promise<boolean> {
  try {
    const result = await db`
      SELECT id FROM inbox_embeddings WHERE inbox_id = ${inboxId} LIMIT 1
    `;

    return result.length > 0;
  } catch (error) {
    serviceLogger.error({ error }, "Error in checkInboxEmbeddingExists");
    throw error;
  }
}

export async function deleteInboxEmbedding(inboxId: string, tenantId: string) {
  try {
    const result = await db`
      DELETE FROM inbox_embeddings
      WHERE inbox_id = ${inboxId} AND tenant_id = ${tenantId}
      RETURNING id, inbox_id
    `;

    return result[0] || null;
  } catch (error) {
    serviceLogger.error({ error }, "Error in deleteInboxEmbedding");
    throw error;
  }
}

// ==============================================
// TRANSACTION MATCH SUGGESTIONS QUERIES
// ==============================================

export interface CreateMatchSuggestionParams {
  tenantId: string;
  inboxId: string;
  transactionId: string;
  confidenceScore: number;
  amountScore: number;
  currencyScore: number;
  dateScore: number;
  embeddingScore: number;
  matchType: "auto_matched" | "high_confidence" | "suggested";
  matchDetails: Record<string, unknown>;
  status?: "pending" | "confirmed" | "declined";
  userId?: string;
}

export async function createMatchSuggestion(params: CreateMatchSuggestionParams) {
  try {
    const matchDetailsJson = JSON.stringify(params.matchDetails);
    const result = await db`
      INSERT INTO transaction_match_suggestions (
        tenant_id, inbox_id, transaction_id,
        confidence_score, amount_score, currency_score, date_score, embedding_score,
        match_type, match_details, status, user_id
      ) VALUES (
        ${params.tenantId}, ${params.inboxId}, ${params.transactionId},
        ${params.confidenceScore}, ${params.amountScore}, ${params.currencyScore}, ${params.dateScore}, ${params.embeddingScore},
        ${params.matchType}, ${matchDetailsJson}::jsonb, ${params.status || "pending"}, ${params.userId || null}
      )
      ON CONFLICT (inbox_id, transaction_id) DO UPDATE SET
        confidence_score = ${params.confidenceScore},
        amount_score = ${params.amountScore},
        currency_score = ${params.currencyScore},
        date_score = ${params.dateScore},
        embedding_score = ${params.embeddingScore},
        match_type = ${params.matchType},
        match_details = ${matchDetailsJson}::jsonb,
        status = ${params.status || "pending"},
        updated_at = NOW()
      RETURNING *
    `;

    return result[0];
  } catch (error) {
    serviceLogger.error({ error }, "Error in createMatchSuggestion");
    throw error;
  }
}

export async function confirmSuggestedMatch(params: {
  tenantId: string;
  suggestionId: string;
  inboxId: string;
  transactionId: string;
  userId: string;
}) {
  try {
    // Update suggestion status
    await db`
      UPDATE transaction_match_suggestions
      SET status = 'confirmed', user_action_at = NOW(), user_id = ${params.userId}
      WHERE id = ${params.suggestionId} AND tenant_id = ${params.tenantId}
    `;

    // Update inbox status to done and link transaction
    const result = await db`
      UPDATE inbox
      SET status = 'done', transaction_id = ${params.transactionId}, updated_at = NOW()
      WHERE id = ${params.inboxId} AND tenant_id = ${params.tenantId}
      RETURNING *
    `;

    return result[0];
  } catch (error) {
    serviceLogger.error({ error }, "Error in confirmSuggestedMatch");
    throw error;
  }
}

export async function declineSuggestedMatch(params: {
  tenantId: string;
  suggestionId: string;
  inboxId: string;
  userId: string;
}) {
  try {
    // Update suggestion status
    await db`
      UPDATE transaction_match_suggestions
      SET status = 'declined', user_action_at = NOW(), user_id = ${params.userId}
      WHERE id = ${params.suggestionId} AND tenant_id = ${params.tenantId}
    `;

    // Update inbox status back to pending
    await db`
      UPDATE inbox
      SET status = 'pending', updated_at = NOW()
      WHERE id = ${params.inboxId} AND tenant_id = ${params.tenantId}
    `;
  } catch (error) {
    serviceLogger.error({ error }, "Error in declineSuggestedMatch");
    throw error;
  }
}

// ==============================================
// INBOX STATISTICS
// ==============================================

export async function getInboxStats(tenantId: string) {
  try {
    const result = await db`
      SELECT
        COUNT(*) FILTER (WHERE status = 'new') as new_items,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_items,
        COUNT(*) FILTER (WHERE status = 'analyzing') as analyzing_items,
        COUNT(*) FILTER (WHERE status = 'suggested_match') as suggested_matches,
        COUNT(*) FILTER (WHERE status = 'done') as done_items,
        COUNT(*) FILTER (WHERE status != 'deleted') as total_items
      FROM inbox
      WHERE tenant_id = ${tenantId}
    `;

    const row = result[0] as Record<string, unknown>;

    return {
      newItems: Number(row.new_items) || 0,
      pendingItems: Number(row.pending_items) || 0,
      analyzingItems: Number(row.analyzing_items) || 0,
      suggestedMatches: Number(row.suggested_matches) || 0,
      doneItems: Number(row.done_items) || 0,
      totalItems: Number(row.total_items) || 0,
    };
  } catch (error) {
    serviceLogger.error({ error }, "Error in getInboxStats");
    throw error;
  }
}

// ==============================================
// INBOX MATCHING QUERIES
// ==============================================

export async function getPendingInboxForMatching(
  tenantId: string,
  limit: number = 100
) {
  try {
    const result = await db`
      SELECT id, amount, date, currency, created_at
      FROM inbox
      WHERE tenant_id = ${tenantId}
        AND status = 'pending'
        AND transaction_id IS NULL
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return result;
  } catch (error) {
    serviceLogger.error({ error }, "Error in getPendingInboxForMatching");
    throw error;
  }
}

export async function getInboxByStatus(
  tenantId: string,
  status?: InboxStatus
) {
  try {
    if (status) {
      const result = await db`
        SELECT id, display_name, amount, currency, date, status, created_at, transaction_id
        FROM inbox
        WHERE tenant_id = ${tenantId} AND status = ${status}
        ORDER BY created_at DESC
      `;
      return result;
    } else {
      const result = await db`
        SELECT id, display_name, amount, currency, date, status, created_at, transaction_id
        FROM inbox
        WHERE tenant_id = ${tenantId}
        ORDER BY created_at DESC
      `;
      return result;
    }
  } catch (error) {
    serviceLogger.error({ error }, "Error in getInboxByStatus");
    throw error;
  }
}

/**
 * Check if an inbox-transaction pair was previously dismissed
 */
export async function wasPreviouslyDismissed(
  tenantId: string,
  inboxId: string,
  transactionId: string
): Promise<boolean> {
  try {
    const result = await db`
      SELECT id FROM transaction_match_suggestions
      WHERE tenant_id = ${tenantId}
        AND inbox_id = ${inboxId}
        AND transaction_id = ${transactionId}
        AND status IN ('declined', 'unmatched')
      LIMIT 1
    `;

    return result.length > 0;
  } catch (error) {
    serviceLogger.error({ error }, "Error in wasPreviouslyDismissed");
    throw error;
  }
}

export default {
  // Inbox
  getInbox,
  getInboxById,
  createInbox,
  updateInbox,
  deleteInbox,
  getInboxStats,
  getInboxByStatus,
  getPendingInboxForMatching,

  // Inbox Accounts
  getInboxAccounts,
  getInboxAccountById,
  upsertInboxAccount,
  updateInboxAccount,
  deleteInboxAccount,

  // Blocklist
  getInboxBlocklist,
  createInboxBlocklist,
  deleteInboxBlocklist,

  // Embeddings
  getInboxForEmbedding,
  createInboxEmbedding,
  checkInboxEmbeddingExists,
  deleteInboxEmbedding,

  // Match Suggestions
  createMatchSuggestion,
  confirmSuggestedMatch,
  declineSuggestedMatch,
  wasPreviouslyDismissed,

  // Scoring utilities
  calculateAmountScore,
  calculateCurrencyScore,
  calculateDateScore,
};
