"use client";

import { useMemo, useCallback, useEffect } from "react";
import { useApi, useMutation } from "@/hooks/use-api";
import { quotesApi } from "@/lib/api";
import type { QuoteFormValues } from "@/types/quote";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";

// Hook for fetching quotes list
export function useQuotes(params?: {
  status?: string;
  customerId?: string;
  page?: number;
  limit?: number;
  companyId?: string;
}) {
  const { user } = useAuth();
  const lsCompany =
    typeof window !== "undefined"
      ? window.localStorage?.getItem("selectedCompanyId") || undefined
      : undefined;
  const effectiveCompanyId = params?.companyId ?? user?.companyId ?? lsCompany;

  const result = useApi(
    () => quotesApi.getAll({ ...(params || {}), companyId: effectiveCompanyId }),
    { autoFetch: true },
  );

  useEffect(() => {
    result.refetch();
  }, [effectiveCompanyId]);

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
  const createMutation = useMutation((data: any) => quotesApi.create(data));
  const updateMutation = useMutation(({ id, data }: { id: string; data: any }) =>
    quotesApi.update(id, data)
  );
  const deleteMutation = useMutation((id: string) => quotesApi.delete(id));
  const markAsAcceptedMutation = useMutation((id: string) =>
    quotesApi.update(id, { status: "accepted" } as any)
  );
  const sendQuoteMutation = useMutation((id: string) =>
    quotesApi.update(id, { status: "sent" } as any)
  );

  return {
    create: createMutation,
    update: updateMutation,
    delete: deleteMutation,
    markAsAccepted: markAsAcceptedMutation,
    send: sendQuoteMutation,
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

    const quotes = Array.isArray(data) ? data : [];
    return {
      total: quotes.length,
      draft: quotes.filter((q: any) => q.status === "draft").length,
      sent: quotes.filter((q: any) => q.status === "sent").length,
      accepted: quotes.filter((q: any) => q.status === "accepted").length,
      rejected: quotes.filter((q: any) => q.status === "rejected").length,
      expired: quotes.filter((q: any) => q.status === "expired").length,
      totalAmount: quotes.reduce((sum: number, q: any) => sum + (q.total || 0), 0),
      acceptedAmount: quotes
        .filter((q: any) => q.status === "accepted")
        .reduce((sum: number, q: any) => sum + (q.total || 0), 0),
      pendingAmount: quotes
        .filter((q: any) => q.status !== "accepted" && q.status !== "rejected" && q.status !== "expired")
        .reduce((sum: number, q: any) => sum + (q.total || 0), 0),
    };
  }, [data]);

  return { stats, isLoading };
}
