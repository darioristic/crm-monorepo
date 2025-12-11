/**
 * Research Agent Tools
 * Tools for market research, product comparison, and affordability analysis
 */

import { tool } from "ai";
import { z } from "zod";
import { sql } from "../../db/client";

// ==============================================
// Compare Products Tool
// ==============================================

const compareProductsSchema = z.object({
  tenantId: z.string().describe("The tenant ID"),
  productIds: z.array(z.string()).describe("Product IDs to compare").optional(),
  category: z.string().describe("Product category to compare within").optional(),
  criteria: z
    .array(z.string())
    .describe("Comparison criteria: price, features, margin, popularity")
    .optional(),
});

type CompareProductsParams = z.infer<typeof compareProductsSchema>;

export const compareProductsTool = tool({
  description:
    "Compare multiple products by features, price, margin, and value. Use for product selection decisions.",
  parameters: compareProductsSchema,
  execute: async (params: CompareProductsParams): Promise<string> => {
    const { tenantId, productIds, category } = params;

    try {
      let query;
      if (productIds && productIds.length > 0) {
        query = sql`
          SELECT
            p.id, p.name, p.sku, p.description,
            p.unit_price, p.cost_price,
            CASE WHEN p.cost_price > 0 THEN
              ROUND(((p.unit_price - p.cost_price) / p.cost_price * 100)::numeric, 2)
            ELSE 0 END as margin_percent,
            p.unit, p.tax_rate,
            pc.name as category_name,
            p.status,
            (SELECT COUNT(*) FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             WHERE oi.product_id = p.id AND o.tenant_id = ${tenantId}) as times_ordered,
            (SELECT COALESCE(SUM(oi.quantity * oi.unit_price), 0) FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             WHERE oi.product_id = p.id AND o.tenant_id = ${tenantId}) as total_revenue
          FROM products p
          LEFT JOIN product_categories pc ON p.category_id = pc.id
          WHERE p.tenant_id = ${tenantId}
            AND p.id = ANY(${productIds}::uuid[])
          ORDER BY total_revenue DESC
        `;
      } else if (category) {
        query = sql`
          SELECT
            p.id, p.name, p.sku, p.description,
            p.unit_price, p.cost_price,
            CASE WHEN p.cost_price > 0 THEN
              ROUND(((p.unit_price - p.cost_price) / p.cost_price * 100)::numeric, 2)
            ELSE 0 END as margin_percent,
            p.unit, p.tax_rate,
            pc.name as category_name,
            p.status,
            (SELECT COUNT(*) FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             WHERE oi.product_id = p.id AND o.tenant_id = ${tenantId}) as times_ordered,
            (SELECT COALESCE(SUM(oi.quantity * oi.unit_price), 0) FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             WHERE oi.product_id = p.id AND o.tenant_id = ${tenantId}) as total_revenue
          FROM products p
          LEFT JOIN product_categories pc ON p.category_id = pc.id
          WHERE p.tenant_id = ${tenantId}
            AND pc.slug = ${category}
          ORDER BY total_revenue DESC
          LIMIT 10
        `;
      } else {
        query = sql`
          SELECT
            p.id, p.name, p.sku,
            p.unit_price, p.cost_price,
            CASE WHEN p.cost_price > 0 THEN
              ROUND(((p.unit_price - p.cost_price) / p.cost_price * 100)::numeric, 2)
            ELSE 0 END as margin_percent,
            pc.name as category_name,
            (SELECT COUNT(*) FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             WHERE oi.product_id = p.id AND o.tenant_id = ${tenantId}) as times_ordered,
            (SELECT COALESCE(SUM(oi.quantity * oi.unit_price), 0) FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             WHERE oi.product_id = p.id AND o.tenant_id = ${tenantId}) as total_revenue
          FROM products p
          LEFT JOIN product_categories pc ON p.category_id = pc.id
          WHERE p.tenant_id = ${tenantId}
            AND p.status = 'active'
          ORDER BY total_revenue DESC
          LIMIT 10
        `;
      }

      const products = await query;

      if (products.length === 0) {
        return "No products found matching the criteria.";
      }

      let response = `## 📊 Product Comparison\n\n`;
      response += `| Product | Price | Cost | Margin | Orders | Revenue |\n`;
      response += `|---------|-------|------|--------|--------|--------|\n`;

      for (const p of products) {
        response += `| ${p.name} | €${Number(p.unit_price).toFixed(2)} | €${Number(p.cost_price || 0).toFixed(2)} | ${p.margin_percent}% | ${p.times_ordered} | €${Number(p.total_revenue).toFixed(2)} |\n`;
      }

      // Add summary insights
      const avgPrice = products.reduce((sum, p) => sum + Number(p.unit_price), 0) / products.length;
      const avgMargin =
        products.reduce((sum, p) => sum + Number(p.margin_percent || 0), 0) / products.length;
      const totalRevenue = products.reduce((sum, p) => sum + Number(p.total_revenue), 0);

      response += `\n### Summary\n`;
      response += `- **Average Price:** €${avgPrice.toFixed(2)}\n`;
      response += `- **Average Margin:** ${avgMargin.toFixed(1)}%\n`;
      response += `- **Total Revenue:** €${totalRevenue.toFixed(2)}\n`;

      return response;
    } catch (error) {
      console.error("Error comparing products:", error);
      return `Error comparing products: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});

// ==============================================
// Analyze Affordability Tool
// ==============================================

const analyzeAffordabilitySchema = z.object({
  tenantId: z.string().describe("The tenant ID"),
  purchaseAmount: z.number().describe("The amount of the potential purchase"),
  purchaseDescription: z.string().describe("What is being purchased").optional(),
  isRecurring: z.boolean().describe("Is this a recurring expense").default(false),
});

type AnalyzeAffordabilityParams = z.infer<typeof analyzeAffordabilitySchema>;

export const analyzeAffordabilityTool = tool({
  description:
    "Analyze if a purchase fits within the budget and financial capacity. Use before major purchasing decisions.",
  parameters: analyzeAffordabilitySchema,
  execute: async (params: AnalyzeAffordabilityParams): Promise<string> => {
    const { tenantId, purchaseAmount, purchaseDescription, isRecurring } = params;

    try {
      // Get current financial position
      const financials = await sql`
        WITH monthly_data AS (
          SELECT
            COALESCE(SUM(CASE WHEN p.amount > 0 THEN p.amount ELSE 0 END), 0) as income,
            COALESCE(SUM(CASE WHEN p.amount < 0 THEN ABS(p.amount) ELSE 0 END), 0) as expenses
          FROM payments p
          JOIN invoices i ON p.invoice_id = i.id
          WHERE i.tenant_id = ${tenantId}
            AND p.date >= NOW() - INTERVAL '3 months'
        ),
        balance AS (
          SELECT COALESCE(SUM(p.amount), 0) as current_balance
          FROM payments p
          JOIN invoices i ON p.invoice_id = i.id
          WHERE i.tenant_id = ${tenantId}
        ),
        pending AS (
          SELECT COALESCE(SUM(i.total_amount - i.paid_amount), 0) as pending_receivables
          FROM invoices i
          WHERE i.tenant_id = ${tenantId}
            AND i.status IN ('sent', 'overdue')
        )
        SELECT
          m.income / 3 as avg_monthly_income,
          m.expenses / 3 as avg_monthly_expenses,
          m.income / 3 - m.expenses / 3 as avg_monthly_surplus,
          b.current_balance,
          p.pending_receivables
        FROM monthly_data m, balance b, pending p
      `;

      const data = financials[0] || {
        avg_monthly_income: 0,
        avg_monthly_expenses: 0,
        avg_monthly_surplus: 0,
        current_balance: 0,
        pending_receivables: 0,
      };

      const monthlyIncome = Number(data.avg_monthly_income) || 0;
      const monthlyExpenses = Number(data.avg_monthly_expenses) || 0;
      const monthlySurplus = Number(data.avg_monthly_surplus) || 0;
      const currentBalance = Number(data.current_balance) || 0;
      const pendingReceivables = Number(data.pending_receivables) || 0;

      // Calculate affordability metrics
      const purchaseAsPercentOfBalance =
        currentBalance > 0 ? (purchaseAmount / currentBalance) * 100 : 100;
      const purchaseAsPercentOfMonthlyIncome =
        monthlyIncome > 0 ? (purchaseAmount / monthlyIncome) * 100 : 100;
      const monthsToSave = monthlySurplus > 0 ? purchaseAmount / monthlySurplus : Infinity;

      let affordabilityScore: "High" | "Medium" | "Low" | "Not Recommended";
      let recommendation: string;

      if (purchaseAmount <= currentBalance * 0.1 && purchaseAmount <= monthlySurplus) {
        affordabilityScore = "High";
        recommendation = "This purchase is well within budget. Safe to proceed.";
      } else if (
        purchaseAmount <= currentBalance * 0.25 &&
        purchaseAmount <= monthlySurplus * 3
      ) {
        affordabilityScore = "Medium";
        recommendation = "Affordable but significant. Consider timing and cash flow impact.";
      } else if (purchaseAmount <= currentBalance * 0.5) {
        affordabilityScore = "Low";
        recommendation =
          "This will significantly impact cash reserves. Consider alternatives or payment plans.";
      } else {
        affordabilityScore = "Not Recommended";
        recommendation =
          "This purchase exceeds safe spending limits. Consider postponing or finding alternatives.";
      }

      let response = `## 💰 Affordability Analysis\n\n`;
      response += `**Purchase:** ${purchaseDescription || "Unnamed purchase"}\n`;
      response += `**Amount:** €${purchaseAmount.toLocaleString()}\n`;
      response += `**Type:** ${isRecurring ? "Recurring" : "One-time"}\n\n`;

      response += `### Financial Position\n`;
      response += `| Metric | Value |\n`;
      response += `|--------|-------|\n`;
      response += `| Current Balance | €${currentBalance.toLocaleString()} |\n`;
      response += `| Avg Monthly Income | €${monthlyIncome.toLocaleString()} |\n`;
      response += `| Avg Monthly Expenses | €${monthlyExpenses.toLocaleString()} |\n`;
      response += `| Avg Monthly Surplus | €${monthlySurplus.toLocaleString()} |\n`;
      response += `| Pending Receivables | €${pendingReceivables.toLocaleString()} |\n\n`;

      response += `### Assessment\n`;
      response += `| Factor | Value |\n`;
      response += `|--------|-------|\n`;
      response += `| % of Current Balance | ${purchaseAsPercentOfBalance.toFixed(1)}% |\n`;
      response += `| % of Monthly Income | ${purchaseAsPercentOfMonthlyIncome.toFixed(1)}% |\n`;
      response += `| Months to Save | ${monthsToSave === Infinity ? "N/A" : monthsToSave.toFixed(1)} |\n`;
      response += `| **Affordability Score** | **${affordabilityScore}** |\n\n`;

      response += `### Recommendation\n${recommendation}\n`;

      if (isRecurring) {
        const annualCost = purchaseAmount * 12;
        const impactOnSurplus =
          monthlySurplus > 0 ? ((purchaseAmount / monthlySurplus) * 100).toFixed(1) : "N/A";
        response += `\n### Recurring Cost Impact\n`;
        response += `- Annual cost: €${annualCost.toLocaleString()}\n`;
        response += `- Monthly surplus reduction: ${impactOnSurplus}%\n`;
      }

      return response;
    } catch (error) {
      console.error("Error analyzing affordability:", error);
      return `Error analyzing affordability: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});

// ==============================================
// Market Research Tool
// ==============================================

const marketResearchSchema = z.object({
  tenantId: z.string().describe("The tenant ID"),
  topic: z.string().describe("Research topic: customers, products, revenue, industry").optional(),
});

type MarketResearchParams = z.infer<typeof marketResearchSchema>;

export const marketResearchTool = tool({
  description:
    "Get market data, customer insights, and industry trends based on internal data. Use for market understanding.",
  parameters: marketResearchSchema,
  execute: async (params: MarketResearchParams): Promise<string> => {
    const { tenantId, topic } = params;

    try {
      // Get customer distribution by industry
      const customersByIndustry = await sql`
        SELECT
          COALESCE(industry, 'Unknown') as industry,
          COUNT(*) as count,
          COALESCE(SUM(
            (SELECT COALESCE(SUM(total_amount), 0) FROM invoices
             WHERE company_id = c.id AND tenant_id = ${tenantId})
          ), 0) as total_revenue
        FROM companies c
        WHERE c.tenant_id = ${tenantId}
          AND c.type = 'customer'
        GROUP BY industry
        ORDER BY total_revenue DESC
        LIMIT 10
      `;

      // Get revenue trends
      const revenueTrends = await sql`
        SELECT
          TO_CHAR(DATE_TRUNC('month', i.issue_date), 'YYYY-MM') as month,
          COUNT(*) as invoice_count,
          COALESCE(SUM(i.total_amount), 0) as revenue,
          COUNT(DISTINCT i.company_id) as unique_customers
        FROM invoices i
        WHERE i.tenant_id = ${tenantId}
          AND i.issue_date >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', i.issue_date)
        ORDER BY month DESC
        LIMIT 12
      `;

      // Get product performance
      const topProducts = await sql`
        SELECT
          p.name,
          COUNT(DISTINCT o.id) as order_count,
          COALESCE(SUM(oi.quantity), 0) as units_sold,
          COALESCE(SUM(oi.quantity * oi.unit_price), 0) as revenue
        FROM products p
        JOIN order_items oi ON p.id = oi.product_id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.tenant_id = ${tenantId}
          AND o.created_at >= NOW() - INTERVAL '6 months'
        GROUP BY p.id, p.name
        ORDER BY revenue DESC
        LIMIT 5
      `;

      let response = `## 📈 Market Research Report\n\n`;

      // Customer Analysis
      response += `### Customer Distribution by Industry\n`;
      response += `| Industry | Customers | Revenue |\n`;
      response += `|----------|-----------|--------|\n`;
      for (const row of customersByIndustry) {
        response += `| ${row.industry} | ${row.count} | €${Number(row.total_revenue).toLocaleString()} |\n`;
      }

      // Revenue Trends
      response += `\n### Monthly Revenue Trends (Last 12 Months)\n`;
      response += `| Month | Invoices | Revenue | Customers |\n`;
      response += `|-------|----------|---------|----------|\n`;
      for (const row of revenueTrends.slice(0, 6)) {
        response += `| ${row.month} | ${row.invoice_count} | €${Number(row.revenue).toLocaleString()} | ${row.unique_customers} |\n`;
      }

      // Calculate growth
      if (revenueTrends.length >= 2) {
        const currentMonth = Number(revenueTrends[0]?.revenue) || 0;
        const prevMonth = Number(revenueTrends[1]?.revenue) || 0;
        const growth = prevMonth > 0 ? ((currentMonth - prevMonth) / prevMonth) * 100 : 0;
        response += `\n**Month-over-Month Growth:** ${growth > 0 ? "📈" : "📉"} ${growth.toFixed(1)}%\n`;
      }

      // Top Products
      response += `\n### Top Performing Products\n`;
      response += `| Product | Orders | Units | Revenue |\n`;
      response += `|---------|--------|-------|--------|\n`;
      for (const row of topProducts) {
        response += `| ${row.name} | ${row.order_count} | ${row.units_sold} | €${Number(row.revenue).toLocaleString()} |\n`;
      }

      return response;
    } catch (error) {
      console.error("Error in market research:", error);
      return `Error in market research: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});

// ==============================================
// Price Comparison Tool
// ==============================================

const priceComparisonSchema = z.object({
  tenantId: z.string().describe("The tenant ID"),
  productId: z.string().describe("Product ID to analyze pricing for").optional(),
  category: z.string().describe("Category to analyze pricing across").optional(),
});

type PriceComparisonParams = z.infer<typeof priceComparisonSchema>;

export const priceComparisonTool = tool({
  description: "Compare prices across products and analyze pricing trends. Use for pricing decisions.",
  parameters: priceComparisonSchema,
  execute: async (params: PriceComparisonParams): Promise<string> => {
    const { tenantId, productId, category } = params;

    try {
      // Get pricing data with historical from quote/order items
      const pricingData = await sql`
        WITH product_prices AS (
          SELECT
            p.id,
            p.name,
            p.unit_price as current_price,
            p.cost_price,
            pc.name as category_name,
            COALESCE(AVG(qi.unit_price), p.unit_price) as avg_quoted_price,
            COALESCE(AVG(oi.unit_price), p.unit_price) as avg_sold_price,
            COUNT(DISTINCT qi.id) as quote_count,
            COUNT(DISTINCT oi.id) as order_count
          FROM products p
          LEFT JOIN product_categories pc ON p.category_id = pc.id
          LEFT JOIN quote_items qi ON p.id = qi.product_id
          LEFT JOIN quotes q ON qi.quote_id = q.id AND q.tenant_id = ${tenantId}
          LEFT JOIN order_items oi ON p.id = oi.product_id
          LEFT JOIN orders o ON oi.order_id = o.id AND o.tenant_id = ${tenantId}
          WHERE p.tenant_id = ${tenantId}
            AND p.status = 'active'
            ${productId ? sql`AND p.id = ${productId}::uuid` : sql``}
            ${category ? sql`AND pc.slug = ${category}` : sql``}
          GROUP BY p.id, p.name, p.unit_price, p.cost_price, pc.name
        )
        SELECT
          *,
          CASE WHEN cost_price > 0 THEN
            ROUND(((current_price - cost_price) / cost_price * 100)::numeric, 2)
          ELSE 0 END as margin_percent,
          CASE WHEN current_price > 0 THEN
            ROUND(((avg_sold_price - current_price) / current_price * 100)::numeric, 2)
          ELSE 0 END as discount_avg
        FROM product_prices
        ORDER BY order_count DESC
        LIMIT 15
      `;

      if (pricingData.length === 0) {
        return "No pricing data found for the specified criteria.";
      }

      let response = `## 💵 Price Analysis\n\n`;
      response += `| Product | List Price | Avg Sold | Margin | Discount |\n`;
      response += `|---------|------------|----------|--------|----------|\n`;

      for (const row of pricingData) {
        const discountIndicator = Number(row.discount_avg) < 0 ? "📉" : "➡️";
        response += `| ${row.name} | €${Number(row.current_price).toFixed(2)} | €${Number(row.avg_sold_price).toFixed(2)} | ${row.margin_percent}% | ${discountIndicator} ${Math.abs(Number(row.discount_avg)).toFixed(1)}% |\n`;
      }

      // Summary statistics
      const avgMargin =
        pricingData.reduce((sum, p) => sum + Number(p.margin_percent || 0), 0) / pricingData.length;
      const avgDiscount =
        pricingData.reduce((sum, p) => sum + Number(p.discount_avg || 0), 0) / pricingData.length;

      response += `\n### Summary\n`;
      response += `- **Average Margin:** ${avgMargin.toFixed(1)}%\n`;
      response += `- **Average Discount Given:** ${avgDiscount.toFixed(1)}%\n`;
      response += `- **Products Analyzed:** ${pricingData.length}\n`;

      return response;
    } catch (error) {
      console.error("Error in price comparison:", error);
      return `Error in price comparison: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});
