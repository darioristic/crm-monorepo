/**
 * Operations Agent Tools
 * Tools for document management, inbox, and account operations
 */

import { tool } from "ai";
import { z } from "zod";
import { sql } from "../../db/client";

// ==============================================
// Get Documents Tool
// ==============================================

const getDocumentsSchema = z.object({
  tenantId: z.string().describe("The tenant ID"),
  companyId: z.string().describe("Filter by company ID").optional(),
  search: z.string().describe("Search term for document title or content").optional(),
  tags: z.array(z.string()).describe("Filter by tags").optional(),
  limit: z.number().default(20).describe("Maximum results to return"),
});

type GetDocumentsParams = z.infer<typeof getDocumentsSchema>;

export const getDocumentsTool = tool({
  description:
    "Search and retrieve documents from the vault. Use to find contracts, invoices, receipts, etc.",
  parameters: getDocumentsSchema,
  execute: async (params: GetDocumentsParams): Promise<string> => {
    const { tenantId, companyId, search, tags, limit } = params;

    try {
      const documents = await sql`
        SELECT
          d.id,
          d.title,
          d.summary,
          d.tags,
          d.mimetype,
          d.size,
          d.language,
          d.created_at,
          c.name as company_name
        FROM documents d
        LEFT JOIN companies c ON d.company_id = c.id
        WHERE d.tenant_id = ${tenantId}
          ${companyId ? sql`AND d.company_id = ${companyId}::uuid` : sql``}
          ${search ? sql`AND (d.title ILIKE ${`%${search}%`} OR d.summary ILIKE ${`%${search}%`})` : sql``}
          ${tags && tags.length > 0 ? sql`AND d.tags && ${tags}::text[]` : sql``}
        ORDER BY d.created_at DESC
        LIMIT ${limit}
      `;

      if (documents.length === 0) {
        return "No documents found matching the criteria.";
      }

      let response = `## 📄 Documents (${documents.length} found)\n\n`;
      response += `| Title | Company | Type | Tags | Date |\n`;
      response += `|-------|---------|------|------|------|\n`;

      for (const doc of documents) {
        const tags = (doc.tags as string[])?.slice(0, 3).join(", ") || "-";
        const type = (doc.mimetype as string)?.split("/")[1] || "file";
        response += `| ${doc.title || "Untitled"} | ${doc.company_name || "-"} | ${type} | ${tags} | ${new Date(doc.created_at as string).toLocaleDateString()} |\n`;
      }

      return response;
    } catch (error) {
      console.error("Error getting documents:", error);
      return `Error getting documents: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});

// ==============================================
// Get Inbox Items Tool
// ==============================================

const getInboxItemsSchema = z.object({
  tenantId: z.string().describe("The tenant ID"),
  status: z
    .enum(["new", "pending", "processing", "processed", "archived"])
    .describe("Filter by status")
    .optional(),
  limit: z.number().default(20).describe("Maximum results to return"),
});

type GetInboxItemsParams = z.infer<typeof getInboxItemsSchema>;

export const getInboxItemsTool = tool({
  description:
    "Get inbox items (uploaded receipts, invoices, scanned documents). Shows items pending processing.",
  parameters: getInboxItemsSchema,
  execute: async (params: GetInboxItemsParams): Promise<string> => {
    const { tenantId, status, limit } = params;

    try {
      const items = await sql`
        SELECT
          i.id,
          i.display_name,
          i.file_name,
          i.content_type,
          i.status,
          i.amount,
          i.currency,
          i.date,
          i.description,
          i.sender_email,
          i.created_at,
          i.transaction_id,
          t.description as matched_transaction
        FROM inbox i
        LEFT JOIN transactions t ON i.transaction_id = t.id
        WHERE i.tenant_id = ${tenantId}
          ${status ? sql`AND i.status = ${status}` : sql``}
        ORDER BY i.created_at DESC
        LIMIT ${limit}
      `;

      if (items.length === 0) {
        return status
          ? `No inbox items with status "${status}" found.`
          : "Inbox is empty. Upload documents to get started.";
      }

      // Group by status
      const byStatus = items.reduce(
        (acc, item) => {
          const s = item.status as string;
          if (!acc[s]) acc[s] = [];
          acc[s].push(item);
          return acc;
        },
        {} as Record<string, typeof items>
      );

      let response = `## 📥 Inbox Items (${items.length} total)\n\n`;

      // Status summary
      response += `### Status Summary\n`;
      response += `| Status | Count |\n`;
      response += `|--------|-------|\n`;
      for (const [s, list] of Object.entries(byStatus)) {
        const emoji =
          s === "new" ? "🆕" : s === "processing" ? "⏳" : s === "processed" ? "✅" : "📦";
        response += `| ${emoji} ${s} | ${list.length} |\n`;
      }

      response += `\n### Recent Items\n`;
      response += `| Name | Type | Amount | Status | Matched |\n`;
      response += `|------|------|--------|--------|--------|\n`;

      for (const item of items.slice(0, 15)) {
        const amount = item.amount ? `€${Number(item.amount).toFixed(2)}` : "-";
        const matched = item.transaction_id ? "✅" : "❌";
        const type = (item.content_type as string)?.split("/")[1] || "file";
        response += `| ${item.display_name || item.file_name} | ${type} | ${amount} | ${item.status} | ${matched} |\n`;
      }

      return response;
    } catch (error) {
      console.error("Error getting inbox items:", error);
      return `Error getting inbox items: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});

// ==============================================
// Get Account Balances Tool
// ==============================================

const getAccountBalancesSchema = z.object({
  tenantId: z.string().describe("The tenant ID"),
});

type GetAccountBalancesParams = z.infer<typeof getAccountBalancesSchema>;

export const getAccountBalancesTool = tool({
  description:
    "Get connected bank account balances and financial position summary. Use for cash position overview.",
  parameters: getAccountBalancesSchema,
  execute: async (params: GetAccountBalancesParams): Promise<string> => {
    const { tenantId } = params;

    try {
      // Get connected accounts
      const accounts = await sql`
        SELECT
          ca.id,
          ca.name,
          ca.type,
          ca.provider,
          ca.currency,
          ca.balance,
          ca.last_synced_at,
          ca.status
        FROM connected_accounts ca
        WHERE ca.tenant_id = ${tenantId}
        ORDER BY ca.balance DESC NULLS LAST
      `;

      // Get aggregated payment data as backup
      const paymentSummary = await sql`
        SELECT
          COALESCE(SUM(CASE WHEN p.amount > 0 THEN p.amount ELSE 0 END), 0) as total_income,
          COALESCE(SUM(CASE WHEN p.amount < 0 THEN ABS(p.amount) ELSE 0 END), 0) as total_expenses,
          COALESCE(SUM(p.amount), 0) as net_position
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE i.tenant_id = ${tenantId}
      `;

      const summary = paymentSummary[0] || {
        total_income: 0,
        total_expenses: 0,
        net_position: 0,
      };

      let response = `## 🏦 Account Balances\n\n`;

      if (accounts.length > 0) {
        response += `### Connected Accounts\n`;
        response += `| Account | Type | Balance | Currency | Last Sync |\n`;
        response += `|---------|------|---------|----------|----------|\n`;

        let totalBalance = 0;
        for (const acc of accounts) {
          const balance = Number(acc.balance) || 0;
          totalBalance += balance;
          const lastSync = acc.last_synced_at
            ? new Date(acc.last_synced_at as string).toLocaleDateString()
            : "Never";
          response += `| ${acc.name} | ${acc.type} | €${balance.toLocaleString()} | ${acc.currency || "EUR"} | ${lastSync} |\n`;
        }

        response += `\n**Total Across Accounts:** €${totalBalance.toLocaleString()}\n`;
      } else {
        response += `*No bank accounts connected yet.*\n`;
      }

      response += `\n### Financial Position (from Payments)\n`;
      response += `| Metric | Amount |\n`;
      response += `|--------|--------|\n`;
      response += `| Total Income | €${Number(summary.total_income).toLocaleString()} |\n`;
      response += `| Total Expenses | €${Number(summary.total_expenses).toLocaleString()} |\n`;
      response += `| Net Position | €${Number(summary.net_position).toLocaleString()} |\n`;

      // Get outstanding receivables
      const receivables = await sql`
        SELECT
          COUNT(*) as count,
          COALESCE(SUM(total_amount - paid_amount), 0) as amount
        FROM invoices
        WHERE tenant_id = ${tenantId}
          AND status IN ('sent', 'overdue')
          AND total_amount > paid_amount
      `;

      const pendingAmount = Number(receivables[0]?.amount) || 0;
      const pendingCount = receivables[0]?.count || 0;

      response += `\n### Outstanding Receivables\n`;
      response += `**${pendingCount} invoices** worth **€${pendingAmount.toLocaleString()}** pending collection.\n`;

      return response;
    } catch (error) {
      console.error("Error getting account balances:", error);
      return `Error getting account balances: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});

// ==============================================
// Get Inbox Stats Tool
// ==============================================

const getInboxStatsSchema = z.object({
  tenantId: z.string().describe("The tenant ID"),
});

type GetInboxStatsParams = z.infer<typeof getInboxStatsSchema>;

export const getInboxStatsTool = tool({
  description: "Get inbox statistics and processing metrics. Use to understand inbox health.",
  parameters: getInboxStatsSchema,
  execute: async (params: GetInboxStatsParams): Promise<string> => {
    const { tenantId } = params;

    try {
      const stats = await sql`
        SELECT
          status,
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as total_amount,
          COUNT(CASE WHEN transaction_id IS NOT NULL THEN 1 END) as matched_count
        FROM inbox
        WHERE tenant_id = ${tenantId}
        GROUP BY status
      `;

      const recentActivity = await sql`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as items_received,
          COUNT(CASE WHEN status = 'processed' THEN 1 END) as items_processed
        FROM inbox
        WHERE tenant_id = ${tenantId}
          AND created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `;

      let response = `## 📊 Inbox Statistics\n\n`;

      response += `### Status Breakdown\n`;
      response += `| Status | Count | Amount | Matched |\n`;
      response += `|--------|-------|--------|--------|\n`;

      let totalItems = 0;
      let totalMatched = 0;
      for (const row of stats) {
        totalItems += Number(row.count);
        totalMatched += Number(row.matched_count);
        response += `| ${row.status} | ${row.count} | €${Number(row.total_amount).toLocaleString()} | ${row.matched_count} |\n`;
      }

      const matchRate = totalItems > 0 ? ((totalMatched / totalItems) * 100).toFixed(1) : "0";

      response += `\n### Key Metrics\n`;
      response += `- **Total Items:** ${totalItems}\n`;
      response += `- **Match Rate:** ${matchRate}%\n`;

      if (recentActivity.length > 0) {
        response += `\n### Last 7 Days Activity\n`;
        response += `| Date | Received | Processed |\n`;
        response += `|------|----------|----------|\n`;
        for (const day of recentActivity) {
          response += `| ${new Date(day.date as string).toLocaleDateString()} | ${day.items_received} | ${day.items_processed} |\n`;
        }
      }

      return response;
    } catch (error) {
      console.error("Error getting inbox stats:", error);
      return `Error getting inbox stats: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});

// ==============================================
// Process Inbox Item Tool
// ==============================================

const processInboxItemSchema = z.object({
  tenantId: z.string().describe("The tenant ID"),
  inboxId: z.string().describe("The inbox item ID to process"),
});

type ProcessInboxItemParams = z.infer<typeof processInboxItemSchema>;

export const processInboxItemTool = tool({
  description:
    "Trigger OCR and AI processing on an inbox item. Use to extract data from documents.",
  parameters: processInboxItemSchema,
  execute: async (params: ProcessInboxItemParams): Promise<string> => {
    const { tenantId, inboxId } = params;

    try {
      // Check if item exists and get current status
      const item = await sql`
        SELECT id, display_name, status, content_type
        FROM inbox
        WHERE id = ${inboxId}::uuid AND tenant_id = ${tenantId}
      `;

      if (item.length === 0) {
        return `Inbox item with ID ${inboxId} not found.`;
      }

      const currentItem = item[0];

      if (currentItem.status === "processing") {
        return `Item "${currentItem.display_name}" is already being processed. Please wait.`;
      }

      if (currentItem.status === "processed") {
        return `Item "${currentItem.display_name}" has already been processed. View results in the inbox.`;
      }

      // Update status to processing
      await sql`
        UPDATE inbox
        SET status = 'processing', updated_at = NOW()
        WHERE id = ${inboxId}::uuid AND tenant_id = ${tenantId}
      `;

      return `✅ Processing started for "${currentItem.display_name}".\n\nThe system will:\n1. Extract text using OCR\n2. Identify document type (invoice, receipt, etc.)\n3. Extract key data (amount, date, vendor)\n4. Suggest transaction matches\n\nCheck inbox in a few moments for results.`;
    } catch (error) {
      console.error("Error processing inbox item:", error);
      return `Error processing inbox item: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});
