"use client";

import type { Invoice } from "@crm/types";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useApi, useMutation } from "@/hooks/use-api";
import { invoicesApi } from "@/lib/api";
import { useInvoiceSettingsStore, useInvoiceSheetStore } from "@/store/invoice-store";
import type { InvoiceFormValues } from "@/types/invoice";

// Hook for fetching invoices list
export function useInvoices(params?: {
  status?: string;
  customerId?: string;
  page?: number;
  limit?: number;
}) {
  return useApi(() => invoicesApi.getAll(params), { autoFetch: true });
}

// Hook for fetching single invoice
export function useInvoice(id: string | undefined) {
  return useApi(
    () => (id ? invoicesApi.getById(id) : Promise.resolve({ success: true, data: null })),
    { autoFetch: !!id }
  );
}

// Hook for invoice mutations
export function useInvoiceMutations() {
  const createMutation = useMutation((data: InvoiceFormValues) => invoicesApi.create(data));
  const updateMutation = useMutation(
    ({ id, data }: { id: string; data: Partial<InvoiceFormValues> }) => invoicesApi.update(id, data)
  );
  const deleteMutation = useMutation((id: string) => invoicesApi.delete(id));
  const markAsPaidMutation = useMutation((id: string) =>
    invoicesApi.update(id, { status: "paid" })
  );
  const sendInvoiceMutation = useMutation((id: string) =>
    invoicesApi.update(id, { status: "sent" })
  );

  return {
    create: createMutation,
    update: updateMutation,
    delete: deleteMutation,
    markAsPaid: markAsPaidMutation,
    send: sendInvoiceMutation,
  };
}

// Hook for invoice sheet
export function useInvoiceSheet() {
  const { isOpen, type, invoiceId, open, close, setSuccess } = useInvoiceSheetStore();

  const openCreate = useCallback(() => open("create"), [open]);
  const openEdit = useCallback((id: string) => open("edit", id), [open]);

  return {
    isOpen,
    type,
    invoiceId,
    openCreate,
    openEdit,
    close,
    setSuccess,
  };
}

// Hook for invoice settings
export function useInvoiceSettings() {
  const {
    defaultSettings,
    recentCustomers,
    setDefaultSettings,
    setTemplate,
    addRecentCustomer,
    reset,
  } = useInvoiceSettingsStore();

  return {
    defaultSettings,
    recentCustomers,
    setDefaultSettings,
    setTemplate,
    addRecentCustomer,
    reset,
  };
}

// Hook for invoice download
export function useInvoiceDownload() {
  const download = useCallback(async (invoiceId: string, token?: string) => {
    try {
      const url = token
        ? `/api/download/invoice?token=${token}`
        : `/api/download/invoice?id=${invoiceId}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `invoice-${invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      toast.success("Invoice downloaded");
    } catch {
      toast.error("Failed to download invoice");
    }
  }, []);

  return { download };
}

// Hook for invoice statistics
export function useInvoiceStats() {
  const { data, isLoading } = useInvoices();

  const stats = useMemo(() => {
    if (!data) {
      return {
        total: 0,
        draft: 0,
        sent: 0,
        paid: 0,
        overdue: 0,
        totalAmount: 0,
        paidAmount: 0,
        pendingAmount: 0,
      };
    }

    const invoices = (Array.isArray(data) ? data : []) as Invoice[];
    return {
      total: invoices.length,
      draft: invoices.filter((i) => i.status === "draft").length,
      sent: invoices.filter((i) => i.status === "sent").length,
      paid: invoices.filter((i) => i.status === "paid").length,
      overdue: invoices.filter((i) => i.status === "overdue").length,
      totalAmount: invoices.reduce((sum, i) => sum + (i.total || 0), 0),
      paidAmount: invoices
        .filter((i) => i.status === "paid")
        .reduce((sum, i) => sum + (i.total || 0), 0),
      pendingAmount: invoices
        .filter((i) => i.status !== "paid" && i.status !== "cancelled")
        .reduce((sum, i) => sum + (i.total || 0), 0),
    };
  }, [data]);

  return { stats, isLoading };
}
