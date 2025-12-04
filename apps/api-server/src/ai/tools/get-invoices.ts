import { tool } from "ai";
import { z } from "zod";
import { invoiceQueries } from "../../db/queries/invoices";
import type { ToolResponse } from "../types";

const getInvoicesSchema = z.object({
  pageSize: z.number().min(1).max(50).default(10).describe("Number of invoices to return"),
  status: z
    .enum(["draft", "sent", "paid", "overdue", "cancelled", "partial"])
    .optional()
    .describe("Filter by invoice status"),
  search: z.string().optional().describe("Search by invoice number"),
});

type GetInvoicesParams = z.infer<typeof getInvoicesSchema>;

export const getInvoicesTool = tool({
  description: "Retrieve and filter invoices with pagination and status filtering",
  parameters: getInvoicesSchema,
  execute: (async (params: GetInvoicesParams): Promise<ToolResponse> => {
    const { pageSize = 10, status, search } = params;
    try {
      const result = await invoiceQueries.findAll(
        null,
        { page: 1, pageSize },
        { status, search }
      );

      if (result.data.length === 0) {
        return { text: "No invoices found matching your criteria." };
      }

      const formatCurrency = (amount: number, currency: string) => {
        return new Intl.NumberFormat("sr-RS", {
          style: "currency",
          currency: currency || "EUR",
        }).format(amount);
      };

      const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("sr-RS");
      };

      const formattedInvoices = result.data.map((invoice) => ({
        invoiceNumber: invoice.invoiceNumber || "Draft",
        status: invoice.status,
        amount: formatCurrency(invoice.total, invoice.currency || "EUR"),
        dueDate: formatDate(invoice.dueDate),
        createdAt: formatDate(invoice.createdAt),
      }));

      const totalAmount = result.data.reduce((sum, inv) => sum + inv.total, 0);
      const currency = result.data[0]?.currency || "EUR";

      const paidCount = result.data.filter((inv) => inv.status === "paid").length;
      const overdueCount = result.data.filter((inv) => inv.status === "overdue").length;
      const pendingCount = result.data.filter(
        (inv) => inv.status === "sent" || inv.status === "partial"
      ).length;

      const tableRows = formattedInvoices
        .map(
          (inv) =>
            `| ${inv.invoiceNumber} | ${inv.status} | ${inv.amount} | ${inv.dueDate} | ${inv.createdAt} |`
        )
        .join("\n");

      const response = `| Invoice # | Status | Amount | Due Date | Created |
|-----------|--------|--------|----------|---------|
${tableRows}

**Summary**: ${result.total} total invoices | Total: ${formatCurrency(totalAmount, currency)} | Paid: ${paidCount} | Pending: ${pendingCount} | Overdue: ${overdueCount}`;

      return {
        text: response,
        link: {
          text: "View all invoices",
          url: "/dashboard/sales/invoices",
        },
      };
    } catch (error) {
      return {
        text: `Failed to retrieve invoices: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }) as any,
} as any);

const emptySchema = z.object({});
type EmptyParams = z.infer<typeof emptySchema>;

export const getOverdueInvoicesTool = tool({
  description: "Get all overdue invoices that need attention",
  parameters: emptySchema,
  execute: (async (_params: EmptyParams): Promise<ToolResponse> => {
    try {
      const overdueInvoices = await invoiceQueries.getOverdue(null);

      if (overdueInvoices.length === 0) {
        return { text: "Great news! No overdue invoices found." };
      }

      const formatCurrency = (amount: number, currency: string) => {
        return new Intl.NumberFormat("sr-RS", {
          style: "currency",
          currency: currency || "EUR",
        }).format(amount);
      };

      const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("sr-RS");
      };

      const getDaysOverdue = (dueDate: string) => {
        const due = new Date(dueDate);
        const now = new Date();
        return Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      };

      const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + (inv.total - inv.paidAmount), 0);
      const currency = overdueInvoices[0]?.currency || "EUR";

      const tableRows = overdueInvoices
        .map((inv) => {
          const remaining = inv.total - inv.paidAmount;
          const daysOverdue = getDaysOverdue(inv.dueDate);
          return `| ${inv.invoiceNumber} | ${formatCurrency(remaining, inv.currency || "EUR")} | ${formatDate(inv.dueDate)} | ${daysOverdue} days |`;
        })
        .join("\n");

      const response = `⚠️ **Overdue Invoices**

| Invoice # | Outstanding | Due Date | Days Overdue |
|-----------|-------------|----------|--------------|
${tableRows}

**Total Outstanding**: ${formatCurrency(totalOverdue, currency)} across ${overdueInvoices.length} invoices`;

      return {
        text: response,
        link: {
          text: "View overdue invoices",
          url: "/dashboard/sales/invoices?status=overdue",
        },
      };
    } catch (error) {
      return {
        text: `Failed to retrieve overdue invoices: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }) as any,
} as any);
