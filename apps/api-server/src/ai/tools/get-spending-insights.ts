/**
 * Spending Insights AI Tool
 * Intelligent analysis of spending patterns and anomalies
 */

import { tool } from "ai";
import { z } from "zod";
import { sql } from "../../db/client";

const getSpendingInsightsSchema = z.object({
  tenantId: z.string().describe("The tenant ID to analyze"),
  months: z.number().min(1).max(12).default(3).describe("Number of months to analyze"),
});

type GetSpendingInsightsParams = z.infer<typeof getSpendingInsightsSchema>;

export const getSpendingInsightsTool = tool({
  description:
    "Get intelligent insights about spending patterns, anomalies, savings opportunities, and unusual transactions. Use this to understand spending behavior.",
  parameters: getSpendingInsightsSchema,
  execute: async (params: GetSpendingInsightsParams): Promise<string> => {
    const { tenantId, months } = params;

    try {
      // Get all expenses with details
      const expenses = await sql`
        SELECT
          p.id,
          p.description,
          ABS(p.amount_in_base_currency) as amount,
          p.date,
          COALESCE(p.category, 'Uncategorized') as category,
          p.merchant_name,
          p.is_recurring
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE i.tenant_id = ${tenantId}
          AND p.is_expense = true
          AND p.date >= NOW() - INTERVAL '${months} months'
          AND p.status = 'completed'
        ORDER BY p.date DESC
      `;

      // Calculate spending by category
      const categorySpend: Map<string, { total: number; count: number; transactions: any[] }> =
        new Map();
      for (const exp of expenses) {
        const cat = exp.category as string;
        if (!categorySpend.has(cat)) {
          categorySpend.set(cat, { total: 0, count: 0, transactions: [] });
        }
        const data = categorySpend.get(cat)!;
        data.total += Number(exp.amount) || 0;
        data.count++;
        data.transactions.push(exp);
      }

      // Calculate monthly averages by category
      const monthlyAvgByCategory: Map<string, number> = new Map();
      categorySpend.forEach((data, cat) => {
        monthlyAvgByCategory.set(cat, data.total / months);
      });

      // Find spending anomalies (transactions > 2x category average)
      const anomalies: any[] = [];
      for (const exp of expenses) {
        const cat = exp.category as string;
        const categoryData = categorySpend.get(cat);
        if (categoryData && categoryData.count > 2) {
          const avgTransaction = categoryData.total / categoryData.count;
          if (Number(exp.amount) > avgTransaction * 2.5 && Number(exp.amount) > 100) {
            anomalies.push({
              ...exp,
              expectedAmount: avgTransaction,
              variance: ((Number(exp.amount) - avgTransaction) / avgTransaction) * 100,
            });
          }
        }
      }

      // Find potential duplicate charges
      const duplicates: any[] = [];
      const transactionsByDay: Map<string, any[]> = new Map();
      for (const exp of expenses) {
        const dateKey = new Date(exp.date as string).toISOString().split("T")[0];
        if (!transactionsByDay.has(dateKey)) {
          transactionsByDay.set(dateKey, []);
        }
        transactionsByDay.get(dateKey)!.push(exp);
      }

      transactionsByDay.forEach((dayTransactions) => {
        for (let i = 0; i < dayTransactions.length; i++) {
          for (let j = i + 1; j < dayTransactions.length; j++) {
            const t1 = dayTransactions[i];
            const t2 = dayTransactions[j];
            if (
              Math.abs(Number(t1.amount) - Number(t2.amount)) < 1 &&
              (t1.merchant_name === t2.merchant_name || t1.description === t2.description)
            ) {
              duplicates.push({ transaction1: t1, transaction2: t2 });
            }
          }
        }
      });

      // Calculate spending velocity (is spending increasing?)
      const weeklySpending: number[] = [];
      const now = new Date();
      for (let week = 0; week < months * 4; week++) {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - (week + 1) * 7);
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() - week * 7);

        const weekTotal = expenses
          .filter((e) => {
            const d = new Date(e.date as string);
            return d >= weekStart && d < weekEnd;
          })
          .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        weeklySpending.push(weekTotal);
      }

      const recentWeeklyAvg = weeklySpending.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
      const olderWeeklyAvg = weeklySpending.slice(-4).reduce((a, b) => a + b, 0) / 4;
      const velocityChange =
        olderWeeklyAvg > 0 ? ((recentWeeklyAvg - olderWeeklyAvg) / olderWeeklyAvg) * 100 : 0;

      // Find savings opportunities
      const savingsOpportunities: string[] = [];

      // Check for subscription stacking
      const subscriptions = expenses.filter((e) => e.is_recurring);
      const subscriptionsByCategory: Map<string, number> = new Map();
      subscriptions.forEach((s) => {
        const cat = s.category as string;
        subscriptionsByCategory.set(cat, (subscriptionsByCategory.get(cat) || 0) + 1);
      });
      subscriptionsByCategory.forEach((count, cat) => {
        if (count > 2) {
          savingsOpportunities.push(
            `Multiple ${cat} subscriptions (${count}) - consider consolidating`
          );
        }
      });

      // Check for high-spend categories
      const totalSpend = Array.from(categorySpend.values()).reduce((sum, d) => sum + d.total, 0);
      categorySpend.forEach((data, cat) => {
        if (data.total / totalSpend > 0.3 && data.total > 500) {
          savingsOpportunities.push(
            `${cat} is ${((data.total / totalSpend) * 100).toFixed(0)}% of spending - review for optimization`
          );
        }
      });

      // Format response
      let response = `## 🔍 Spending Insights\n\n`;
      response += `**Analysis Period:** Last ${months} months\n\n`;

      // Spending velocity
      response += `### 📊 Spending Velocity\n`;
      const velocityEmoji = velocityChange > 10 ? "🔴" : velocityChange < -10 ? "🟢" : "🟡";
      response += `${velocityEmoji} Spending is ${velocityChange > 0 ? "up" : "down"} **${Math.abs(velocityChange).toFixed(0)}%** compared to earlier in the period\n\n`;

      // Top spending categories with insights
      response += `### 💰 Spending by Category\n`;
      response += `| Category | Total | Monthly Avg | Trend |\n`;
      response += `|----------|-------|-------------|-------|\n`;

      const sortedCategories = Array.from(categorySpend.entries())
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 8);

      for (const [cat, data] of sortedCategories) {
        const monthlyAvg = data.total / months;
        const share = totalSpend > 0 ? (data.total / totalSpend) * 100 : 0;
        const trend = share > 25 ? "⚠️ High" : share > 15 ? "📊 Medium" : "✅ Normal";
        response += `| ${truncate(cat, 18)} | ${formatCurrency(data.total)} | ${formatCurrency(monthlyAvg)} | ${trend} |\n`;
      }
      response += `\n`;

      // Anomalies
      if (anomalies.length > 0) {
        response += `### ⚠️ Unusual Transactions\n`;
        response += `Found ${anomalies.length} transactions significantly above category average:\n\n`;
        response += `| Date | Description | Amount | Expected | Variance |\n`;
        response += `|------|-------------|--------|----------|----------|\n`;

        for (const anomaly of anomalies.slice(0, 5)) {
          const date = new Date(anomaly.date as string).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
          const desc = anomaly.merchant_name || anomaly.description;
          response += `| ${date} | ${truncate(String(desc), 20)} | ${formatCurrency(Number(anomaly.amount))} | ${formatCurrency(anomaly.expectedAmount)} | +${anomaly.variance.toFixed(0)}% |\n`;
        }
        response += `\n`;
      }

      // Potential duplicates
      if (duplicates.length > 0) {
        response += `### 🔄 Potential Duplicate Charges\n`;
        response += `Found ${duplicates.length} potential duplicate transaction(s):\n\n`;

        for (const dup of duplicates.slice(0, 3)) {
          const date = new Date(dup.transaction1.date as string).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
          const desc = dup.transaction1.merchant_name || dup.transaction1.description;
          response += `- **${date}**: ${truncate(String(desc), 25)} - ${formatCurrency(Number(dup.transaction1.amount))} (appears twice)\n`;
        }
        response += `\n`;
      }

      // Savings opportunities
      if (savingsOpportunities.length > 0) {
        response += `### 💡 Savings Opportunities\n`;
        for (const opportunity of savingsOpportunities) {
          response += `- ${opportunity}\n`;
        }
        response += `\n`;
      }

      // Recurring vs one-time
      const recurringTotal = subscriptions.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
      const oneTimeTotal = totalSpend - recurringTotal;
      response += `### 🔄 Recurring vs One-Time\n`;
      response += `| Type | Amount | Share |\n`;
      response += `|------|--------|-------|\n`;
      response += `| Recurring | ${formatCurrency(recurringTotal)} | ${((recurringTotal / totalSpend) * 100).toFixed(0)}% |\n`;
      response += `| One-Time | ${formatCurrency(oneTimeTotal)} | ${((oneTimeTotal / totalSpend) * 100).toFixed(0)}% |\n\n`;

      // Key insights
      response += `### 🎯 Key Insights\n`;

      if (velocityChange > 15) {
        response += `- 📈 **Spending acceleration:** Your spending is increasing faster than usual\n`;
      } else if (velocityChange < -15) {
        response += `- 📉 **Good control:** Spending has decreased compared to previous period\n`;
      }

      const topCategory = sortedCategories[0];
      if (topCategory && topCategory[1].total / totalSpend > 0.35) {
        response += `- ⚠️ **Concentration risk:** ${topCategory[0]} accounts for ${((topCategory[1].total / totalSpend) * 100).toFixed(0)}% of spending\n`;
      }

      if (recurringTotal / totalSpend > 0.6) {
        response += `- 🔒 **High fixed costs:** ${((recurringTotal / totalSpend) * 100).toFixed(0)}% of spending is recurring - limited flexibility\n`;
      }

      if (anomalies.length > 0) {
        response += `- 🔍 Review ${anomalies.length} unusual transaction(s) for accuracy\n`;
      }

      if (duplicates.length > 0) {
        response += `- ⚠️ Check ${duplicates.length} potential duplicate charge(s)\n`;
      }

      return response;
    } catch (error) {
      console.error("Error generating spending insights:", error);
      return `❌ Error generating insights: ${error instanceof Error ? error.message : "Unknown error"}`;
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
