/**
 * Expense Breakdown AI Tool
 * Analyze expenses by category, vendor, and trends
 */

import { tool } from "ai";
import { z } from "zod";
import { sql } from "../../db/client";

const getExpensesSchema = z.object({
  tenantId: z.string().describe("The tenant ID to analyze"),
  months: z.number().min(1).max(24).default(6).describe("Number of months to analyze"),
  groupBy: z
    .enum(["category", "vendor", "month"])
    .default("category")
    .describe("How to group expense data"),
  includeRecurring: z.boolean().default(true).describe("Highlight recurring expenses"),
});

type GetExpensesParams = z.infer<typeof getExpensesSchema>;

export const getExpensesTool = tool({
  description:
    "Analyze expense breakdown by category, vendor, or month. Identifies spending patterns, recurring costs, and optimization opportunities.",
  parameters: getExpensesSchema,
  execute: async (params: GetExpensesParams): Promise<string> => {
    const { tenantId, months, groupBy, includeRecurring } = params;

    try {
      // Get expenses by category
      const expensesByCategory = await sql`
        SELECT
          COALESCE(p.category, 'Uncategorized') as category,
          SUM(ABS(p.amount_in_base_currency)) as amount,
          COUNT(*) as transaction_count,
          AVG(ABS(p.amount_in_base_currency)) as avg_amount
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE i.tenant_id = ${tenantId}
          AND p.is_expense = true
          AND p.date >= NOW() - INTERVAL '${months} months'
          AND p.status = 'completed'
        GROUP BY p.category
        ORDER BY amount DESC
      `;

      // Get expenses by vendor/merchant
      const expensesByVendor = await sql`
        SELECT
          COALESCE(p.merchant_name, p.description, 'Unknown') as vendor,
          SUM(ABS(p.amount_in_base_currency)) as amount,
          COUNT(*) as transaction_count,
          AVG(ABS(p.amount_in_base_currency)) as avg_amount,
          MAX(p.date) as last_payment
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE i.tenant_id = ${tenantId}
          AND p.is_expense = true
          AND p.date >= NOW() - INTERVAL '${months} months'
          AND p.status = 'completed'
        GROUP BY COALESCE(p.merchant_name, p.description, 'Unknown')
        ORDER BY amount DESC
        LIMIT 15
      `;

      // Get monthly expenses
      const monthlyExpenses = await sql`
        SELECT
          TO_CHAR(DATE_TRUNC('month', p.date), 'YYYY-MM') as month,
          SUM(ABS(p.amount_in_base_currency)) as amount,
          COUNT(*) as transaction_count
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE i.tenant_id = ${tenantId}
          AND p.is_expense = true
          AND p.date >= NOW() - INTERVAL '${months} months'
          AND p.status = 'completed'
        GROUP BY DATE_TRUNC('month', p.date)
        ORDER BY month DESC
      `;

      // Get recurring expenses
      const recurringExpenses = includeRecurring
        ? await sql`
        SELECT
          COALESCE(p.merchant_name, p.description) as name,
          AVG(ABS(p.amount_in_base_currency)) as avg_amount,
          COUNT(*) as occurrences,
          COALESCE(p.category, 'Uncategorized') as category,
          p.recurring_frequency
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE i.tenant_id = ${tenantId}
          AND p.is_expense = true
          AND p.is_recurring = true
          AND p.date >= NOW() - INTERVAL '${months} months'
          AND p.status = 'completed'
        GROUP BY COALESCE(p.merchant_name, p.description), p.category, p.recurring_frequency
        HAVING COUNT(*) >= 2
        ORDER BY avg_amount DESC
        LIMIT 10
      `
        : [];

      // Get largest single expenses
      const largestExpenses = await sql`
        SELECT
          p.description,
          ABS(p.amount_in_base_currency) as amount,
          p.date,
          COALESCE(p.category, 'Uncategorized') as category,
          p.merchant_name
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE i.tenant_id = ${tenantId}
          AND p.is_expense = true
          AND p.date >= NOW() - INTERVAL '${months} months'
          AND p.status = 'completed'
        ORDER BY amount DESC
        LIMIT 5
      `;

      // Calculate totals
      const totalExpenses = expensesByCategory.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
      const monthlyData = monthlyExpenses.map((m) => ({
        month: m.month as string,
        amount: Number(m.amount) || 0,
        count: Number(m.transaction_count) || 0,
      }));
      const avgMonthlyExpenses =
        monthlyData.length > 0
          ? monthlyData.reduce((sum, m) => sum + m.amount, 0) / monthlyData.length
          : 0;

      // Calculate MoM change
      let momChange = 0;
      if (monthlyData.length >= 2) {
        const current = monthlyData[0]?.amount || 0;
        const previous = monthlyData[1]?.amount || 0;
        momChange = previous > 0 ? ((current - previous) / previous) * 100 : 0;
      }

      // Recurring total (monthly equivalent)
      const recurringMonthly = recurringExpenses.reduce((sum, r) => {
        const amount = Number(r.avg_amount) || 0;
        const freq = r.recurring_frequency || "monthly";
        // Convert to monthly
        switch (freq) {
          case "weekly":
            return sum + amount * 4.33;
          case "biweekly":
            return sum + amount * 2.17;
          case "annually":
            return sum + amount / 12;
          default:
            return sum + amount;
        }
      }, 0);

      const recurringPercent =
        avgMonthlyExpenses > 0 ? (recurringMonthly / avgMonthlyExpenses) * 100 : 0;

      // Format response
      let response = `## 📊 Expense Analysis\n\n`;
      response += `**Period:** Last ${months} months\n\n`;

      // Summary metrics
      response += `### Summary\n`;
      response += `| Metric | Value |\n`;
      response += `|--------|-------|\n`;
      response += `| 💸 Total Expenses | ${formatCurrency(totalExpenses)} |\n`;
      response += `| 📅 Monthly Average | ${formatCurrency(avgMonthlyExpenses)} |\n`;
      response += `| ${momChange <= 0 ? "✅" : "⚠️"} MoM Change | ${momChange.toFixed(1)}% |\n`;
      response += `| 🔄 Recurring (est.) | ${formatCurrency(recurringMonthly)}/mo (${recurringPercent.toFixed(0)}%) |\n\n`;

      // Expenses by category
      if (groupBy === "category" || !groupBy) {
        response += `### 📂 By Category\n`;
        response += `| Category | Amount | Share | Avg Txn |\n`;
        response += `|----------|--------|-------|--------|\n`;

        for (const cat of expensesByCategory.slice(0, 10)) {
          const share =
            totalExpenses > 0 ? ((Number(cat.amount) / totalExpenses) * 100).toFixed(0) : "0";
          response += `| ${truncate(String(cat.category), 20)} | ${formatCurrency(Number(cat.amount))} | ${share}% | ${formatCurrency(Number(cat.avg_amount))} |\n`;
        }
        response += `\n`;
      }

      // Expenses by vendor
      if (groupBy === "vendor" || expensesByVendor.length > 0) {
        response += `### 🏢 Top Vendors\n`;
        response += `| Vendor | Amount | Txns | Last Payment |\n`;
        response += `|--------|--------|------|-------------|\n`;

        for (const vendor of expensesByVendor.slice(0, 10)) {
          const lastDate = vendor.last_payment
            ? new Date(vendor.last_payment as string).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : "-";
          response += `| ${truncate(String(vendor.vendor), 22)} | ${formatCurrency(Number(vendor.amount))} | ${vendor.transaction_count} | ${lastDate} |\n`;
        }
        response += `\n`;
      }

      // Monthly trend
      if (groupBy === "month") {
        response += `### 📅 Monthly Breakdown\n`;
        response += `| Month | Expenses | Txns | vs Avg |\n`;
        response += `|-------|----------|------|--------|\n`;

        for (const month of monthlyData.slice(0, 12)) {
          const vsAvg =
            avgMonthlyExpenses > 0
              ? ((month.amount - avgMonthlyExpenses) / avgMonthlyExpenses) * 100
              : 0;
          const indicator = vsAvg > 10 ? "🔴" : vsAvg < -10 ? "🟢" : "⚪";
          response += `| ${month.month} | ${formatCurrency(month.amount)} | ${month.count} | ${indicator} ${vsAvg.toFixed(0)}% |\n`;
        }
        response += `\n`;
      }

      // Recurring expenses
      if (includeRecurring && recurringExpenses.length > 0) {
        response += `### 🔄 Recurring Expenses\n`;
        response += `| Name | Amount | Frequency | Category |\n`;
        response += `|------|--------|-----------|----------|\n`;

        for (const exp of recurringExpenses) {
          const freq = formatFrequency(exp.recurring_frequency || "monthly");
          response += `| ${truncate(String(exp.name), 20)} | ${formatCurrency(Number(exp.avg_amount))} | ${freq} | ${truncate(String(exp.category), 12)} |\n`;
        }
        response += `\n`;
      }

      // Largest single expenses
      if (largestExpenses.length > 0) {
        response += `### 💰 Largest Single Expenses\n`;
        response += `| Description | Amount | Date | Category |\n`;
        response += `|-------------|--------|------|----------|\n`;

        for (const exp of largestExpenses) {
          const date = new Date(exp.date as string).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
          const desc = exp.merchant_name || exp.description;
          response += `| ${truncate(String(desc), 25)} | ${formatCurrency(Number(exp.amount))} | ${date} | ${truncate(String(exp.category), 12)} |\n`;
        }
        response += `\n`;
      }

      // Insights and recommendations
      response += `### 💡 Insights & Recommendations\n`;

      // High expense categories
      const topCategory = expensesByCategory[0];
      if (topCategory && totalExpenses > 0) {
        const topShare = (Number(topCategory.amount) / totalExpenses) * 100;
        if (topShare > 30) {
          response += `- ⚠️ **${topCategory.category}** represents ${topShare.toFixed(0)}% of expenses - review for optimization\n`;
        }
      }

      // Recurring expense ratio
      if (recurringPercent > 70) {
        response += `- 📊 High fixed costs (${recurringPercent.toFixed(0)}% recurring) - limited flexibility\n`;
      } else if (recurringPercent < 30) {
        response += `- ✅ Low fixed costs - good expense flexibility\n`;
      }

      // Growth warning
      if (momChange > 15) {
        response += `- 🚨 Expenses up ${momChange.toFixed(0)}% MoM - investigate drivers\n`;
      } else if (momChange < -15) {
        response += `- ✅ Expenses down ${Math.abs(momChange).toFixed(0)}% MoM - good cost control\n`;
      }

      // Vendor concentration
      const topVendorAmount = Number(expensesByVendor[0]?.amount) || 0;
      if (topVendorAmount / totalExpenses > 0.25) {
        response += `- ⚠️ Single vendor concentration risk: **${expensesByVendor[0]?.vendor}**\n`;
      }

      return response;
    } catch (error) {
      console.error("Error analyzing expenses:", error);
      return `❌ Error analyzing expenses: ${error instanceof Error ? error.message : "Unknown error"}`;
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

function formatFrequency(freq: string): string {
  switch (freq) {
    case "weekly":
      return "📅 Weekly";
    case "biweekly":
      return "📅 Bi-weekly";
    case "monthly":
      return "📅 Monthly";
    case "quarterly":
      return "📅 Quarterly";
    case "annually":
      return "📅 Annually";
    default:
      return freq;
  }
}
