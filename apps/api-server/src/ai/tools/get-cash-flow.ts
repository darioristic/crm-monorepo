/**
 * Cash Flow AI Tool
 * Analyze cash flow patterns, inflows, and outflows
 */

import { tool } from "ai";
import { z } from "zod";
import { sql } from "../../db/client";

const getCashFlowSchema = z.object({
  tenantId: z.string().describe("The tenant ID to analyze"),
  period: z.enum(["week", "month", "quarter", "year"]).default("month").describe("Analysis period"),
  compareWithPrevious: z.boolean().default(true).describe("Compare with previous period"),
});

type GetCashFlowParams = z.infer<typeof getCashFlowSchema>;

export const getCashFlowTool = tool({
  description: "Analyze cash flow patterns including inflows, outflows, net flow, and trends. Useful for understanding money movement.",
  parameters: getCashFlowSchema,
  execute: async (params: GetCashFlowParams): Promise<string> => {
    const { tenantId, period, compareWithPrevious } = params;

    try {
      // Determine date ranges based on period
      const periodDays = {
        week: 7,
        month: 30,
        quarter: 90,
        year: 365,
      };
      const days = periodDays[period];

      // Current period data
      const currentPeriod = await sql`
        SELECT
          COALESCE(SUM(CASE WHEN p.is_expense = false THEN ABS(p.amount_in_base_currency) ELSE 0 END), 0) as inflows,
          COALESCE(SUM(CASE WHEN p.is_expense = true THEN ABS(p.amount_in_base_currency) ELSE 0 END), 0) as outflows,
          COUNT(CASE WHEN p.is_expense = false THEN 1 END) as inflow_count,
          COUNT(CASE WHEN p.is_expense = true THEN 1 END) as outflow_count
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE i.tenant_id = ${tenantId}
          AND p.date >= NOW() - INTERVAL '${days} days'
          AND p.status = 'completed'
      `;

      // Previous period data for comparison
      const previousPeriod = compareWithPrevious ? await sql`
        SELECT
          COALESCE(SUM(CASE WHEN p.is_expense = false THEN ABS(p.amount_in_base_currency) ELSE 0 END), 0) as inflows,
          COALESCE(SUM(CASE WHEN p.is_expense = true THEN ABS(p.amount_in_base_currency) ELSE 0 END), 0) as outflows
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE i.tenant_id = ${tenantId}
          AND p.date >= NOW() - INTERVAL '${days * 2} days'
          AND p.date < NOW() - INTERVAL '${days} days'
          AND p.status = 'completed'
      ` : null;

      // Daily cash flow for the period
      const dailyFlow = await sql`
        SELECT
          DATE(p.date) as day,
          COALESCE(SUM(CASE WHEN p.is_expense = false THEN ABS(p.amount_in_base_currency) ELSE -ABS(p.amount_in_base_currency) END), 0) as net_flow
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE i.tenant_id = ${tenantId}
          AND p.date >= NOW() - INTERVAL '${days} days'
          AND p.status = 'completed'
        GROUP BY DATE(p.date)
        ORDER BY day ASC
      `;

      // Top inflow sources
      const topInflows = await sql`
        SELECT
          COALESCE(p.merchant_name, p.description, 'Unknown') as source,
          SUM(ABS(p.amount_in_base_currency)) as amount,
          COUNT(*) as transactions
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE i.tenant_id = ${tenantId}
          AND p.is_expense = false
          AND p.date >= NOW() - INTERVAL '${days} days'
          AND p.status = 'completed'
        GROUP BY COALESCE(p.merchant_name, p.description, 'Unknown')
        ORDER BY amount DESC
        LIMIT 5
      `;

      // Top outflow destinations
      const topOutflows = await sql`
        SELECT
          COALESCE(p.merchant_name, p.category, p.description, 'Unknown') as destination,
          SUM(ABS(p.amount_in_base_currency)) as amount,
          COUNT(*) as transactions
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE i.tenant_id = ${tenantId}
          AND p.is_expense = true
          AND p.date >= NOW() - INTERVAL '${days} days'
          AND p.status = 'completed'
        GROUP BY COALESCE(p.merchant_name, p.category, p.description, 'Unknown')
        ORDER BY amount DESC
        LIMIT 5
      `;

      // Calculate metrics
      const inflows = Number(currentPeriod[0]?.inflows) || 0;
      const outflows = Number(currentPeriod[0]?.outflows) || 0;
      const netFlow = inflows - outflows;
      const inflowCount = Number(currentPeriod[0]?.inflow_count) || 0;
      const outflowCount = Number(currentPeriod[0]?.outflow_count) || 0;

      const prevInflows = previousPeriod ? Number(previousPeriod[0]?.inflows) || 0 : 0;
      const prevOutflows = previousPeriod ? Number(previousPeriod[0]?.outflows) || 0 : 0;

      // Calculate changes
      const inflowChange = prevInflows > 0 ? ((inflows - prevInflows) / prevInflows) * 100 : 0;
      const outflowChange = prevOutflows > 0 ? ((outflows - prevOutflows) / prevOutflows) * 100 : 0;

      // Calculate volatility (standard deviation of daily net flow)
      const dailyNetFlows = dailyFlow.map(d => Number(d.net_flow) || 0);
      const avgDailyFlow = dailyNetFlows.length > 0
        ? dailyNetFlows.reduce((a, b) => a + b, 0) / dailyNetFlows.length
        : 0;
      const variance = dailyNetFlows.length > 1
        ? dailyNetFlows.reduce((sum, flow) => sum + Math.pow(flow - avgDailyFlow, 2), 0) / dailyNetFlows.length
        : 0;
      const volatility = Math.sqrt(variance);

      // Identify positive and negative days
      const positiveDays = dailyNetFlows.filter(f => f > 0).length;
      const negativeDays = dailyNetFlows.filter(f => f < 0).length;

      // Format response
      let response = `## 💸 Cash Flow Analysis\n\n`;
      response += `**Period:** Last ${period}\n\n`;

      // Summary metrics
      response += `### Summary\n`;
      response += `| Metric | Amount | Change |\n`;
      response += `|--------|--------|--------|\n`;
      response += `| 📥 Total Inflows | ${formatCurrency(inflows)} | ${formatChange(inflowChange)} |\n`;
      response += `| 📤 Total Outflows | ${formatCurrency(outflows)} | ${formatChange(outflowChange)} |\n`;
      response += `| ${netFlow >= 0 ? '🟢' : '🔴'} Net Cash Flow | ${formatCurrency(netFlow)} | - |\n\n`;

      // Transaction counts
      response += `### Transaction Volume\n`;
      response += `- **Inflows:** ${inflowCount} transactions (avg ${formatCurrency(inflowCount > 0 ? inflows / inflowCount : 0)})\n`;
      response += `- **Outflows:** ${outflowCount} transactions (avg ${formatCurrency(outflowCount > 0 ? outflows / outflowCount : 0)})\n\n`;

      // Cash flow health indicators
      response += `### Health Indicators\n`;
      const inflowOutflowRatio = outflows > 0 ? inflows / outflows : Infinity;
      const ratioEmoji = inflowOutflowRatio >= 1.2 ? '🟢' : inflowOutflowRatio >= 1 ? '🟡' : '🔴';
      response += `- **Inflow/Outflow Ratio:** ${ratioEmoji} ${inflowOutflowRatio.toFixed(2)}x\n`;
      response += `- **Daily Volatility:** ${formatCurrency(volatility)}\n`;
      response += `- **Positive Days:** ${positiveDays}/${dailyNetFlows.length} (${((positiveDays / Math.max(dailyNetFlows.length, 1)) * 100).toFixed(0)}%)\n\n`;

      // Top inflow sources
      if (topInflows.length > 0) {
        response += `### 📥 Top Inflow Sources\n`;
        response += `| Source | Amount | Count |\n`;
        response += `|--------|--------|-------|\n`;

        for (const source of topInflows) {
          const pct = inflows > 0 ? ((Number(source.amount) / inflows) * 100).toFixed(0) : '0';
          response += `| ${truncate(String(source.source), 25)} | ${formatCurrency(Number(source.amount))} (${pct}%) | ${source.transactions} |\n`;
        }
        response += `\n`;
      }

      // Top outflow destinations
      if (topOutflows.length > 0) {
        response += `### 📤 Top Outflow Categories\n`;
        response += `| Category | Amount | Count |\n`;
        response += `|----------|--------|-------|\n`;

        for (const dest of topOutflows) {
          const pct = outflows > 0 ? ((Number(dest.amount) / outflows) * 100).toFixed(0) : '0';
          response += `| ${truncate(String(dest.destination), 25)} | ${formatCurrency(Number(dest.amount))} (${pct}%) | ${dest.transactions} |\n`;
        }
        response += `\n`;
      }

      // Cash flow trend (simple sparkline-like representation)
      if (dailyNetFlows.length > 7) {
        response += `### Daily Trend\n`;
        const weeklyFlows = [];
        for (let i = 0; i < dailyNetFlows.length; i += 7) {
          const weekSum = dailyNetFlows.slice(i, i + 7).reduce((a, b) => a + b, 0);
          weeklyFlows.push(weekSum);
        }

        response += `\`\`\`\n`;
        for (let i = 0; i < Math.min(weeklyFlows.length, 4); i++) {
          const bar = weeklyFlows[i] >= 0
            ? '█'.repeat(Math.min(Math.ceil(weeklyFlows[i] / 1000), 20))
            : '▓'.repeat(Math.min(Math.ceil(Math.abs(weeklyFlows[i]) / 1000), 20));
          const label = `Week ${i + 1}`;
          response += `${label}: ${weeklyFlows[i] >= 0 ? '+' : '-'}${bar} ${formatCurrency(Math.abs(weeklyFlows[i]))}\n`;
        }
        response += `\`\`\`\n`;
      }

      // Insights
      response += `### 💡 Insights\n`;
      if (netFlow > 0) {
        response += `- ✅ Positive cash flow of ${formatCurrency(netFlow)} this ${period}\n`;
      } else {
        response += `- ⚠️ Negative cash flow of ${formatCurrency(Math.abs(netFlow))} this ${period}\n`;
      }

      if (inflowChange > 10) {
        response += `- 📈 Inflows increased ${inflowChange.toFixed(0)}% vs previous period\n`;
      } else if (inflowChange < -10) {
        response += `- 📉 Inflows decreased ${Math.abs(inflowChange).toFixed(0)}% vs previous period\n`;
      }

      if (outflowChange > 10) {
        response += `- ⚠️ Outflows increased ${outflowChange.toFixed(0)}% vs previous period\n`;
      } else if (outflowChange < -10) {
        response += `- ✅ Outflows decreased ${Math.abs(outflowChange).toFixed(0)}% vs previous period\n`;
      }

      return response;
    } catch (error) {
      console.error("Error analyzing cash flow:", error);
      return `❌ Error analyzing cash flow: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
});

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatChange(change: number): string {
  if (change === 0) return '-';
  const emoji = change > 0 ? '📈' : '📉';
  return `${emoji} ${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
}
