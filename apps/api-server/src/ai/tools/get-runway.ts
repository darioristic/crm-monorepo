/**
 * Runway AI Tool
 * Calculate financial runway and survival projections
 */

import { tool } from "ai";
import { z } from "zod";
import { sql } from "../../db/client";

const getRunwaySchema = z.object({
  tenantId: z.string().describe("The tenant ID to analyze"),
  includeScenarios: z.boolean().optional().describe("Include best/worst case scenarios"),
  growthRate: z.number().optional().describe("Expected monthly growth rate (e.g., 0.1 for 10%)"),
});

type GetRunwayParams = z.infer<typeof getRunwaySchema>;

interface RunwayScenario {
  name: string;
  months: number;
  description: string;
  assumptions: string[];
}

export const getRunwayTool = tool({
  description:
    "Calculate financial runway - how many months until funds run out. Includes multiple scenarios based on spending patterns.",
  inputSchema: getRunwaySchema,
  execute: async (input: GetRunwayParams): Promise<string> => {
    const { tenantId, includeScenarios = true, growthRate } = input;

    try {
      // Get current cash position
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

      // Get monthly expenses over last 6 months
      const expensesResult = await sql`
        SELECT
          TO_CHAR(DATE_TRUNC('month', p.date), 'YYYY-MM') as month,
          SUM(ABS(p.amount_in_base_currency)) as expenses
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE i.tenant_id = ${tenantId}
          AND p.is_expense = true
          AND p.date >= NOW() - INTERVAL '6 months'
          AND p.status = 'completed'
        GROUP BY DATE_TRUNC('month', p.date)
        ORDER BY month DESC
      `;

      // Get monthly income over last 6 months
      const incomeResult = await sql`
        SELECT
          TO_CHAR(DATE_TRUNC('month', p.date), 'YYYY-MM') as month,
          SUM(ABS(p.amount_in_base_currency)) as income
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE i.tenant_id = ${tenantId}
          AND p.is_expense = false
          AND p.date >= NOW() - INTERVAL '6 months'
          AND p.status = 'completed'
        GROUP BY DATE_TRUNC('month', p.date)
        ORDER BY month DESC
      `;

      const monthlyExpenses = expensesResult.map((r) => Number(r.expenses) || 0);
      const monthlyIncome = incomeResult.map((r) => Number(r.income) || 0);

      const avgExpenses =
        monthlyExpenses.length > 0
          ? monthlyExpenses.reduce((a, b) => a + b, 0) / monthlyExpenses.length
          : 0;

      const avgIncome =
        monthlyIncome.length > 0
          ? monthlyIncome.reduce((a, b) => a + b, 0) / monthlyIncome.length
          : 0;

      const netBurn = avgExpenses - avgIncome;

      // Calculate expense volatility
      const expenseVariance =
        monthlyExpenses.length > 1
          ? monthlyExpenses.reduce((sum, exp) => sum + (exp - avgExpenses) ** 2, 0) /
            monthlyExpenses.length
          : 0;
      const expenseStdDev = Math.sqrt(expenseVariance);

      // Calculate base runway
      const baseRunway = netBurn > 0 ? Math.floor(currentBalance / netBurn) : Infinity;

      // Build scenarios
      const scenarios: RunwayScenario[] = [];

      // Base case
      scenarios.push({
        name: "Base Case",
        months: baseRunway,
        description: "Current spending patterns continue",
        assumptions: [
          `Average monthly expenses: ${formatCurrency(avgExpenses)}`,
          `Average monthly income: ${formatCurrency(avgIncome)}`,
          `Net monthly burn: ${formatCurrency(netBurn)}`,
        ],
      });

      if (includeScenarios) {
        // Best case (10% expense reduction)
        const bestCaseBurn = avgExpenses * 0.9 - avgIncome;
        const bestCaseRunway =
          bestCaseBurn > 0 ? Math.floor(currentBalance / bestCaseBurn) : Infinity;
        scenarios.push({
          name: "🟢 Best Case",
          months: bestCaseRunway,
          description: "10% expense reduction",
          assumptions: [
            "Successful cost optimization",
            "No unexpected expenses",
            "Income remains stable",
          ],
        });

        // Worst case (expenses + 1 std dev)
        const worstCaseExpenses = avgExpenses + expenseStdDev;
        const worstCaseBurn = worstCaseExpenses - avgIncome;
        const worstCaseRunway =
          worstCaseBurn > 0 ? Math.floor(currentBalance / worstCaseBurn) : Infinity;
        scenarios.push({
          name: "🔴 Worst Case",
          months: worstCaseRunway,
          description: "Higher expense variance",
          assumptions: [
            "Expenses increase by one standard deviation",
            "Possible unexpected costs",
            "Income may decrease",
          ],
        });

        // Growth scenario (if growthRate provided)
        if (growthRate !== undefined) {
          const growthIncome = avgIncome * (1 + growthRate);
          const growthBurn = avgExpenses - growthIncome;
          const growthRunway = growthBurn > 0 ? Math.floor(currentBalance / growthBurn) : Infinity;
          scenarios.push({
            name: "📈 Growth Scenario",
            months: growthRunway,
            description: `${(growthRate * 100).toFixed(0)}% income growth`,
            assumptions: [
              `Revenue grows ${(growthRate * 100).toFixed(0)}% per month`,
              "Expenses remain constant",
              "Growth is sustainable",
            ],
          });
        }
      }

      // Get recurring expenses
      const recurringResult = await sql`
        SELECT
          COALESCE(p.merchant_name, p.description) as expense_name,
          AVG(ABS(p.amount_in_base_currency)) as avg_amount,
          COUNT(*) as occurrences
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE i.tenant_id = ${tenantId}
          AND p.is_expense = true
          AND p.is_recurring = true
          AND p.date >= NOW() - INTERVAL '6 months'
        GROUP BY COALESCE(p.merchant_name, p.description)
        HAVING COUNT(*) >= 2
        ORDER BY avg_amount DESC
        LIMIT 5
      `;

      // Format response
      let response = `## 🛫 Financial Runway Analysis\n\n`;

      // Key metrics
      response += `### Current Position\n`;
      response += `| Metric | Value |\n`;
      response += `|--------|-------|\n`;
      response += `| 💰 Current Balance | ${formatCurrency(currentBalance)} |\n`;
      response += `| 📉 Avg Monthly Expenses | ${formatCurrency(avgExpenses)} |\n`;
      response += `| 📈 Avg Monthly Income | ${formatCurrency(avgIncome)} |\n`;
      response += `| 🔥 Net Monthly Burn | ${formatCurrency(netBurn)} |\n`;
      response += `| 📊 Expense Volatility | ${formatCurrency(expenseStdDev)} |\n\n`;

      // Runway visualization
      const runwayEmoji =
        baseRunway === Infinity
          ? "♾️"
          : baseRunway > 12
            ? "🟢"
            : baseRunway > 6
              ? "🟡"
              : baseRunway > 3
                ? "🟠"
                : "🔴";

      response += `### Runway Estimate\n`;
      response += `**${runwayEmoji} ${baseRunway === Infinity ? "Infinite (profitable!)" : `${baseRunway} months`}**\n\n`;

      if (baseRunway !== Infinity && baseRunway <= 12) {
        const runoutDate = new Date();
        runoutDate.setMonth(runoutDate.getMonth() + baseRunway);
        response += `⚠️ *Projected to run out: ${runoutDate.toLocaleDateString("en-US", { year: "numeric", month: "long" })}*\n\n`;
      }

      // Scenarios
      if (scenarios.length > 1) {
        response += `### Scenario Analysis\n`;
        response += `| Scenario | Runway | Description |\n`;
        response += `|----------|--------|-------------|\n`;

        for (const scenario of scenarios) {
          const months = scenario.months === Infinity ? "∞" : `${scenario.months}mo`;
          response += `| ${scenario.name} | ${months} | ${scenario.description} |\n`;
        }
        response += `\n`;
      }

      // Recurring expenses
      if (recurringResult.length > 0) {
        response += `### Top Recurring Expenses\n`;
        response += `| Expense | Avg Amount | Frequency |\n`;
        response += `|---------|------------|------------|\n`;

        for (const expense of recurringResult) {
          response += `| ${expense.expense_name} | ${formatCurrency(Number(expense.avg_amount))} | ${expense.occurrences}x/6mo |\n`;
        }
        response += `\n`;
      }

      // Recommendations
      response += `### 💡 Recommendations\n`;
      if (baseRunway === Infinity) {
        response += `- ✅ Business is currently profitable\n`;
        response += `- Consider investing surplus in growth\n`;
        response += `- Build emergency reserve of 3-6 months expenses\n`;
      } else if (baseRunway > 12) {
        response += `- ✅ Healthy runway, continue monitoring\n`;
        response += `- Focus on revenue growth to extend runway\n`;
        response += `- Review large recurring expenses for optimization\n`;
      } else if (baseRunway > 6) {
        response += `- ⚠️ Start planning for fundraising or cost cuts\n`;
        response += `- Identify 10-20% cost reduction opportunities\n`;
        response += `- Accelerate revenue generation efforts\n`;
      } else {
        response += `- 🚨 **Critical runway - immediate action needed**\n`;
        response += `- Cut non-essential expenses immediately\n`;
        response += `- Seek bridge financing or emergency funding\n`;
        response += `- Consider pivoting to faster revenue model\n`;
      }

      return response;
    } catch (error) {
      console.error("Error calculating runway:", error);
      return `❌ Error calculating runway: ${error instanceof Error ? error.message : "Unknown error"}`;
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
