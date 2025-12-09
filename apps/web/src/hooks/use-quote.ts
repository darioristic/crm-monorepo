"use client";

import type { CreateQuoteRequest, Quote, UpdateQuoteRequest } from "@crm/types";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useApi, useMutation } from "@/hooks/use-api";
import { quotesApi } from "@/lib/api";

// Hook for fetching quotes list
export function useQuotes(params?: {
  status?: string;
  customerId?: string;
  page?: number;
  limit?: number;
  companyId?: string;
}) {
  const result = useApi(() => quotesApi.getAll({ ...(params || {}) }), {
    autoFetch: true,
  });
  return result;
}

// Hook for fetching single quote
export function useQuote(id: string | undefined) {
  return useApi(
    () => (id ? quotesApi.getById(id) : Promise.resolve({ success: true, data: null })),
    { autoFetch: !!id }
  );
}

// Hook for quote mutations
export function useQuoteMutations() {
  const createMutation = useMutation((data: CreateQuoteRequest) => quotesApi.create(data));
  const updateMutation = useMutation(({ id, data }: { id: string; data: UpdateQuoteRequest }) =>
    quotesApi.update(id, data)
  );
  const deleteMutation = useMutation((id: string) => quotesApi.delete(id));
  const markAsAcceptedMutation = useMutation((id: string) =>
    quotesApi.update(id, { status: "accepted" })
  );
  const sendQuoteMutation = useMutation((id: string) => quotesApi.update(id, { status: "sent" }));

  return {
    create: createMutation,
    update: updateMutation,
    delete: deleteMutation,
    markAsAccepted: markAsAcceptedMutation,
    send: sendQuoteMutation,
  };
}

// Hook for quote workflows (convert to order/invoice)
export function useQuoteWorkflows() {
  const convertToOrder = useMutation(
    ({ id, customizations }: { id: string; customizations?: Record<string, unknown> }) =>
      quotesApi.convertToOrder(id, customizations as any)
  );

  const convertToInvoice = useMutation(
    ({ id, customizations }: { id: string; customizations?: Record<string, unknown> }) =>
      quotesApi.convertToInvoice(id, customizations as any)
  );

  return {
    convertToOrder,
    convertToInvoice,
  };
}

// Hook for quote download
export function useQuoteDownload() {
  const download = useCallback(async (quoteId: string, token?: string) => {
    try {
      const url = token
        ? `/api/download/quote?token=${token}`
        : `/api/download/quote?id=${quoteId}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `quote-${quoteId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      toast.success("Quote downloaded");
    } catch {
      toast.error("Failed to download quote");
    }
  }, []);

  return { download };
}

// Hook for quote statistics
export function useQuoteStats() {
  const { data, isLoading } = useQuotes();

  const stats = useMemo(() => {
    if (!data) {
      return {
        total: 0,
        draft: 0,
        sent: 0,
        accepted: 0,
        rejected: 0,
        expired: 0,
        totalAmount: 0,
        acceptedAmount: 0,
        pendingAmount: 0,
      };
    }

    const quotes = (Array.isArray(data) ? data : []) as Quote[];
    return {
      total: quotes.length,
      draft: quotes.filter((q) => q.status === "draft").length,
      sent: quotes.filter((q) => q.status === "sent").length,
      accepted: quotes.filter((q) => q.status === "accepted").length,
      rejected: quotes.filter((q) => q.status === "rejected").length,
      expired: quotes.filter((q) => q.status === "expired").length,
      totalAmount: quotes.reduce((sum, q) => sum + (q.total || 0), 0),
      acceptedAmount: quotes
        .filter((q) => q.status === "accepted")
        .reduce((sum, q) => sum + (q.total || 0), 0),
      pendingAmount: quotes
        .filter((q) => q.status !== "accepted" && q.status !== "rejected" && q.status !== "expired")
        .reduce((sum, q) => sum + (q.total || 0), 0),
    };
  }, [data]);

  return { stats, isLoading };
}
