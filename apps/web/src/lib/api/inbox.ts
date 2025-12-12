/**
 * Magic Inbox API Client
 * Adapted from Midday's Magic Inbox feature
 */

import { apiClient } from "../api";

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
  fileName: string | null;
  filePath: string[] | null;
  displayName: string | null;
  transactionId: string | null;
  amount: number | null;
  currency: string | null;
  contentType: string | null;
  date: string | null;
  status: InboxStatus;
  createdAt: string;
  website: string | null;
  senderEmail: string | null;
  description: string | null;
  inboxAccountId: string | null;
  inboxAccount: {
    id: string;
    email: string;
    provider: string;
  } | null;
  suggestion?: {
    id: string;
    transactionId: string;
    confidenceScore: number;
    matchType: string;
    status: string;
  } | null;
}

export interface InboxAccount {
  id: string;
  email: string;
  provider: string;
  lastAccessed: string;
  status: string;
  errorMessage: string | null;
}

export interface InboxBlocklistItem {
  id: string;
  tenantId: string;
  type: InboxBlocklistType;
  value: string;
  createdAt: string;
}

export interface InboxStats {
  newItems: number;
  pendingItems: number;
  analyzingItems: number;
  suggestedMatches: number;
  doneItems: number;
  totalItems: number;
}

export interface GetInboxParams {
  cursor?: string | null;
  order?: "asc" | "desc" | null;
  sort?: "alphabetical" | "date" | null;
  pageSize?: number;
  q?: string | null;
  status?: InboxStatus | null;
}

export interface GetInboxResponse {
  meta: {
    cursor?: string;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
  data: InboxItem[];
}

// ==============================================
// INBOX API
// ==============================================

export const inboxApi = {
  /**
   * Get paginated list of inbox items
   */
  async getAll(params: GetInboxParams = {}): Promise<GetInboxResponse> {
    const searchParams = new URLSearchParams();
    if (params.cursor) searchParams.set("cursor", params.cursor);
    if (params.order) searchParams.set("order", params.order);
    if (params.sort) searchParams.set("sort", params.sort);
    if (params.pageSize) searchParams.set("pageSize", params.pageSize.toString());
    if (params.q) searchParams.set("q", params.q);
    if (params.status) searchParams.set("status", params.status);

    const query = searchParams.toString();
    const url = query ? `/inbox?${query}` : "/inbox";

    const response = await apiClient.get<GetInboxResponse>(url);
    if (!response.success) {
      throw new Error(response.error?.message || "Failed to fetch inbox");
    }
    return response.data as GetInboxResponse;
  },

  /**
   * Get inbox statistics
   */
  async getStats(): Promise<InboxStats> {
    const response = await apiClient.get<InboxStats>("/inbox/stats");
    if (!response.success) {
      throw new Error(response.error?.message || "Failed to fetch inbox stats");
    }
    return response.data as InboxStats;
  },

  /**
   * Get inbox item by ID
   */
  async getById(id: string): Promise<InboxItem> {
    const response = await apiClient.get<InboxItem>(`/inbox/${id}`);
    if (!response.success) {
      throw new Error(response.error?.message || "Failed to fetch inbox item");
    }
    return response.data as InboxItem;
  },

  /**
   * Create inbox item (manual upload)
   */
  async create(data: {
    displayName: string;
    filePath: string[];
    fileName: string;
    contentType: string;
    size: number;
    referenceId?: string;
    website?: string;
    senderEmail?: string;
  }): Promise<InboxItem> {
    const response = await apiClient.post<InboxItem>("/inbox", data);
    if (!response.success) {
      throw new Error(response.error?.message || "Failed to create inbox item");
    }
    return response.data as InboxItem;
  },

  /**
   * Update inbox item
   */
  async update(
    id: string,
    data: {
      status?: InboxStatus;
      displayName?: string;
      amount?: number;
      currency?: string;
      date?: string;
      type?: InboxType | null;
    }
  ): Promise<InboxItem> {
    const response = await apiClient.patch<InboxItem>(`/inbox/${id}`, data);
    if (!response.success) {
      throw new Error(response.error?.message || "Failed to update inbox item");
    }
    return response.data as InboxItem;
  },

  /**
   * Delete inbox item
   */
  async delete(id: string): Promise<void> {
    const response = await apiClient.delete(`/inbox/${id}`);
    if (!response.success) {
      throw new Error(response.error?.message || "Failed to delete inbox item");
    }
  },

  /**
   * Delete multiple inbox items
   */
  async deleteMany(ids: string[]): Promise<void> {
    const response = await apiClient.post(`/inbox/delete-many`, { ids });
    if (!response.success) {
      throw new Error(response.error?.message || "Failed to delete inbox items");
    }
  },

  /**
   * Confirm a match suggestion
   */
  async confirmMatch(
    inboxId: string,
    transactionId: string,
    suggestionId: string
  ): Promise<InboxItem> {
    const response = await apiClient.post<InboxItem>(`/inbox/${inboxId}/match/${transactionId}`, {
      suggestionId,
    });
    if (!response.success) {
      throw new Error(response.error?.message || "Failed to confirm match");
    }
    return response.data as InboxItem;
  },

  /**
   * Decline a match suggestion
   */
  async declineMatch(inboxId: string, suggestionId: string): Promise<void> {
    const response = await apiClient.post(`/inbox/${inboxId}/decline`, {
      suggestionId,
    });
    if (!response.success) {
      throw new Error(response.error?.message || "Failed to decline match");
    }
  },

  /**
   * Manually trigger AI processing (OCR extraction)
   */
  async process(
    id: string,
    options: { generateEmbeddings?: boolean } = {}
  ): Promise<{
    message: string;
    ocrResult: {
      confidence: number;
      provider: string;
      extractedData: Record<string, unknown>;
    } | null;
    embeddingCreated: boolean;
  }> {
    const response = await apiClient.post<{
      message: string;
      ocrResult: {
        confidence: number;
        provider: string;
        extractedData: Record<string, unknown>;
      } | null;
      embeddingCreated: boolean;
    }>(`/inbox/${id}/process`, options);
    if (!response.success) {
      throw new Error(response.error?.message || "Failed to process inbox item");
    }
    return response.data as {
      message: string;
      ocrResult: {
        confidence: number;
        provider: string;
        extractedData: Record<string, unknown>;
      } | null;
      embeddingCreated: boolean;
    };
  },

  /**
   * Retry matching for an inbox item (without reprocessing the file)
   */
  async retryMatching(id: string): Promise<{
    matches: number;
    autoMatched: boolean;
    matchResult?: Record<string, unknown> | null;
  }> {
    const response = await apiClient.post<{
      matches: number;
      autoMatched: boolean;
      matchResult?: Record<string, unknown> | null;
    }>(`/matching/inbox/${id}`);
    if (!response.success) {
      throw new Error(response.error?.message || "Failed to retry matching");
    }
    return response.data as {
      matches: number;
      autoMatched: boolean;
      matchResult?: Record<string, unknown> | null;
    };
  },

  // ==============================================
  // INBOX ACCOUNTS
  // ==============================================

  /**
   * Get connected email accounts
   */
  async getAccounts(): Promise<InboxAccount[]> {
    const response = await apiClient.get<InboxAccount[]>("/inbox/accounts");
    if (!response.success) {
      throw new Error(response.error?.message || "Failed to fetch accounts");
    }
    return response.data as InboxAccount[];
  },

  /**
   * Connect email account
   */
  async connectAccount(data: {
    provider: string;
    accessToken: string;
    refreshToken: string;
    email: string;
    externalId: string;
    expiryDate: string;
  }): Promise<InboxAccount> {
    const response = await apiClient.post<InboxAccount>("/inbox/accounts", data);
    if (!response.success) {
      throw new Error(response.error?.message || "Failed to connect account");
    }
    return response.data as InboxAccount;
  },

  /**
   * Disconnect email account
   */
  async disconnectAccount(id: string): Promise<void> {
    const response = await apiClient.delete(`/inbox/accounts/${id}`);
    if (!response.success) {
      throw new Error(response.error?.message || "Failed to disconnect account");
    }
  },

  // ==============================================
  // BLOCKLIST
  // ==============================================

  /**
   * Get blocklist
   */
  async getBlocklist(): Promise<InboxBlocklistItem[]> {
    const response = await apiClient.get<InboxBlocklistItem[]>("/inbox/blocklist");
    if (!response.success) {
      throw new Error(response.error?.message || "Failed to fetch blocklist");
    }
    return response.data as InboxBlocklistItem[];
  },

  /**
   * Add to blocklist
   */
  async addToBlocklist(type: InboxBlocklistType, value: string): Promise<InboxBlocklistItem> {
    const response = await apiClient.post<InboxBlocklistItem>("/inbox/blocklist", {
      type,
      value,
    });
    if (!response.success) {
      throw new Error(response.error?.message || "Failed to add to blocklist");
    }
    return response.data as InboxBlocklistItem;
  },

  /**
   * Remove from blocklist
   */
  async removeFromBlocklist(id: string): Promise<void> {
    const response = await apiClient.delete(`/inbox/blocklist/${id}`);
    if (!response.success) {
      throw new Error(response.error?.message || "Failed to remove from blocklist");
    }
  },
};
