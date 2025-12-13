import { tool } from "ai";
import { z } from "zod";
import { invoiceQueries } from "../../db/queries/invoices";

const getInvoicesSchema = z.object({
  pageSize: z.number().min(1).max(50).optional().describe("Number of invoices to return"),
  status: z
    .enum(["draft", "sent", "paid", "overdue", "cancelled", "partial"])
    .optional()
    .describe("Filter by invoice status"),
  search: z.string().optional().describe("Search by invoice number"),
});

type GetInvoicesParams = z.infer<typeof getInvoicesSchema>;

export const getInvoicesTool = tool({
  description: "Retrieve and filter invoices with pagination and status filtering",
  inputSchema: getInvoicesSchema,
  execute: async (input: GetInvoicesParams): Promise<string> => {
    const { pageSize = 10, status, search } = input;
    try {
      const result = await invoiceQueries.findAll(null, { page: 1, pageSize }, { status, search });

      if (result.data.length === 0) {
        return "No invoices found matching your criteria.";
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

      return `| Invoice # | Status | Amount | Due Date | Created |
|-----------|--------|--------|----------|---------|
${tableRows}

**Summary**: ${result.total} total invoices | Total: ${formatCurrency(totalAmount, currency)} | Paid: ${paidCount} | Pending: ${pendingCount} | Overdue: ${overdueCount}`;
    } catch (error) {
      return `Failed to retrieve invoices: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});

const emptySchema = z.object({});

export const getOverdueInvoicesTool = tool({
  description: "Get all overdue invoices that need attention",
  inputSchema: emptySchema,
  execute: async (): Promise<string> => {
    try {
      const overdueInvoices = await invoiceQueries.getOverdue(null);

      if (overdueInvoices.length === 0) {
        return "Great news! No overdue invoices found.";
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

      const totalOverdue = overdueInvoices.reduce(
        (sum, inv) => sum + (inv.total - inv.paidAmount),
        0
      );
      const currency = overdueInvoices[0]?.currency || "EUR";

      const tableRows = overdueInvoices
        .map((inv) => {
          const remaining = inv.total - inv.paidAmount;
          const daysOverdue = getDaysOverdue(inv.dueDate);
          return `| ${inv.invoiceNumber} | ${formatCurrency(remaining, inv.currency || "EUR")} | ${formatDate(inv.dueDate)} | ${daysOverdue} days |`;
        })
        .join("\n");

      return `⚠️ **Overdue Invoices**

| Invoice # | Outstanding | Due Date | Days Overdue |
|-----------|-------------|----------|--------------|
${tableRows}

**Total Outstanding**: ${formatCurrency(totalOverdue, currency)} across ${overdueInvoices.length} invoices`;
    } catch (error) {
      return `Failed to retrieve overdue invoices: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});
