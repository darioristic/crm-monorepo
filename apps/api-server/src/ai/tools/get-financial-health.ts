/**
 * Financial Health AI Tool
 * Comprehensive financial health score and analysis
 */

import { tool } from "ai";
import { z } from "zod";
import { sql } from "../../db/client";

const getFinancialHealthSchema = z.object({
  tenantId: z.string().describe("The tenant ID to analyze"),
  detailed: z.boolean().optional().describe("Include detailed breakdown"),
});

type GetFinancialHealthParams = z.infer<typeof getFinancialHealthSchema>;

interface HealthMetric {
  name: string;
  score: number;
  maxScore: number;
  status: "excellent" | "good" | "fair" | "poor" | "critical";
  details: string;
}

export const getFinancialHealthTool = tool({
  description:
    "Generate a comprehensive financial health score with detailed breakdown. Analyzes profitability, liquidity, growth, and risk factors.",
  inputSchema: getFinancialHealthSchema,
  execute: async (input: GetFinancialHealthParams): Promise<string> => {
    const { tenantId, detailed = true } = input;

    try {
      // Get various financial metrics for health scoring
      // 1. Cash Position
      const balanceResult = await sql`
        SELECT
          COALESCE(SUM(
            CASE
              WHEN p.is_expense = false THEN ABS(p.amount_in_base_currency)
              ELSE -ABS(p.amount_in_base_currency)
            END
          ), 0) as balance
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE i.tenant_id = ${tenantId}
          AND p.status = 'completed'
      `;
      const currentBalance = Number(balanceResult[0]?.balance) || 0;

      // 2. Monthly income/expenses (last 6 months)
      const monthlyData = await sql`
        SELECT
          TO_CHAR(DATE_TRUNC('month', p.date), 'YYYY-MM') as month,
          SUM(CASE WHEN p.is_expense = false THEN ABS(p.amount_in_base_currency) ELSE 0 END) as income,
          SUM(CASE WHEN p.is_expense = true THEN ABS(p.amount_in_base_currency) ELSE 0 END) as expenses
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE i.tenant_id = ${tenantId}
          AND p.date >= NOW() - INTERVAL '6 months'
          AND p.status = 'completed'
        GROUP BY DATE_TRUNC('month', p.date)
        ORDER BY month DESC
      `;

      const monthly = monthlyData.map((m) => ({
        month: m.month as string,
        income: Number(m.income) || 0,
        expenses: Number(m.expenses) || 0,
        netFlow: (Number(m.income) || 0) - (Number(m.expenses) || 0),
      }));

      const avgIncome =
        monthly.length > 0 ? monthly.reduce((sum, m) => sum + m.income, 0) / monthly.length : 0;
      const avgExpenses =
        monthly.length > 0 ? monthly.reduce((sum, m) => sum + m.expenses, 0) / monthly.length : 0;
      const avgNetFlow = avgIncome - avgExpenses;

      // 3. Revenue concentration
      const clientRevenue = await sql`
        SELECT
          COALESCE(cl.name, 'Unknown') as client,
          SUM(ABS(p.amount_in_base_currency)) as revenue
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        LEFT JOIN clients cl ON i.client_id = cl.id
        WHERE i.tenant_id = ${tenantId}
          AND p.is_expense = false
          AND p.date >= NOW() - INTERVAL '6 months'
          AND p.status = 'completed'
        GROUP BY cl.name
        ORDER BY revenue DESC
        LIMIT 5
      `;

      const totalRevenue6m = clientRevenue.reduce((sum, c) => sum + (Number(c.revenue) || 0), 0);
      const topClientRevenue = Number(clientRevenue[0]?.revenue) || 0;
      const revenueConcentration = totalRevenue6m > 0 ? topClientRevenue / totalRevenue6m : 0;

      // 4. Recurring expenses ratio
      const recurringResult = await sql`
        SELECT
          COALESCE(SUM(ABS(p.amount_in_base_currency)), 0) as recurring_total
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE i.tenant_id = ${tenantId}
          AND p.is_expense = true
          AND p.is_recurring = true
          AND p.date >= NOW() - INTERVAL '1 month'
          AND p.status = 'completed'
      `;
      const recurringExpenses = Number(recurringResult[0]?.recurring_total) || 0;
      const recurringRatio = avgExpenses > 0 ? recurringExpenses / avgExpenses : 0;

      // 5. Growth metrics
      let revenueGrowth = 0;
      if (monthly.length >= 3) {
        const recent = monthly.slice(0, 3).reduce((sum, m) => sum + m.income, 0) / 3;
        const older = monthly.slice(-3).reduce((sum, m) => sum + m.income, 0) / 3;
        revenueGrowth = older > 0 ? ((recent - older) / older) * 100 : 0;
      }

      // 6. Expense volatility
      const expenseVariance =
        monthly.length > 1
          ? monthly.reduce((sum, m) => sum + (m.expenses - avgExpenses) ** 2, 0) / monthly.length
          : 0;
      const expenseVolatility = avgExpenses > 0 ? Math.sqrt(expenseVariance) / avgExpenses : 0;

      // Calculate health metrics
      const metrics: HealthMetric[] = [];

      // 1. Profitability Score (0-25 points)
      const profitMargin = avgIncome > 0 ? (avgNetFlow / avgIncome) * 100 : 0;
      let profitScore = 0;
      let profitStatus: HealthMetric["status"] = "critical";
      if (profitMargin >= 20) {
        profitScore = 25;
        profitStatus = "excellent";
      } else if (profitMargin >= 10) {
        profitScore = 20;
        profitStatus = "good";
      } else if (profitMargin >= 0) {
        profitScore = 15;
        profitStatus = "fair";
      } else if (profitMargin >= -10) {
        profitScore = 8;
        profitStatus = "poor";
      } else {
        profitScore = 0;
        profitStatus = "critical";
      }

      metrics.push({
        name: "Profitability",
        score: profitScore,
        maxScore: 25,
        status: profitStatus,
        details: `${profitMargin.toFixed(1)}% profit margin`,
      });

      // 2. Liquidity Score (0-25 points)
      const runway = avgNetFlow < 0 ? currentBalance / Math.abs(avgNetFlow) : Infinity;
      let liquidityScore = 0;
      let liquidityStatus: HealthMetric["status"] = "critical";
      if (runway >= 12 || avgNetFlow >= 0) {
        liquidityScore = 25;
        liquidityStatus = "excellent";
      } else if (runway >= 6) {
        liquidityScore = 20;
        liquidityStatus = "good";
      } else if (runway >= 3) {
        liquidityScore = 12;
        liquidityStatus = "fair";
      } else if (runway >= 1) {
        liquidityScore = 5;
        liquidityStatus = "poor";
      } else {
        liquidityScore = 0;
        liquidityStatus = "critical";
      }

      metrics.push({
        name: "Liquidity",
        score: liquidityScore,
        maxScore: 25,
        status: liquidityStatus,
        details: runway === Infinity ? "Positive cash flow" : `${Math.floor(runway)} months runway`,
      });

      // 3. Revenue Diversification Score (0-25 points)
      let diversificationScore = 0;
      let diversificationStatus: HealthMetric["status"] = "critical";
      if (revenueConcentration <= 0.2) {
        diversificationScore = 25;
        diversificationStatus = "excellent";
      } else if (revenueConcentration <= 0.35) {
        diversificationScore = 20;
        diversificationStatus = "good";
      } else if (revenueConcentration <= 0.5) {
        diversificationScore = 15;
        diversificationStatus = "fair";
      } else if (revenueConcentration <= 0.7) {
        diversificationScore = 8;
        diversificationStatus = "poor";
      } else {
        diversificationScore = 0;
        diversificationStatus = "critical";
      }

      metrics.push({
        name: "Revenue Diversification",
        score: diversificationScore,
        maxScore: 25,
        status: diversificationStatus,
        details: `Top client: ${(revenueConcentration * 100).toFixed(0)}% of revenue`,
      });

      // 4. Growth & Stability Score (0-25 points)
      let growthScore = 0;
      let growthStatus: HealthMetric["status"] = "fair";

      // Combine growth and stability
      const volatilityPenalty = expenseVolatility > 0.3 ? -5 : expenseVolatility > 0.15 ? -2 : 0;
      if (revenueGrowth >= 20) {
        growthScore = 25 + volatilityPenalty;
        growthStatus = "excellent";
      } else if (revenueGrowth >= 10) {
        growthScore = 20 + volatilityPenalty;
        growthStatus = "good";
      } else if (revenueGrowth >= 0) {
        growthScore = 15 + volatilityPenalty;
        growthStatus = "fair";
      } else if (revenueGrowth >= -10) {
        growthScore = 10 + volatilityPenalty;
        growthStatus = "poor";
      } else {
        growthScore = 5 + volatilityPenalty;
        growthStatus = "critical";
      }
      growthScore = Math.max(0, growthScore);

      metrics.push({
        name: "Growth & Stability",
        score: growthScore,
        maxScore: 25,
        status: growthStatus,
        details: `${revenueGrowth.toFixed(1)}% growth, ${(expenseVolatility * 100).toFixed(0)}% expense volatility`,
      });

      // Calculate total score
      const totalScore = metrics.reduce((sum, m) => sum + m.score, 0);
      const maxScore = metrics.reduce((sum, m) => sum + m.maxScore, 0);
      const scorePercentage = (totalScore / maxScore) * 100;

      // Determine overall status
      let overallStatus: string;
      let statusEmoji: string;
      if (scorePercentage >= 80) {
        overallStatus = "Excellent";
        statusEmoji = "🌟";
      } else if (scorePercentage >= 65) {
        overallStatus = "Good";
        statusEmoji = "✅";
      } else if (scorePercentage >= 50) {
        overallStatus = "Fair";
        statusEmoji = "🟡";
      } else if (scorePercentage >= 35) {
        overallStatus = "Poor";
        statusEmoji = "⚠️";
      } else {
        overallStatus = "Critical";
        statusEmoji = "🚨";
      }

      // Format response
      let response = `## ${statusEmoji} Financial Health Report\n\n`;

      // Score visualization
      response += `### Overall Score: ${totalScore}/${maxScore} (${scorePercentage.toFixed(0)}%)\n\n`;
      response += `\`\`\`\n`;
      response += `[${progressBar(scorePercentage)}] ${overallStatus}\n`;
      response += `\`\`\`\n\n`;

      // Key metrics summary
      response += `### 📊 Key Metrics\n`;
      response += `| Metric | Value |\n`;
      response += `|--------|-------|\n`;
      response += `| 💰 Cash Balance | ${formatCurrency(currentBalance)} |\n`;
      response += `| 📈 Avg Monthly Revenue | ${formatCurrency(avgIncome)} |\n`;
      response += `| 📉 Avg Monthly Expenses | ${formatCurrency(avgExpenses)} |\n`;
      response += `| ${avgNetFlow >= 0 ? "🟢" : "🔴"} Net Monthly Flow | ${formatCurrency(avgNetFlow)} |\n`;
      response += `| 🔄 Fixed Costs Ratio | ${(recurringRatio * 100).toFixed(0)}% |\n\n`;

      // Detailed breakdown
      if (detailed) {
        response += `### 📋 Health Score Breakdown\n`;
        response += `| Category | Score | Status | Details |\n`;
        response += `|----------|-------|--------|--------|\n`;

        for (const metric of metrics) {
          const statusIcon = getStatusIcon(metric.status);
          response += `| ${metric.name} | ${metric.score}/${metric.maxScore} | ${statusIcon} ${metric.status} | ${metric.details} |\n`;
        }
        response += `\n`;
      }

      // Risk factors
      response += `### ⚠️ Risk Factors\n`;
      const risks: string[] = [];

      if (runway < 6 && avgNetFlow < 0) {
        risks.push(`🔴 **Low Runway:** Only ${Math.floor(runway)} months of cash remaining`);
      }
      if (revenueConcentration > 0.5) {
        risks.push(
          `🔴 **Revenue Concentration:** Top client represents ${(revenueConcentration * 100).toFixed(0)}% of revenue`
        );
      }
      if (recurringRatio > 0.7) {
        risks.push(
          `🟡 **High Fixed Costs:** ${(recurringRatio * 100).toFixed(0)}% of expenses are recurring`
        );
      }
      if (revenueGrowth < -10) {
        risks.push(
          `🔴 **Declining Revenue:** ${revenueGrowth.toFixed(0)}% decrease in recent months`
        );
      }
      if (expenseVolatility > 0.3) {
        risks.push(`🟡 **High Expense Volatility:** Unpredictable spending patterns`);
      }

      if (risks.length === 0) {
        response += `✅ No significant risk factors identified\n\n`;
      } else {
        for (const risk of risks) {
          response += `- ${risk}\n`;
        }
        response += `\n`;
      }

      // Strengths
      response += `### ✨ Strengths\n`;
      const strengths: string[] = [];

      if (profitMargin > 15) {
        strengths.push(`💪 Strong profitability (${profitMargin.toFixed(0)}% margin)`);
      }
      if (runway >= 12 || avgNetFlow >= 0) {
        strengths.push(`💪 Healthy cash position`);
      }
      if (revenueConcentration <= 0.3) {
        strengths.push(`💪 Well-diversified revenue`);
      }
      if (revenueGrowth > 10) {
        strengths.push(`💪 Strong revenue growth (${revenueGrowth.toFixed(0)}%)`);
      }
      if (expenseVolatility < 0.15) {
        strengths.push(`💪 Stable expense patterns`);
      }

      if (strengths.length === 0) {
        response += `No major strengths identified - focus on improvement areas\n\n`;
      } else {
        for (const strength of strengths) {
          response += `- ${strength}\n`;
        }
        response += `\n`;
      }

      // Recommendations
      response += `### 💡 Recommendations\n`;

      if (profitScore < 15) {
        response += `1. **Improve Profitability:** Review pricing and reduce non-essential expenses\n`;
      }
      if (liquidityScore < 15) {
        response += `2. **Build Cash Reserves:** Target 6+ months of operating expenses\n`;
      }
      if (diversificationScore < 15) {
        response += `3. **Diversify Revenue:** Reduce dependency on top clients\n`;
      }
      if (growthScore < 15) {
        response += `4. **Drive Growth:** Focus on revenue expansion and expense stability\n`;
      }

      if (totalScore >= 80) {
        response += `- ✅ Maintain current healthy financial practices\n`;
        response += `- Consider strategic investments for growth\n`;
      }

      return response;
    } catch (error) {
      console.error("Error generating health report:", error);
      return `❌ Error generating health report: ${error instanceof Error ? error.message : "Unknown error"}`;
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

function progressBar(percentage: number): string {
  const width = 30;
  const filled = Math.round((percentage / 100) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function getStatusIcon(status: HealthMetric["status"]): string {
  switch (status) {
    case "excellent":
      return "🌟";
    case "good":
      return "✅";
    case "fair":
      return "🟡";
    case "poor":
      return "⚠️";
    case "critical":
      return "🚨";
    default:
      return "❓";
  }
}
