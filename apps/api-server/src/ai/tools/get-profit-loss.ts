/**
 * Profit & Loss AI Tool
 * Generate P&L statements and profitability analysis
 */

import { tool } from "ai";
import { z } from "zod";
import { sql } from "../../db/client";

const getProfitLossSchema = z.object({
  tenantId: z.string().describe("The tenant ID to analyze"),
  period: z.enum(["month", "quarter", "year", "ytd"]).default("month").describe("Reporting period"),
  compareWithPrevious: z.boolean().default(true).describe("Compare with previous period"),
});

type GetProfitLossParams = z.infer<typeof getProfitLossSchema>;

export const getProfitLossTool = tool({
  description:
    "Generate profit and loss statement showing revenue, expenses, and net income. Use this for profitability analysis and financial reporting.",
  parameters: getProfitLossSchema,
  execute: async (params: GetProfitLossParams): Promise<string> => {
    const { tenantId, period, compareWithPrevious } = params;

    try {
      // Determine date ranges
      const now = new Date();
      let currentStart: Date;
      const currentEnd: Date = now;
      let previousStart: Date;
      let previousEnd: Date;
      let periodLabel: string;

      switch (period) {
        case "month":
          currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
          previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          previousEnd = new Date(now.getFullYear(), now.getMonth(), 0);
          periodLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
          break;
        case "quarter": {
          const currentQuarter = Math.floor(now.getMonth() / 3);
          currentStart = new Date(now.getFullYear(), currentQuarter * 3, 1);
          previousStart = new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1);
          previousEnd = new Date(now.getFullYear(), currentQuarter * 3, 0);
          periodLabel = `Q${currentQuarter + 1} ${now.getFullYear()}`;
          break;
        }
        case "year":
          currentStart = new Date(now.getFullYear(), 0, 1);
          previousStart = new Date(now.getFullYear() - 1, 0, 1);
          previousEnd = new Date(now.getFullYear() - 1, 11, 31);
          periodLabel = `${now.getFullYear()}`;
          break;
        default:
          currentStart = new Date(now.getFullYear(), 0, 1);
          previousStart = new Date(now.getFullYear() - 1, 0, 1);
          previousEnd = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          periodLabel = `YTD ${now.getFullYear()}`;
          break;
      }

      // Current period revenue by category
      const currentRevenue = await sql`
        SELECT
          COALESCE(p.category, 'Other Income') as category,
          SUM(ABS(p.amount_in_base_currency)) as amount
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE i.tenant_id = ${tenantId}
          AND p.is_expense = false
          AND p.date >= ${currentStart.toISOString()}
          AND p.date <= ${currentEnd.toISOString()}
          AND p.status = 'completed'
        GROUP BY p.category
        ORDER BY amount DESC
      `;

      // Current period expenses by category
      const currentExpenses = await sql`
        SELECT
          COALESCE(p.category, 'Other Expenses') as category,
          SUM(ABS(p.amount_in_base_currency)) as amount
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE i.tenant_id = ${tenantId}
          AND p.is_expense = true
          AND p.date >= ${currentStart.toISOString()}
          AND p.date <= ${currentEnd.toISOString()}
          AND p.status = 'completed'
        GROUP BY p.category
        ORDER BY amount DESC
      `;

      // Previous period data
      let previousRevenue: { category: string; amount: number }[] = [];
      let previousExpenses: { category: string; amount: number }[] = [];

      if (compareWithPrevious) {
        const prevRevResult = await sql`
          SELECT
            COALESCE(p.category, 'Other Income') as category,
            SUM(ABS(p.amount_in_base_currency)) as amount
          FROM payments p
          JOIN invoices i ON p.invoice_id = i.id
          WHERE i.tenant_id = ${tenantId}
            AND p.is_expense = false
            AND p.date >= ${previousStart.toISOString()}
            AND p.date <= ${previousEnd.toISOString()}
            AND p.status = 'completed'
          GROUP BY p.category
        `;
        previousRevenue = prevRevResult.map((r) => ({
          category: r.category as string,
          amount: Number(r.amount) || 0,
        }));

        const prevExpResult = await sql`
          SELECT
            COALESCE(p.category, 'Other Expenses') as category,
            SUM(ABS(p.amount_in_base_currency)) as amount
          FROM payments p
          JOIN invoices i ON p.invoice_id = i.id
          WHERE i.tenant_id = ${tenantId}
            AND p.is_expense = true
            AND p.date >= ${previousStart.toISOString()}
            AND p.date <= ${previousEnd.toISOString()}
            AND p.status = 'completed'
          GROUP BY p.category
        `;
        previousExpenses = prevExpResult.map((r) => ({
          category: r.category as string,
          amount: Number(r.amount) || 0,
        }));
      }

      // Calculate totals
      const totalRevenue = currentRevenue.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      const totalExpenses = currentExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const netIncome = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

      const prevTotalRevenue = previousRevenue.reduce((sum, r) => sum + r.amount, 0);
      const prevTotalExpenses = previousExpenses.reduce((sum, e) => sum + e.amount, 0);
      const prevNetIncome = prevTotalRevenue - prevTotalExpenses;

      // Calculate changes
      const revenueChange =
        prevTotalRevenue > 0 ? ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100 : 0;
      const expenseChange =
        prevTotalExpenses > 0 ? ((totalExpenses - prevTotalExpenses) / prevTotalExpenses) * 100 : 0;
      const incomeChange =
        prevNetIncome !== 0 ? ((netIncome - prevNetIncome) / Math.abs(prevNetIncome)) * 100 : 0;

      // Format response
      let response = `## 📊 Profit & Loss Statement\n\n`;
      response += `**Period:** ${periodLabel}\n\n`;

      // Summary box
      response += `### Summary\n`;
      response += `| Metric | Current | ${compareWithPrevious ? "Previous | Change |" : ""}\n`;
      response += `|--------|---------|${compareWithPrevious ? "---------|--------|" : ""}\n`;
      response += `| 💵 Total Revenue | ${formatCurrency(totalRevenue)} | ${compareWithPrevious ? `${formatCurrency(prevTotalRevenue)} | ${formatChange(revenueChange)} |` : ""}\n`;
      response += `| 💸 Total Expenses | ${formatCurrency(totalExpenses)} | ${compareWithPrevious ? `${formatCurrency(prevTotalExpenses)} | ${formatChange(expenseChange)} |` : ""}\n`;
      response += `| ${netIncome >= 0 ? "🟢" : "🔴"} **Net Income** | **${formatCurrency(netIncome)}** | ${compareWithPrevious ? `**${formatCurrency(prevNetIncome)}** | ${formatChange(incomeChange)} |` : ""}\n`;
      response += `| 📈 Profit Margin | ${profitMargin.toFixed(1)}% | ${compareWithPrevious ? `${(prevTotalRevenue > 0 ? (prevNetIncome / prevTotalRevenue) * 100 : 0).toFixed(1)}% | - |` : ""}\n\n`;

      // Revenue breakdown
      response += `### 📥 Revenue\n`;
      response += `| Category | Amount | % of Total |\n`;
      response += `|----------|--------|------------|\n`;

      for (const rev of currentRevenue.slice(0, 8)) {
        const pct = totalRevenue > 0 ? ((Number(rev.amount) / totalRevenue) * 100).toFixed(1) : "0";
        response += `| ${truncate(String(rev.category), 25)} | ${formatCurrency(Number(rev.amount))} | ${pct}% |\n`;
      }
      response += `| **Total Revenue** | **${formatCurrency(totalRevenue)}** | **100%** |\n\n`;

      // Expense breakdown
      response += `### 📤 Expenses\n`;
      response += `| Category | Amount | % of Revenue |\n`;
      response += `|----------|--------|-------------|\n`;

      for (const exp of currentExpenses.slice(0, 10)) {
        const pct = totalRevenue > 0 ? ((Number(exp.amount) / totalRevenue) * 100).toFixed(1) : "0";
        response += `| ${truncate(String(exp.category), 25)} | ${formatCurrency(Number(exp.amount))} | ${pct}% |\n`;
      }
      response += `| **Total Expenses** | **${formatCurrency(totalExpenses)}** | **${(totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0).toFixed(1)}%** |\n\n`;

      // Net income visualization
      response += `### 💰 Net Income\n`;
      response += `\`\`\`\n`;
      response += `Revenue:    ${visualBar(totalRevenue, Math.max(totalRevenue, totalExpenses))} ${formatCurrency(totalRevenue)}\n`;
      response += `Expenses:   ${visualBar(totalExpenses, Math.max(totalRevenue, totalExpenses))} ${formatCurrency(totalExpenses)}\n`;
      response += `            ${"─".repeat(30)}\n`;
      response += `Net Income: ${netIncome >= 0 ? "+" : "-"}${formatCurrency(Math.abs(netIncome))}\n`;
      response += `\`\`\`\n\n`;

      // Key ratios
      response += `### 📊 Key Ratios\n`;
      response += `| Ratio | Value | Status |\n`;
      response += `|-------|-------|--------|\n`;
      response += `| Gross Margin | ${profitMargin.toFixed(1)}% | ${profitMargin > 20 ? "🟢 Healthy" : profitMargin > 0 ? "🟡 Low" : "🔴 Negative"} |\n`;
      response += `| Expense Ratio | ${(totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0).toFixed(1)}% | ${totalExpenses / totalRevenue < 0.8 ? "🟢 Good" : "🟡 High"} |\n`;
      response += `| Operating Leverage | ${totalExpenses > 0 ? (totalRevenue / totalExpenses).toFixed(2) : "∞"}x | ${totalRevenue / totalExpenses > 1.2 ? "🟢" : "🔴"} |\n\n`;

      // Insights
      response += `### 💡 Insights\n`;

      if (netIncome > 0) {
        response += `- ✅ **Profitable** with ${profitMargin.toFixed(0)}% margin\n`;
      } else {
        response += `- 🔴 **Operating at a loss** of ${formatCurrency(Math.abs(netIncome))}\n`;
      }

      if (compareWithPrevious) {
        if (revenueChange > 10) {
          response += `- 📈 Revenue grew ${revenueChange.toFixed(0)}% vs previous period\n`;
        } else if (revenueChange < -10) {
          response += `- 📉 Revenue declined ${Math.abs(revenueChange).toFixed(0)}% vs previous period\n`;
        }

        if (expenseChange > revenueChange + 5) {
          response += `- ⚠️ Expenses growing faster than revenue\n`;
        } else if (expenseChange < revenueChange - 5) {
          response += `- ✅ Good cost control - expenses growing slower than revenue\n`;
        }
      }

      // Top expense warning
      const topExpense = currentExpenses[0];
      if (topExpense && totalRevenue > 0) {
        const topExpensePct = (Number(topExpense.amount) / totalRevenue) * 100;
        if (topExpensePct > 30) {
          response += `- ⚠️ **${topExpense.category}** is ${topExpensePct.toFixed(0)}% of revenue - review for optimization\n`;
        }
      }

      return response;
    } catch (error) {
      console.error("Error generating P&L:", error);
      return `❌ Error generating P&L statement: ${error instanceof Error ? error.message : "Unknown error"}`;
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

function formatChange(change: number): string {
  if (change === 0) return "-";
  const emoji = change > 0 ? "📈" : "📉";
  return `${emoji} ${change > 0 ? "+" : ""}${change.toFixed(1)}%`;
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? `${str.slice(0, maxLen - 1)}…` : str;
}

function visualBar(value: number, max: number): string {
  const width = 20;
  const filled = Math.round((value / max) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}
