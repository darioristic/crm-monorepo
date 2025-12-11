/**
 * Burn Rate AI Tool
 * Calculate monthly burn rate and spending trends
 */

import { tool } from "ai";
import { z } from "zod";
import { sql } from "../../db/client";

const getBurnRateSchema = z.object({
  tenantId: z.string().describe("The tenant ID to analyze"),
  months: z.number().min(1).max(24).default(6).describe("Number of months to analyze"),
  includeProjections: z.boolean().default(true).describe("Include future projections"),
});

type GetBurnRateParams = z.infer<typeof getBurnRateSchema>;

interface MonthlyBurn {
  month: string;
  totalExpenses: number;
  totalIncome: number;
  netBurn: number;
  expensesByCategory: Record<string, number>;
}

export const getBurnRateTool = tool({
  description:
    "Calculate monthly burn rate, spending trends, and runway projections. Use this to understand how fast money is being spent.",
  parameters: getBurnRateSchema,
  execute: async (params: GetBurnRateParams): Promise<string> => {
    const { tenantId, months, includeProjections } = params;

    try {
      // Get monthly expense and income data from payments
      const monthlyData = await sql`
        SELECT
          TO_CHAR(DATE_TRUNC('month', p.date), 'YYYY-MM') as month,
          SUM(CASE WHEN p.amount < 0 THEN ABS(p.amount) ELSE 0 END) as total_expenses,
          SUM(CASE WHEN p.amount > 0 THEN p.amount ELSE 0 END) as total_income,
          COALESCE(p.category_slug, 'other') as category
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE i.tenant_id = ${tenantId}
          AND p.date >= NOW() - MAKE_INTERVAL(months => ${months})
        GROUP BY DATE_TRUNC('month', p.date), p.category_slug
        ORDER BY month DESC
      `;

      // Aggregate by month
      const monthlyBurn: Map<string, MonthlyBurn> = new Map();

      for (const row of monthlyData) {
        const month = row.month as string;
        if (!monthlyBurn.has(month)) {
          monthlyBurn.set(month, {
            month,
            totalExpenses: 0,
            totalIncome: 0,
            netBurn: 0,
            expensesByCategory: {},
          });
        }

        const data = monthlyBurn.get(month)!;
        data.totalExpenses += Number(row.total_expenses) || 0;
        data.totalIncome += Number(row.total_income) || 0;
        data.netBurn = data.totalExpenses - data.totalIncome;

        if (row.category && Number(row.total_expenses) > 0) {
          data.expensesByCategory[row.category] =
            (data.expensesByCategory[row.category] || 0) + Number(row.total_expenses);
        }
      }

      const sortedMonths = Array.from(monthlyBurn.values()).sort((a, b) =>
        b.month.localeCompare(a.month)
      );

      // Calculate averages
      const avgBurn =
        sortedMonths.length > 0
          ? sortedMonths.reduce((sum, m) => sum + m.netBurn, 0) / sortedMonths.length
          : 0;

      const avgExpenses =
        sortedMonths.length > 0
          ? sortedMonths.reduce((sum, m) => sum + m.totalExpenses, 0) / sortedMonths.length
          : 0;

      const avgIncome =
        sortedMonths.length > 0
          ? sortedMonths.reduce((sum, m) => sum + m.totalIncome, 0) / sortedMonths.length
          : 0;

      // Calculate trend (positive means increasing burn)
      let trend = 0;
      if (sortedMonths.length >= 2) {
        const recentBurn =
          sortedMonths.slice(0, 3).reduce((sum, m) => sum + m.netBurn, 0) /
          Math.min(3, sortedMonths.length);
        const olderBurn =
          sortedMonths.slice(-3).reduce((sum, m) => sum + m.netBurn, 0) /
          Math.min(3, sortedMonths.length);
        trend = olderBurn !== 0 ? ((recentBurn - olderBurn) / Math.abs(olderBurn)) * 100 : 0;
      }

      // Get current cash position from payments
      const cashPosition = await sql`
        SELECT COALESCE(SUM(p.amount), 0) as balance
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE i.tenant_id = ${tenantId}
      `;

      const currentBalance = Number(cashPosition[0]?.balance) || 0;
      const runway = avgBurn > 0 ? Math.floor(currentBalance / avgBurn) : Infinity;

      // Format response
      let response = `## 📊 Burn Rate Analysis\n\n`;
      response += `**Period:** Last ${months} months\n\n`;

      response += `### Key Metrics\n`;
      response += `| Metric | Value |\n`;
      response += `|--------|-------|\n`;
      response += `| Average Monthly Burn | ${formatCurrency(avgBurn)} |\n`;
      response += `| Average Monthly Expenses | ${formatCurrency(avgExpenses)} |\n`;
      response += `| Average Monthly Income | ${formatCurrency(avgIncome)} |\n`;
      response += `| Burn Trend | ${trend > 0 ? "📈" : "📉"} ${trend.toFixed(1)}% |\n`;
      response += `| Current Balance | ${formatCurrency(currentBalance)} |\n`;

      if (includeProjections) {
        response += `| Runway | ${runway === Infinity ? "∞" : `${runway} months`} |\n`;
      }

      response += `\n### Monthly Breakdown\n`;
      response += `| Month | Expenses | Income | Net Burn |\n`;
      response += `|-------|----------|--------|----------|\n`;

      for (const month of sortedMonths.slice(0, 6)) {
        const burnIndicator = month.netBurn > 0 ? "🔴" : "🟢";
        response += `| ${month.month} | ${formatCurrency(month.totalExpenses)} | ${formatCurrency(month.totalIncome)} | ${burnIndicator} ${formatCurrency(month.netBurn)} |\n`;
      }

      // Top expense categories
      const allCategories: Record<string, number> = {};
      for (const month of sortedMonths) {
        for (const [cat, amount] of Object.entries(month.expensesByCategory)) {
          allCategories[cat] = (allCategories[cat] || 0) + amount;
        }
      }

      const topCategories = Object.entries(allCategories)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      if (topCategories.length > 0) {
        response += `\n### Top Expense Categories\n`;
        response += `| Category | Total | % of Expenses |\n`;
        response += `|----------|-------|---------------|\n`;

        const totalExpenses = Object.values(allCategories).reduce((sum, v) => sum + v, 0);
        for (const [category, amount] of topCategories) {
          const percentage = totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(1) : "0";
          response += `| ${category} | ${formatCurrency(amount)} | ${percentage}% |\n`;
        }
      }

      return response;
    } catch (error) {
      console.error("Error calculating burn rate:", error);
      return `❌ Error calculating burn rate: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
