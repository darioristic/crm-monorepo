"use client";

import { useEffect, useState } from "react";
import { invoicesApi } from "@/lib/api";
import { InvoicePaymentScore, InvoicePaymentScoreSkeleton } from "./invoice-payment-score";
import {
  InvoiceSummaryCard,
  InvoiceSummaryCardSkeleton,
  type InvoiceSummaryData,
} from "./invoice-summary-card";

interface InvoiceSummaryProps {
  onFilterChange?: (statuses: string[]) => void;
  companyId?: string;
  currency?: string;
}

export function InvoiceSummary({
  onFilterChange,
  companyId,
  currency = "EUR",
}: InvoiceSummaryProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [summaryData, setSummaryData] = useState<{
    open: InvoiceSummaryData;
    overdue: InvoiceSummaryData;
    paid: InvoiceSummaryData;
    paymentScore: number;
  } | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      setIsLoading(true);
      try {
        // Fetch all invoices and calculate summaries
        // Don't pass companyId if undefined - let API return all invoices for current tenant
        const params = companyId ? { pageSize: 1000, companyId } : { pageSize: 1000 };
        const result = await invoicesApi.getAll(params);
        const invoices = result.data || [];

        // Calculate summaries by status
        const open = { totalAmount: 0, invoiceCount: 0, currency };
        const overdue = { totalAmount: 0, invoiceCount: 0, currency };
        const paid = { totalAmount: 0, invoiceCount: 0, currency };

        const now = new Date();
        let paidCount = 0;
        let totalWithDueDate = 0;

        for (const invoice of invoices) {
          const amount = invoice.total || 0;
          const status = invoice.status?.toLowerCase() || "";
          const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;

          if (status === "paid") {
            paid.totalAmount += amount;
            paid.invoiceCount++;
            paidCount++;
            totalWithDueDate++;
          } else if (status === "canceled" || status === "cancelled") {
            // Skip canceled invoices
          } else if (dueDate && dueDate < now && status !== "draft") {
            overdue.totalAmount += amount;
            overdue.invoiceCount++;
            totalWithDueDate++;
          } else {
            open.totalAmount += amount;
            open.invoiceCount++;
            if (dueDate) totalWithDueDate++;
          }
        }

        // Calculate payment score (percentage of paid invoices)
        const paymentScore =
          totalWithDueDate > 0 ? Math.round((paidCount / totalWithDueDate) * 100) : 0;

        setSummaryData({ open, overdue, paid, paymentScore });
      } catch (error) {
        console.error("Failed to fetch invoice summary:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummary();
  }, [companyId, currency]);

  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <InvoiceSummaryCardSkeleton />
        <InvoiceSummaryCardSkeleton />
        <InvoiceSummaryCardSkeleton />
        <InvoicePaymentScoreSkeleton />
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
      <InvoiceSummaryCard
        data={summaryData?.open}
        title="Open"
        onClick={onFilterChange ? () => onFilterChange(["draft", "sent", "unpaid"]) : undefined}
      />
      <InvoiceSummaryCard
        data={summaryData?.overdue}
        title="Overdue"
        onClick={onFilterChange ? () => onFilterChange(["overdue"]) : undefined}
      />
      <InvoiceSummaryCard
        data={summaryData?.paid}
        title="Paid"
        onClick={onFilterChange ? () => onFilterChange(["paid"]) : undefined}
      />
      <InvoicePaymentScore
        score={summaryData?.paymentScore ?? 0}
        paidInvoices={summaryData?.paid.invoiceCount ?? 0}
        totalInvoices={
          (summaryData?.open.invoiceCount ?? 0) +
          (summaryData?.overdue.invoiceCount ?? 0) +
          (summaryData?.paid.invoiceCount ?? 0)
        }
      />
    </div>
  );
}
