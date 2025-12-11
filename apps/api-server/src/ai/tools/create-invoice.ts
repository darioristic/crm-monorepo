/**
 * Create Invoice AI Tool
 * Allows AI to create invoices for customers
 */

import { tool } from "ai";
import { z } from "zod";
import { sql } from "../../db/client";
import { invoiceQueries } from "../../db/queries/invoices";
import { generateUUID, now } from "@crm/utils";

const invoiceItemSchema = z.object({
  productName: z.string().describe("Name of the product or service"),
  description: z.string().optional().describe("Optional description"),
  quantity: z.number().min(1).default(1).describe("Quantity"),
  unitPrice: z.number().min(0).describe("Price per unit"),
  discount: z.number().min(0).max(100).default(0).describe("Discount percentage"),
});

const createInvoiceSchema = z.object({
  tenantId: z.string().describe("The tenant ID (use the tenant_id from context)"),
  customerName: z.string().optional().describe("Customer/company name to search for"),
  customerId: z.string().optional().describe("Direct customer/company ID if known"),
  items: z.array(invoiceItemSchema).min(1).describe("Invoice line items"),
  dueDate: z.string().optional().describe("Due date in YYYY-MM-DD format"),
  notes: z.string().optional().describe("Notes to include on the invoice"),
  currency: z.string().default("EUR").describe("Currency code"),
  vatRate: z.number().default(20).describe("VAT rate percentage"),
});

type CreateInvoiceParams = z.infer<typeof createInvoiceSchema>;

export const createInvoiceTool = tool({
  description: "Create a new invoice for a customer. Requires either customerName or customerId.",
  parameters: createInvoiceSchema,
  execute: async (params: CreateInvoiceParams): Promise<string> => {
    const { tenantId, customerName, customerId, items, dueDate, notes, currency, vatRate } = params;

    try {
      // Find the customer/company
      let companyId = customerId;
      let companyName = customerName;

      if (!companyId && customerName) {
        // Search for company by name
        const companies = await sql`
          SELECT id, name FROM companies
          WHERE name ILIKE ${`%${customerName}%`}
          LIMIT 5
        `;

        if (companies.length === 0) {
          return `❌ No customer found matching "${customerName}". Please provide a valid customer name or ID.`;
        }

        if (companies.length > 1) {
          const matches = companies.map((c) => `- ${c.name} (ID: ${c.id})`).join("\n");
          return `⚠️ Multiple customers found matching "${customerName}":\n${matches}\n\nPlease specify the exact customer ID.`;
        }

        companyId = companies[0].id;
        companyName = companies[0].name;
      }

      if (!companyId) {
        return "❌ Please provide either customerName or customerId to create an invoice.";
      }

      // Find a user from this tenant to use as creator
      const users = await sql`
        SELECT u.id FROM users u
        JOIN user_tenant_roles utr ON u.id = utr.user_id
        WHERE utr.tenant_id = ${tenantId}
        LIMIT 1
      `;

      if (users.length === 0) {
        return "❌ No users found for this tenant. Cannot create invoice.";
      }

      const creatorUserId = users[0].id;

      // Calculate totals
      const calculatedItems = items.map((item) => ({
        productName: item.productName,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        unit: "pcs",
        vatRate: vatRate,
        total: item.quantity * item.unitPrice * (1 - item.discount / 100),
      }));

      const subtotal = calculatedItems.reduce((sum, item) => sum + item.total, 0);
      const tax = subtotal * (vatRate / 100);
      const total = subtotal + tax;

      // Generate invoice number
      const invoiceNumber = await invoiceQueries.generateNumber();

      // Calculate due date (default to 30 days from now)
      const calculatedDueDate = dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      // Create the invoice
      const invoice = await invoiceQueries.create(
        {
          id: generateUUID(),
          createdAt: now(),
          updatedAt: now(),
          invoiceNumber,
          companyId,
          sellerCompanyId: tenantId,
          status: "draft",
          issueDate: now(),
          dueDate: calculatedDueDate,
          subtotal,
          taxRate: 0,
          vatRate,
          tax,
          total,
          paidAmount: 0,
          currency,
          notes,
          createdBy: creatorUserId,
        } as Parameters<typeof invoiceQueries.create>[0],
        calculatedItems
      );

      // Format response
      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: currency,
          minimumFractionDigits: 2,
        }).format(amount);
      };

      let response = `✅ **Invoice Created Successfully**\n\n`;
      response += `| Field | Value |\n`;
      response += `|-------|-------|\n`;
      response += `| Invoice Number | ${invoice.invoiceNumber} |\n`;
      response += `| Customer | ${companyName || companyId} |\n`;
      response += `| Status | Draft |\n`;
      response += `| Due Date | ${calculatedDueDate} |\n`;
      response += `| Subtotal | ${formatCurrency(subtotal)} |\n`;
      response += `| VAT (${vatRate}%) | ${formatCurrency(tax)} |\n`;
      response += `| **Total** | **${formatCurrency(total)}** |\n`;

      response += `\n### Items\n`;
      response += `| Item | Qty | Unit Price | Total |\n`;
      response += `|------|-----|------------|-------|\n`;
      for (const item of calculatedItems) {
        response += `| ${item.productName} | ${item.quantity} | ${formatCurrency(item.unitPrice)} | ${formatCurrency(item.total)} |\n`;
      }

      // Include links to view the invoice
      response += `\n### Links\n`;
      response += `- **Dashboard**: /dashboard/sales/invoices/${invoice.id}\n`;
      if (invoice.token) {
        response += `- **Public Link**: /i/${invoice.token}\n`;
      }
      response += `\n📝 The invoice has been created as a **draft**. You can review and send it from the invoices page.`;

      return response;
    } catch (error) {
      console.error("Error creating invoice:", error);
      return `❌ Failed to create invoice: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});
