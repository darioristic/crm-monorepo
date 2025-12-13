/**
 * Transactions Agent Tools
 * Tools for transaction history, analysis, and categorization
 */

import { tool } from "ai";
import { z } from "zod";
import { sql } from "../../db/client";

// ==============================================
// Get Transactions Tool
// ==============================================

const getTransactionsSchema = z.object({
  tenantId: z.string().describe("The tenant ID"),
  startDate: z.string().describe("Start date (YYYY-MM-DD)").optional(),
  endDate: z.string().describe("End date (YYYY-MM-DD)").optional(),
  category: z.string().describe("Filter by category slug").optional(),
  minAmount: z.number().describe("Minimum amount").optional(),
  maxAmount: z.number().describe("Maximum amount").optional(),
  type: z.enum(["income", "expense", "all"]).optional().describe("Transaction type"),
  limit: z.number().optional().describe("Maximum results"),
});

type GetTransactionsParams = z.infer<typeof getTransactionsSchema>;

export const getTransactionsTool = tool({
  description:
    "Search and retrieve transactions (payments) with various filters. Use for transaction history.",
  inputSchema: getTransactionsSchema,
  execute: async (input: GetTransactionsParams): Promise<string> => {
    const {
      tenantId,
      startDate,
      endDate,
      category,
      minAmount,
      maxAmount,
      type = "all",
      limit = 50,
    } = input;

    try {
      const transactions = await sql`
        SELECT
          p.id,
          p.amount,
          p.currency,
          p.date,
          p.method,
          p.reference_number,
          p.notes,
          p.category_slug,
          i.invoice_number,
          c.name as company_name
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        LEFT JOIN companies c ON i.company_id = c.id
        WHERE i.tenant_id = ${tenantId}
          ${startDate ? sql`AND p.date >= ${startDate}::date` : sql``}
          ${endDate ? sql`AND p.date <= ${endDate}::date` : sql``}
          ${category ? sql`AND p.category_slug = ${category}` : sql``}
          ${minAmount ? sql`AND ABS(p.amount) >= ${minAmount}` : sql``}
          ${maxAmount ? sql`AND ABS(p.amount) <= ${maxAmount}` : sql``}
          ${type === "income" ? sql`AND p.amount > 0` : type === "expense" ? sql`AND p.amount < 0` : sql``}
        ORDER BY p.date DESC
        LIMIT ${limit}
      `;

      if (transactions.length === 0) {
        return "No transactions found matching the criteria.";
      }

      // Calculate totals
      let totalIncome = 0;
      let totalExpenses = 0;
      for (const t of transactions) {
        const amount = Number(t.amount) || 0;
        if (amount > 0) totalIncome += amount;
        else totalExpenses += Math.abs(amount);
      }

      let response = `## 💳 Transactions (${transactions.length} found)\n\n`;
      response += `### Summary\n`;
      response += `| Type | Amount |\n`;
      response += `|------|--------|\n`;
      response += `| Income | €${totalIncome.toLocaleString()} |\n`;
      response += `| Expenses | €${totalExpenses.toLocaleString()} |\n`;
      response += `| Net | €${(totalIncome - totalExpenses).toLocaleString()} |\n`;

      response += `\n### Transaction List\n`;
      response += `| Date | Description | Category | Amount |\n`;
      response += `|------|-------------|----------|--------|\n`;

      for (const t of transactions.slice(0, 30)) {
        const date = new Date(t.date as string).toLocaleDateString();
        const amount = Number(t.amount) || 0;
        const amountStr =
          amount >= 0 ? `+€${amount.toLocaleString()}` : `-€${Math.abs(amount).toLocaleString()}`;
        const indicator = amount >= 0 ? "🟢" : "🔴";
        const desc = t.company_name || t.invoice_number || t.notes || "-";
        response += `| ${date} | ${desc.substring(0, 25)} | ${t.category_slug || "-"} | ${indicator} ${amountStr} |\n`;
      }

      return response;
    } catch (error) {
      console.error("Error getting transactions:", error);
      return `Error getting transactions: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});

// ==============================================
// Search Transactions Tool
// ==============================================

const searchTransactionsSchema = z.object({
  tenantId: z.string().describe("The tenant ID"),
  query: z.string().describe("Search term (company name, notes, reference number)"),
  limit: z.number().optional().describe("Maximum results"),
});

type SearchTransactionsParams = z.infer<typeof searchTransactionsSchema>;

export const searchTransactionsTool = tool({
  description:
    "Full-text search across transaction descriptions, companies, and reference numbers.",
  inputSchema: searchTransactionsSchema,
  execute: async (input: SearchTransactionsParams): Promise<string> => {
    const { tenantId, query, limit = 20 } = input;

    try {
      const transactions = await sql`
        SELECT
          p.id,
          p.amount,
          p.date,
          p.notes,
          p.reference_number,
          p.category_slug,
          i.invoice_number,
          c.name as company_name
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        LEFT JOIN companies c ON i.company_id = c.id
        WHERE i.tenant_id = ${tenantId}
          AND (
            c.name ILIKE ${`%${query}%`}
            OR p.notes ILIKE ${`%${query}%`}
            OR p.reference_number ILIKE ${`%${query}%`}
            OR i.invoice_number ILIKE ${`%${query}%`}
          )
        ORDER BY p.date DESC
        LIMIT ${limit}
      `;

      if (transactions.length === 0) {
        return `No transactions found matching "${query}".`;
      }

      let response = `## 🔍 Search Results for "${query}" (${transactions.length} found)\n\n`;
      response += `| Date | Company | Reference | Amount |\n`;
      response += `|------|---------|-----------|--------|\n`;

      for (const t of transactions) {
        const date = new Date(t.date as string).toLocaleDateString();
        const amount = Number(t.amount) || 0;
        const indicator = amount >= 0 ? "🟢" : "🔴";
        response += `| ${date} | ${t.company_name || "-"} | ${t.reference_number || t.invoice_number || "-"} | ${indicator} €${Math.abs(amount).toLocaleString()} |\n`;
      }

      return response;
    } catch (error) {
      console.error("Error searching transactions:", error);
      return `Error searching transactions: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});

// ==============================================
// Get Transaction Stats Tool
// ==============================================

const getTransactionStatsSchema = z.object({
  tenantId: z.string().describe("The tenant ID"),
  period: z.enum(["week", "month", "quarter", "year"]).optional().describe("Analysis period"),
});

type GetTransactionStatsParams = z.infer<typeof getTransactionStatsSchema>;

export const getTransactionStatsTool = tool({
  description: "Get transaction statistics with breakdowns by category, vendor, and trends.",
  inputSchema: getTransactionStatsSchema,
  execute: async (input: GetTransactionStatsParams): Promise<string> => {
    const { tenantId, period = "month" } = input;

    const periodInterval =
      period === "week"
        ? "7 days"
        : period === "quarter"
          ? "3 months"
          : period === "year"
            ? "12 months"
            : "1 month";

    try {
      // Overall stats
      const overall = await sql`
        SELECT
          COUNT(*) as transaction_count,
          COALESCE(SUM(CASE WHEN p.amount > 0 THEN p.amount ELSE 0 END), 0) as total_income,
          COALESCE(SUM(CASE WHEN p.amount < 0 THEN ABS(p.amount) ELSE 0 END), 0) as total_expenses,
          COALESCE(SUM(p.amount), 0) as net_amount,
          COALESCE(AVG(ABS(p.amount)), 0) as avg_transaction
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE i.tenant_id = ${tenantId}
          AND p.date >= NOW() - ${periodInterval}::interval
      `;

      // By category
      const byCategory = await sql`
        SELECT
          COALESCE(p.category_slug, 'uncategorized') as category,
          COUNT(*) as count,
          COALESCE(SUM(ABS(p.amount)), 0) as total
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE i.tenant_id = ${tenantId}
          AND p.date >= NOW() - ${periodInterval}::interval
        GROUP BY p.category_slug
        ORDER BY total DESC
        LIMIT 10
      `;

      // Top vendors/companies
      const topVendors = await sql`
        SELECT
          COALESCE(c.name, 'Unknown') as vendor,
          COUNT(*) as transaction_count,
          COALESCE(SUM(ABS(p.amount)), 0) as total_amount
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        LEFT JOIN companies c ON i.company_id = c.id
        WHERE i.tenant_id = ${tenantId}
          AND p.date >= NOW() - ${periodInterval}::interval
        GROUP BY c.name
        ORDER BY total_amount DESC
        LIMIT 10
      `;

      // Daily trend
      const trend = await sql`
        SELECT
          DATE(p.date) as day,
          COALESCE(SUM(CASE WHEN p.amount > 0 THEN p.amount ELSE 0 END), 0) as income,
          COALESCE(SUM(CASE WHEN p.amount < 0 THEN ABS(p.amount) ELSE 0 END), 0) as expenses
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE i.tenant_id = ${tenantId}
          AND p.date >= NOW() - ${periodInterval}::interval
        GROUP BY DATE(p.date)
        ORDER BY day DESC
        LIMIT 14
      `;

      const stats = overall[0] || {};

      let response = `## 📊 Transaction Statistics (Last ${period})\n\n`;
      response += `### Overview\n`;
      response += `| Metric | Value |\n`;
      response += `|--------|-------|\n`;
      response += `| Total Transactions | ${stats.transaction_count || 0} |\n`;
      response += `| Total Income | €${Number(stats.total_income || 0).toLocaleString()} |\n`;
      response += `| Total Expenses | €${Number(stats.total_expenses || 0).toLocaleString()} |\n`;
      response += `| Net Amount | €${Number(stats.net_amount || 0).toLocaleString()} |\n`;
      response += `| Avg Transaction | €${Number(stats.avg_transaction || 0).toFixed(2)} |\n`;

      response += `\n### By Category\n`;
      response += `| Category | Count | Total |\n`;
      response += `|----------|-------|-------|\n`;
      for (const row of byCategory) {
        response += `| ${row.category} | ${row.count} | €${Number(row.total).toLocaleString()} |\n`;
      }

      response += `\n### Top Vendors\n`;
      response += `| Vendor | Transactions | Amount |\n`;
      response += `|--------|--------------|--------|\n`;
      for (const row of topVendors.slice(0, 5)) {
        response += `| ${row.vendor} | ${row.transaction_count} | €${Number(row.total_amount).toLocaleString()} |\n`;
      }

      if (trend.length > 0) {
        response += `\n### Recent Daily Trend\n`;
        response += `| Date | Income | Expenses |\n`;
        response += `|------|--------|----------|\n`;
        for (const day of trend.slice(0, 7)) {
          const date = new Date(day.day as string).toLocaleDateString();
          response += `| ${date} | €${Number(day.income).toLocaleString()} | €${Number(day.expenses).toLocaleString()} |\n`;
        }
      }

      return response;
    } catch (error) {
      console.error("Error getting transaction stats:", error);
      return `Error getting transaction stats: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});

// ==============================================
// Get Recurring Transactions Tool
// ==============================================

const getRecurringTransactionsSchema = z.object({
  tenantId: z.string().describe("The tenant ID"),
});

type GetRecurringTransactionsParams = z.infer<typeof getRecurringTransactionsSchema>;

export const getRecurringTransactionsTool = tool({
  description: "Identify recurring payments and subscriptions based on transaction patterns.",
  inputSchema: getRecurringTransactionsSchema,
  execute: async (input: GetRecurringTransactionsParams): Promise<string> => {
    const { tenantId } = input;

    try {
      // Find vendors with multiple transactions at similar amounts
      const recurring = await sql`
        WITH vendor_transactions AS (
          SELECT
            COALESCE(c.name, p.notes, 'Unknown') as vendor,
            p.amount,
            COUNT(*) as occurrence_count,
            MIN(p.date) as first_date,
            MAX(p.date) as last_date,
            EXTRACT(EPOCH FROM (MAX(p.date) - MIN(p.date))) / NULLIF(COUNT(*) - 1, 0) / 86400 as avg_days_between
          FROM payments p
          JOIN invoices i ON p.invoice_id = i.id
          LEFT JOIN companies c ON i.company_id = c.id
          WHERE i.tenant_id = ${tenantId}
            AND p.date >= NOW() - INTERVAL '6 months'
          GROUP BY c.name, p.notes, p.amount
          HAVING COUNT(*) >= 2
        )
        SELECT
          vendor,
          amount,
          occurrence_count,
          first_date,
          last_date,
          avg_days_between,
          CASE
            WHEN avg_days_between BETWEEN 25 AND 35 THEN 'Monthly'
            WHEN avg_days_between BETWEEN 6 AND 8 THEN 'Weekly'
            WHEN avg_days_between BETWEEN 85 AND 95 THEN 'Quarterly'
            WHEN avg_days_between BETWEEN 350 AND 380 THEN 'Annual'
            ELSE 'Irregular'
          END as frequency
        FROM vendor_transactions
        WHERE avg_days_between IS NOT NULL
        ORDER BY occurrence_count DESC, ABS(amount) DESC
        LIMIT 20
      `;

      if (recurring.length === 0) {
        return "No recurring transactions detected. Need more transaction history for pattern detection.";
      }

      let response = `## 🔄 Recurring Transactions\n\n`;

      // Group by frequency
      const monthly = recurring.filter((r) => r.frequency === "Monthly");
      const weekly = recurring.filter((r) => r.frequency === "Weekly");
      const other = recurring.filter((r) => !["Monthly", "Weekly"].includes(r.frequency as string));

      if (monthly.length > 0) {
        response += `### Monthly Subscriptions\n`;
        response += `| Vendor | Amount | Occurrences |\n`;
        response += `|--------|--------|-------------|\n`;
        let monthlyTotal = 0;
        for (const r of monthly) {
          monthlyTotal += Math.abs(Number(r.amount));
          response += `| ${r.vendor} | €${Math.abs(Number(r.amount)).toFixed(2)} | ${r.occurrence_count}x |\n`;
        }
        response += `\n**Monthly Total:** €${monthlyTotal.toFixed(2)}\n`;
        response += `**Annual Impact:** €${(monthlyTotal * 12).toFixed(2)}\n\n`;
      }

      if (weekly.length > 0) {
        response += `### Weekly Payments\n`;
        response += `| Vendor | Amount | Occurrences |\n`;
        response += `|--------|--------|-------------|\n`;
        for (const r of weekly) {
          response += `| ${r.vendor} | €${Math.abs(Number(r.amount)).toFixed(2)} | ${r.occurrence_count}x |\n`;
        }
        response += `\n`;
      }

      if (other.length > 0) {
        response += `### Other Recurring\n`;
        response += `| Vendor | Amount | Frequency | Occurrences |\n`;
        response += `|--------|--------|-----------|-------------|\n`;
        for (const r of other.slice(0, 10)) {
          response += `| ${r.vendor} | €${Math.abs(Number(r.amount)).toFixed(2)} | ${r.frequency} | ${r.occurrence_count}x |\n`;
        }
      }

      return response;
    } catch (error) {
      console.error("Error getting recurring transactions:", error);
      return `Error getting recurring transactions: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});

// ==============================================
// Get Transactions by Vendor Tool
// ==============================================

const getTransactionsByVendorSchema = z.object({
  tenantId: z.string().describe("The tenant ID"),
  vendorName: z.string().describe("Vendor/company name to search"),
});

type GetTransactionsByVendorParams = z.infer<typeof getTransactionsByVendorSchema>;

export const getTransactionsByVendorTool = tool({
  description: "Get all transactions for a specific vendor or company.",
  inputSchema: getTransactionsByVendorSchema,
  execute: async (input: GetTransactionsByVendorParams): Promise<string> => {
    const { tenantId, vendorName } = input;

    try {
      const transactions = await sql`
        SELECT
          p.id,
          p.amount,
          p.date,
          p.method,
          p.notes,
          p.category_slug,
          i.invoice_number,
          c.name as company_name
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        LEFT JOIN companies c ON i.company_id = c.id
        WHERE i.tenant_id = ${tenantId}
          AND c.name ILIKE ${`%${vendorName}%`}
        ORDER BY p.date DESC
        LIMIT 50
      `;

      if (transactions.length === 0) {
        return `No transactions found for vendor "${vendorName}".`;
      }

      // Calculate stats
      let totalPaid = 0;
      let totalReceived = 0;
      for (const t of transactions) {
        const amount = Number(t.amount) || 0;
        if (amount > 0) totalReceived += amount;
        else totalPaid += Math.abs(amount);
      }

      const vendorDisplayName = transactions[0]?.company_name || vendorName;

      let response = `## 🏢 Transactions with "${vendorDisplayName}"\n\n`;
      response += `### Summary\n`;
      response += `| Metric | Value |\n`;
      response += `|--------|-------|\n`;
      response += `| Total Transactions | ${transactions.length} |\n`;
      response += `| Total Paid | €${totalPaid.toLocaleString()} |\n`;
      response += `| Total Received | €${totalReceived.toLocaleString()} |\n`;
      response += `| Net | €${(totalReceived - totalPaid).toLocaleString()} |\n`;

      response += `\n### Transaction History\n`;
      response += `| Date | Invoice | Method | Amount |\n`;
      response += `|------|---------|--------|--------|\n`;

      for (const t of transactions.slice(0, 20)) {
        const date = new Date(t.date as string).toLocaleDateString();
        const amount = Number(t.amount) || 0;
        const indicator = amount >= 0 ? "🟢" : "🔴";
        response += `| ${date} | ${t.invoice_number || "-"} | ${t.method || "-"} | ${indicator} €${Math.abs(amount).toLocaleString()} |\n`;
      }

      return response;
    } catch (error) {
      console.error("Error getting vendor transactions:", error);
      return `Error getting vendor transactions: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});
