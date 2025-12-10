import { tool } from "ai";
import { z } from "zod";
import { sql as db } from "../../db/client";
import type { ToolResponse } from "../types";

const getQuotesSchema = z.object({
  pageSize: z.number().min(1).max(50).default(10).describe("Number of quotes to return"),
  status: z
    .enum(["draft", "sent", "accepted", "rejected", "expired"])
    .optional()
    .describe("Filter by quote status"),
  search: z.string().optional().describe("Search by quote number"),
});

type GetQuotesParams = z.infer<typeof getQuotesSchema>;

export const getQuotesTool = (tool as unknown as typeof tool)({
  name: "getQuotes",
  description: "Retrieve and filter sales quotes with pagination and status filtering",
  parameters: getQuotesSchema,
  execute: async (params: GetQuotesParams): Promise<ToolResponse> => {
    const { pageSize = 10, status, search } = params;
    try {
      let query = `
        SELECT q.*, c.name as company_name
        FROM quotes q
        LEFT JOIN companies c ON q.company_id = c.id
        WHERE 1=1
      `;
      const queryParams: (string | number)[] = [];

      if (status) {
        queryParams.push(status);
        query += ` AND q.status = $${queryParams.length}`;
      }

      if (search) {
        queryParams.push(`%${search}%`);
        query += ` AND q.quote_number ILIKE $${queryParams.length}`;
      }

      queryParams.push(pageSize);
      query += ` ORDER BY q.created_at DESC LIMIT $${queryParams.length}`;

      const result = await db.unsafe(query, queryParams as (string | number)[]);

      if (result.length === 0) {
        return { text: "No quotes found matching your criteria." };
      }

      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("sr-RS", {
          style: "currency",
          currency: "EUR",
        }).format(amount);
      };

      const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("sr-RS");
      };

      const tableRows = result
        .map((quote: Record<string, unknown>) => {
          const total = formatCurrency(parseFloat(quote.total as string) || 0);
          const validUntil = quote.valid_until ? formatDate(quote.valid_until as string) : "N/A";
          return `| ${quote.quote_number} | ${quote.company_name || "N/A"} | ${quote.status} | ${total} | ${validUntil} |`;
        })
        .join("\n");

      const totalValue = result.reduce(
        (sum: number, q: Record<string, unknown>) => sum + (parseFloat(q.total as string) || 0),
        0
      );

      const acceptedCount = result.filter(
        (q: Record<string, unknown>) => q.status === "accepted"
      ).length;
      const pendingCount = result.filter(
        (q: Record<string, unknown>) => q.status === "sent" || q.status === "draft"
      ).length;

      const response = `| Quote # | Customer | Status | Value | Valid Until |
|---------|----------|--------|-------|-------------|
${tableRows}

**Summary**: ${result.length} quotes | Total Value: ${formatCurrency(totalValue)} | Accepted: ${acceptedCount} | Pending: ${pendingCount}`;

      return {
        text: response,
        link: {
          text: "View all quotes",
          url: "/dashboard/sales/quotes",
        },
      };
    } catch (error) {
      return {
        text: `Failed to retrieve quotes: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});

const getQuoteConversionSchema = z.object({
  period: z
    .enum(["week", "month", "quarter", "year"])
    .default("month")
    .describe("Time period for analysis"),
});

type GetQuoteConversionParams = z.infer<typeof getQuoteConversionSchema>;

export const getQuoteConversionRateTool = (tool as unknown as typeof tool)({
  name: "getQuoteConversion",
  description: "Get quote to invoice conversion rate and statistics",
  parameters: getQuoteConversionSchema,
  execute: async (params: GetQuoteConversionParams): Promise<ToolResponse> => {
    const { period } = params;
    try {
      const periodDaysMap: Record<string, number> = {
        week: 7,
        month: 30,
        quarter: 90,
        year: 365,
      };
      const periodDays = periodDaysMap[period] || 30;

      const result = await db`
        SELECT 
          COUNT(*) as total_quotes,
          COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
          COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired,
          SUM(CASE WHEN status = 'accepted' THEN total ELSE 0 END) as accepted_value,
          SUM(total) as total_value
        FROM quotes
        WHERE created_at >= NOW() - INTERVAL '${periodDays} days'
      `;

      const stats = result[0];
      const totalQuotes = parseInt(stats.total_quotes as string, 10);
      const accepted = parseInt(stats.accepted as string, 10);
      const rejected = parseInt(stats.rejected as string, 10);
      const expired = parseInt(stats.expired as string, 10);
      const acceptedValue = parseFloat(stats.accepted_value as string) || 0;
      const totalValue = parseFloat(stats.total_value as string) || 0;

      const conversionRate = totalQuotes > 0 ? ((accepted / totalQuotes) * 100).toFixed(1) : "0";
      const valueConversionRate =
        totalValue > 0 ? ((acceptedValue / totalValue) * 100).toFixed(1) : "0";

      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("sr-RS", {
          style: "currency",
          currency: "EUR",
        }).format(amount);
      };

      const response = `**Quote Conversion Analysis (Last ${period})**

📊 **Conversion Rate**: ${conversionRate}%
💰 **Value Conversion**: ${valueConversionRate}%

| Metric | Count | Value |
|--------|-------|-------|
| Total Quotes | ${totalQuotes} | ${formatCurrency(totalValue)} |
| Accepted | ${accepted} | ${formatCurrency(acceptedValue)} |
| Rejected | ${rejected} | - |
| Expired | ${expired} | - |`;

      return {
        text: response,
        link: {
          text: "View quote analytics",
          url: "/dashboard/sales/quotes",
        },
      };
    } catch (error) {
      return {
        text: `Failed to calculate conversion rate: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});
