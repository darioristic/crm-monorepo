/**
 * Financial Forecast AI Tool
 * Project future revenue, expenses, and cash position
 */

import { tool } from "ai";
import { z } from "zod";
import { sql } from "../../db/client";

const getForecastSchema = z.object({
  tenantId: z.string().describe("The tenant ID to analyze"),
  forecastMonths: z.number().min(1).max(12).optional().describe("Number of months to forecast"),
  scenario: z
    .enum(["conservative", "moderate", "optimistic"])
    .optional()
    .describe("Forecast scenario"),
  includeSeasonality: z.boolean().optional().describe("Account for seasonal patterns"),
});

type GetForecastParams = z.infer<typeof getForecastSchema>;

interface MonthlyForecast {
  month: string;
  projectedRevenue: number;
  projectedExpenses: number;
  netCashFlow: number;
  projectedBalance: number;
  confidence: number;
}

export const getForecastTool = tool({
  description:
    "Generate financial forecasts for revenue, expenses, and cash position. Uses historical data to project future performance under different scenarios.",
  inputSchema: getForecastSchema,
  execute: async (input: GetForecastParams): Promise<string> => {
    const {
      tenantId,
      forecastMonths = 6,
      scenario = "moderate",
      includeSeasonality = true,
    } = input;

    try {
      // Get historical monthly data (12 months)
      const historicalData = await sql`
        SELECT
          TO_CHAR(DATE_TRUNC('month', p.date), 'YYYY-MM') as month,
          EXTRACT(MONTH FROM p.date) as month_num,
          SUM(CASE WHEN p.is_expense = false THEN ABS(p.amount_in_base_currency) ELSE 0 END) as revenue,
          SUM(CASE WHEN p.is_expense = true THEN ABS(p.amount_in_base_currency) ELSE 0 END) as expenses
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE i.tenant_id = ${tenantId}
          AND p.date >= NOW() - INTERVAL '12 months'
          AND p.status = 'completed'
        GROUP BY DATE_TRUNC('month', p.date), EXTRACT(MONTH FROM p.date)
        ORDER BY month DESC
      `;

      // Get current balance
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

      // Parse historical data
      const history = historicalData.map((h) => ({
        month: h.month as string,
        monthNum: Number(h.month_num),
        revenue: Number(h.revenue) || 0,
        expenses: Number(h.expenses) || 0,
      }));

      // Calculate base metrics
      const avgRevenue =
        history.length > 0 ? history.reduce((sum, h) => sum + h.revenue, 0) / history.length : 0;
      const avgExpenses =
        history.length > 0 ? history.reduce((sum, h) => sum + h.expenses, 0) / history.length : 0;

      // Calculate growth rates
      let revenueGrowth = 0;
      let expenseGrowth = 0;
      if (history.length >= 6) {
        const recentRevenue = history.slice(0, 3).reduce((sum, h) => sum + h.revenue, 0) / 3;
        const olderRevenue = history.slice(-3).reduce((sum, h) => sum + h.revenue, 0) / 3;
        revenueGrowth = olderRevenue > 0 ? (recentRevenue - olderRevenue) / olderRevenue : 0;

        const recentExpenses = history.slice(0, 3).reduce((sum, h) => sum + h.expenses, 0) / 3;
        const olderExpenses = history.slice(-3).reduce((sum, h) => sum + h.expenses, 0) / 3;
        expenseGrowth = olderExpenses > 0 ? (recentExpenses - olderExpenses) / olderExpenses : 0;
      }

      // Calculate seasonality indices
      const seasonalityFactors: Map<number, { revenue: number; expenses: number }> = new Map();
      if (includeSeasonality && history.length >= 6) {
        for (let month = 1; month <= 12; month++) {
          const monthData = history.filter((h) => h.monthNum === month);
          if (monthData.length > 0) {
            const avgMonthRevenue =
              monthData.reduce((sum, h) => sum + h.revenue, 0) / monthData.length;
            const avgMonthExpenses =
              monthData.reduce((sum, h) => sum + h.expenses, 0) / monthData.length;
            seasonalityFactors.set(month, {
              revenue: avgRevenue > 0 ? avgMonthRevenue / avgRevenue : 1,
              expenses: avgExpenses > 0 ? avgMonthExpenses / avgExpenses : 1,
            });
          }
        }
      }

      // Scenario multipliers
      const scenarioMultipliers = {
        conservative: { revenue: 0.9, expenses: 1.1, growth: 0.5 },
        moderate: { revenue: 1.0, expenses: 1.0, growth: 1.0 },
        optimistic: { revenue: 1.1, expenses: 0.95, growth: 1.5 },
      };
      const multiplier = scenarioMultipliers[scenario];

      // Generate forecasts
      const forecasts: MonthlyForecast[] = [];
      let runningBalance = currentBalance;
      const currentDate = new Date();

      for (let i = 1; i <= forecastMonths; i++) {
        const forecastDate = new Date(currentDate);
        forecastDate.setMonth(currentDate.getMonth() + i);
        const forecastMonth = `${forecastDate.getFullYear()}-${String(forecastDate.getMonth() + 1).padStart(2, "0")}`;
        const monthNum = forecastDate.getMonth() + 1;

        // Base projections with growth
        const growthFactor = 1 + revenueGrowth * multiplier.growth * (i / 12);
        let projectedRevenue = avgRevenue * growthFactor * multiplier.revenue;
        let projectedExpenses =
          avgExpenses * (1 + expenseGrowth * multiplier.growth * (i / 12)) * multiplier.expenses;

        // Apply seasonality
        if (includeSeasonality && seasonalityFactors.has(monthNum)) {
          const factors = seasonalityFactors.get(monthNum)!;
          projectedRevenue *= factors.revenue;
          projectedExpenses *= factors.expenses;
        }

        const netCashFlow = projectedRevenue - projectedExpenses;
        runningBalance += netCashFlow;

        // Confidence decreases with time
        const confidence = Math.max(0.5, 1 - i * 0.08);

        forecasts.push({
          month: forecastMonth,
          projectedRevenue,
          projectedExpenses,
          netCashFlow,
          projectedBalance: runningBalance,
          confidence,
        });
      }

      // Calculate summary metrics
      const totalProjectedRevenue = forecasts.reduce((sum, f) => sum + f.projectedRevenue, 0);
      const totalProjectedExpenses = forecasts.reduce((sum, f) => sum + f.projectedExpenses, 0);
      const endingBalance = forecasts[forecasts.length - 1]?.projectedBalance || currentBalance;
      const lowestBalance = Math.min(...forecasts.map((f) => f.projectedBalance));
      const monthsUntilZero = forecasts.findIndex((f) => f.projectedBalance < 0);

      // Format response
      let response = `## 🔮 Financial Forecast\n\n`;
      response += `**Scenario:** ${scenario.charAt(0).toUpperCase() + scenario.slice(1)}\n`;
      response += `**Forecast Period:** ${forecastMonths} months\n\n`;

      // Current position
      response += `### Current Position\n`;
      response += `| Metric | Value |\n`;
      response += `|--------|-------|\n`;
      response += `| 💰 Current Balance | ${formatCurrency(currentBalance)} |\n`;
      response += `| 📈 Avg Monthly Revenue | ${formatCurrency(avgRevenue)} |\n`;
      response += `| 📉 Avg Monthly Expenses | ${formatCurrency(avgExpenses)} |\n`;
      response += `| 📊 Revenue Trend | ${(revenueGrowth * 100).toFixed(1)}%/yr |\n\n`;

      // Forecast summary
      response += `### Forecast Summary (${forecastMonths} months)\n`;
      response += `| Metric | Projected |\n`;
      response += `|--------|----------|\n`;
      response += `| 💵 Total Revenue | ${formatCurrency(totalProjectedRevenue)} |\n`;
      response += `| 💸 Total Expenses | ${formatCurrency(totalProjectedExpenses)} |\n`;
      response += `| ${endingBalance >= currentBalance ? "📈" : "📉"} Ending Balance | ${formatCurrency(endingBalance)} |\n`;
      response += `| ⚠️ Lowest Point | ${formatCurrency(lowestBalance)} |\n`;

      if (monthsUntilZero > 0) {
        response += `| 🚨 Cash Runway | ${monthsUntilZero} months |\n`;
      }
      response += `\n`;

      // Monthly forecast table
      response += `### Monthly Projections\n`;
      response += `| Month | Revenue | Expenses | Net Flow | Balance | Conf |\n`;
      response += `|-------|---------|----------|----------|---------|------|\n`;

      for (const forecast of forecasts) {
        const flowEmoji = forecast.netCashFlow >= 0 ? "🟢" : "🔴";
        const confBar =
          "●".repeat(Math.round(forecast.confidence * 5)) +
          "○".repeat(5 - Math.round(forecast.confidence * 5));
        response += `| ${forecast.month} | ${formatCurrency(forecast.projectedRevenue)} | ${formatCurrency(forecast.projectedExpenses)} | ${flowEmoji} ${formatCurrency(forecast.netCashFlow)} | ${formatCurrency(forecast.projectedBalance)} | ${confBar} |\n`;
      }
      response += `\n`;

      // Scenario comparison
      response += `### Scenario Comparison\n`;
      response += `| Scenario | End Balance | Net Cash Flow |\n`;
      response += `|----------|-------------|---------------|\n`;

      for (const [scenarioName, mult] of Object.entries(scenarioMultipliers)) {
        let scenarioBalance = currentBalance;
        for (let i = 1; i <= forecastMonths; i++) {
          const growthFactor = 1 + revenueGrowth * mult.growth * (i / 12);
          const rev = avgRevenue * growthFactor * mult.revenue;
          const exp = avgExpenses * (1 + expenseGrowth * mult.growth * (i / 12)) * mult.expenses;
          scenarioBalance += rev - exp;
        }
        const totalFlow = scenarioBalance - currentBalance;
        const indicator = scenarioName === scenario ? "→" : " ";
        response += `| ${indicator} ${scenarioName.charAt(0).toUpperCase() + scenarioName.slice(1)} | ${formatCurrency(scenarioBalance)} | ${formatCurrency(totalFlow)} |\n`;
      }
      response += `\n`;

      // Key assumptions
      response += `### 📋 Key Assumptions\n`;
      response += `- Historical data: ${history.length} months analyzed\n`;
      response += `- Revenue growth: ${(revenueGrowth * 100).toFixed(1)}% over period\n`;
      response += `- Expense growth: ${(expenseGrowth * 100).toFixed(1)}% over period\n`;
      response += `- Seasonality: ${includeSeasonality ? "Included" : "Not included"}\n`;
      response += `- Scenario adjustment: Revenue ${((multiplier.revenue - 1) * 100).toFixed(0)}%, Expenses ${((multiplier.expenses - 1) * 100).toFixed(0)}%\n\n`;

      // Insights and recommendations
      response += `### 💡 Insights\n`;

      if (endingBalance > currentBalance * 1.2) {
        response += `- 📈 **Growing cash position** - consider strategic investments\n`;
      } else if (endingBalance < currentBalance * 0.8) {
        response += `- ⚠️ **Declining cash position** - review cost structure\n`;
      }

      if (monthsUntilZero > 0 && monthsUntilZero <= forecastMonths) {
        response += `- 🚨 **Cash runway risk** - projected to run out in ${monthsUntilZero} months\n`;
        response += `- Action needed: Reduce expenses or increase revenue\n`;
      }

      if (lowestBalance < currentBalance * 0.3) {
        response += `- ⚠️ **Low cash warning** at ${formatCurrency(lowestBalance)} - maintain buffer\n`;
      }

      const avgMonthlyGrowth =
        forecasts.length > 1
          ? (forecasts[forecasts.length - 1].projectedRevenue - forecasts[0].projectedRevenue) /
            (forecasts.length - 1)
          : 0;
      if (avgMonthlyGrowth > 0) {
        response += `- 📊 Projected monthly revenue growth: ${formatCurrency(avgMonthlyGrowth)}\n`;
      }

      return response;
    } catch (error) {
      console.error("Error generating forecast:", error);
      return `❌ Error generating forecast: ${error instanceof Error ? error.message : "Unknown error"}`;
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
