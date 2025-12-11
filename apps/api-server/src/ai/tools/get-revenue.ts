/**
 * Revenue AI Tool
 * Analyze revenue streams, growth, and sources
 */

import { tool } from "ai";
import { z } from "zod";
import { sql } from "../../db/client";

const getRevenueSchema = z.object({
  tenantId: z.string().describe("The tenant ID to analyze"),
  months: z.number().min(1).max(24).default(12).describe("Number of months to analyze"),
  groupBy: z
    .enum(["month", "client", "category"])
    .default("month")
    .describe("How to group revenue data"),
});

type GetRevenueParams = z.infer<typeof getRevenueSchema>;

export const getRevenueTool = tool({
  description:
    "Analyze revenue streams, growth rates, top clients, and revenue trends. Use this to understand income sources and patterns.",
  parameters: getRevenueSchema,
  execute: async (params: GetRevenueParams): Promise<string> => {
    const { tenantId, months, groupBy } = params;

    try {
      // Get total revenue by month
      const monthlyRevenue = await sql`
        SELECT
          TO_CHAR(DATE_TRUNC('month', p.date), 'YYYY-MM') as month,
          SUM(ABS(p.amount_in_base_currency)) as revenue,
          COUNT(*) as transaction_count,
          AVG(ABS(p.amount_in_base_currency)) as avg_transaction
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE i.tenant_id = ${tenantId}
          AND p.is_expense = false
          AND p.date >= NOW() - INTERVAL '${months} months'
          AND p.status = 'completed'
        GROUP BY DATE_TRUNC('month', p.date)
        ORDER BY month DESC
      `;

      // Get revenue by client (from invoices)
      const revenueByClient = await sql`
        SELECT
          COALESCE(cl.name, 'Unknown Client') as client_name,
          SUM(ABS(p.amount_in_base_currency)) as revenue,
          COUNT(*) as invoice_count
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        LEFT JOIN clients cl ON i.client_id = cl.id
        WHERE i.tenant_id = ${tenantId}
          AND p.is_expense = false
          AND p.date >= NOW() - INTERVAL '${months} months'
          AND p.status = 'completed'
        GROUP BY cl.name
        ORDER BY revenue DESC
        LIMIT 10
      `;

      // Get revenue by category
      const revenueByCategory = await sql`
        SELECT
          COALESCE(p.category, 'Uncategorized') as category,
          SUM(ABS(p.amount_in_base_currency)) as revenue,
          COUNT(*) as transaction_count
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE i.tenant_id = ${tenantId}
          AND p.is_expense = false
          AND p.date >= NOW() - INTERVAL '${months} months'
          AND p.status = 'completed'
        GROUP BY p.category
        ORDER BY revenue DESC
      `;

      // Calculate key metrics
      const revenueData = monthlyRevenue.map((r) => ({
        month: r.month as string,
        revenue: Number(r.revenue) || 0,
        count: Number(r.transaction_count) || 0,
        avgTx: Number(r.avg_transaction) || 0,
      }));

      const totalRevenue = revenueData.reduce((sum, m) => sum + m.revenue, 0);
      const avgMonthlyRevenue = revenueData.length > 0 ? totalRevenue / revenueData.length : 0;
      const totalTransactions = revenueData.reduce((sum, m) => sum + m.count, 0);

      // Calculate MoM growth
      let momGrowth = 0;
      if (revenueData.length >= 2) {
        const currentMonth = revenueData[0]?.revenue || 0;
        const lastMonth = revenueData[1]?.revenue || 0;
        momGrowth = lastMonth > 0 ? ((currentMonth - lastMonth) / lastMonth) * 100 : 0;
      }

      // Calculate YoY growth if we have enough data
      let yoyGrowth = 0;
      if (revenueData.length >= 12) {
        const currentYearRevenue = revenueData.slice(0, 12).reduce((sum, m) => sum + m.revenue, 0);
        const lastYearRevenue = revenueData.slice(12, 24).reduce((sum, m) => sum + m.revenue, 0);
        yoyGrowth =
          lastYearRevenue > 0
            ? ((currentYearRevenue - lastYearRevenue) / lastYearRevenue) * 100
            : 0;
      }

      // Best and worst months
      const sortedByRevenue = [...revenueData].sort((a, b) => b.revenue - a.revenue);
      const bestMonth = sortedByRevenue[0];
      const worstMonth = sortedByRevenue[sortedByRevenue.length - 1];

      // Calculate revenue concentration (top 3 clients % of total)
      const topClientsRevenue = revenueByClient
        .slice(0, 3)
        .reduce((sum, c) => sum + (Number(c.revenue) || 0), 0);
      const revenueConcentration = totalRevenue > 0 ? (topClientsRevenue / totalRevenue) * 100 : 0;

      // Format response
      let response = `## 💰 Revenue Analysis\n\n`;
      response += `**Period:** Last ${months} months\n\n`;

      // Key metrics
      response += `### Key Metrics\n`;
      response += `| Metric | Value |\n`;
      response += `|--------|-------|\n`;
      response += `| 💵 Total Revenue | ${formatCurrency(totalRevenue)} |\n`;
      response += `| 📊 Average Monthly | ${formatCurrency(avgMonthlyRevenue)} |\n`;
      response += `| 📝 Total Transactions | ${totalTransactions.toLocaleString()} |\n`;
      response += `| 💳 Avg Transaction | ${formatCurrency(totalTransactions > 0 ? totalRevenue / totalTransactions : 0)} |\n`;
      response += `| ${momGrowth >= 0 ? "📈" : "📉"} MoM Growth | ${momGrowth.toFixed(1)}% |\n`;

      if (revenueData.length >= 12) {
        response += `| ${yoyGrowth >= 0 ? "📈" : "📉"} YoY Growth | ${yoyGrowth.toFixed(1)}% |\n`;
      }
      response += `\n`;

      // Monthly breakdown (primary view)
      if (groupBy === "month" || !groupBy) {
        response += `### Monthly Revenue\n`;
        response += `| Month | Revenue | Txns | Avg Txn | Trend |\n`;
        response += `|-------|---------|------|---------|-------|\n`;

        for (let i = 0; i < Math.min(revenueData.length, 12); i++) {
          const month = revenueData[i];
          const prevMonth = revenueData[i + 1];
          let trend = "-";
          if (prevMonth) {
            const change =
              prevMonth.revenue > 0
                ? ((month.revenue - prevMonth.revenue) / prevMonth.revenue) * 100
                : 0;
            trend = `${change >= 0 ? "📈" : "📉"} ${change.toFixed(0)}%`;
          }
          response += `| ${month.month} | ${formatCurrency(month.revenue)} | ${month.count} | ${formatCurrency(month.avgTx)} | ${trend} |\n`;
        }
        response += `\n`;
      }

      // Top clients
      if (groupBy === "client" || revenueByClient.length > 0) {
        response += `### 🏢 Top Clients\n`;
        response += `| Client | Revenue | Share | Invoices |\n`;
        response += `|--------|---------|-------|----------|\n`;

        for (const client of revenueByClient.slice(0, 10)) {
          const share =
            totalRevenue > 0 ? ((Number(client.revenue) / totalRevenue) * 100).toFixed(1) : "0";
          response += `| ${truncate(String(client.client_name), 25)} | ${formatCurrency(Number(client.revenue))} | ${share}% | ${client.invoice_count} |\n`;
        }
        response += `\n`;
      }

      // Revenue by category
      if (groupBy === "category" || revenueByCategory.length > 0) {
        response += `### 📂 Revenue by Category\n`;
        response += `| Category | Revenue | Share | Txns |\n`;
        response += `|----------|---------|-------|------|\n`;

        for (const cat of revenueByCategory.slice(0, 8)) {
          const share =
            totalRevenue > 0 ? ((Number(cat.revenue) / totalRevenue) * 100).toFixed(1) : "0";
          response += `| ${truncate(String(cat.category), 20)} | ${formatCurrency(Number(cat.revenue))} | ${share}% | ${cat.transaction_count} |\n`;
        }
        response += `\n`;
      }

      // Insights
      response += `### 💡 Insights\n`;

      // Best/worst performance
      if (bestMonth && worstMonth) {
        response += `- **Best month:** ${bestMonth.month} (${formatCurrency(bestMonth.revenue)})\n`;
        response += `- **Lowest month:** ${worstMonth.month} (${formatCurrency(worstMonth.revenue)})\n`;
      }

      // Revenue concentration warning
      if (revenueConcentration > 50) {
        response += `- ⚠️ **High concentration risk:** Top 3 clients represent ${revenueConcentration.toFixed(0)}% of revenue\n`;
      } else {
        response += `- ✅ **Diversified revenue:** Top 3 clients represent ${revenueConcentration.toFixed(0)}% of revenue\n`;
      }

      // Growth status
      if (momGrowth > 10) {
        response += `- 🚀 Strong growth momentum (${momGrowth.toFixed(0)}% MoM)\n`;
      } else if (momGrowth < -10) {
        response += `- ⚠️ Revenue declining (${momGrowth.toFixed(0)}% MoM) - investigate causes\n`;
      } else {
        response += `- 📊 Stable revenue pattern\n`;
      }

      // Seasonality check
      if (revenueData.length >= 6) {
        const variance = calculateVariance(revenueData.map((m) => m.revenue));
        const cv = avgMonthlyRevenue > 0 ? (Math.sqrt(variance) / avgMonthlyRevenue) * 100 : 0;
        if (cv > 30) {
          response += `- 📅 High revenue variability (${cv.toFixed(0)}% coefficient of variation) - consider seasonality\n`;
        }
      }

      return response;
    } catch (error) {
      console.error("Error analyzing revenue:", error);
      return `❌ Error analyzing revenue: ${error instanceof Error ? error.message : "Unknown error"}`;
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

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? `${str.slice(0, maxLen - 1)}…` : str;
}

function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length;
}
