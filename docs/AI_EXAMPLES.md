# AI System - Code Examples

Praktični primeri koda za rad sa AI sistemom.

## 📋 Sadržaj

1. [Chat Integration](#chat-integration)
2. [Custom Agents](#custom-agents)
3. [Custom Tools](#custom-tools)
4. [Document Processing](#document-processing)
5. [Category Embeddings](#category-embeddings)
6. [Full Workflows](#full-workflows)

---

## Chat Integration

### Example 1: Basic Chat Component

```typescript
// components/simple-chat.tsx
"use client";

import { useChat } from "ai/react";
import { useState } from "react";

export function SimpleChat() {
  const [chatId] = useState(() => crypto.randomUUID());

  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: `${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat`,
      id: chatId,
      body: {
        chatId,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg) => (
          <div key={msg.id} className={msg.role}>
            {msg.content}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask me anything..."
          className="w-full p-2 border rounded"
          disabled={isLoading}
        />
      </form>
    </div>
  );
}
```

### Example 2: Chat with Suggested Actions

```typescript
// components/smart-chat.tsx
"use client";

import { useChat } from "ai/react";
import { Button } from "@/components/ui/button";

const QUICK_ACTIONS = [
  "Show overdue invoices",
  "List top customers",
  "Revenue this month",
];

export function SmartChat() {
  const chat = useChat({
    api: "/api/v1/chat",
    body: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
  });

  const handleQuickAction = (action: string) => {
    chat.setInput(action);
    chat.handleSubmit(new Event("submit") as any);
  };

  return (
    <div className="space-y-4">
      {/* Messages */}
      <div className="space-y-2">
        {chat.messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>

      {/* Quick Actions */}
      {chat.messages.length === 0 && (
        <div className="grid grid-cols-3 gap-2">
          {QUICK_ACTIONS.map((action) => (
            <Button
              key={action}
              variant="outline"
              onClick={() => handleQuickAction(action)}
            >
              {action}
            </Button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={chat.handleSubmit}>
        <input value={chat.input} onChange={chat.handleInputChange} />
      </form>
    </div>
  );
}
```

---

## Custom Agents

### Example 1: Reports Agent

```typescript
// apps/api-server/src/ai/agents/reports.ts
import { openai } from "@ai-sdk/openai";
import {
  COMMON_AGENT_RULES,
  createAgent,
  formatContextForLLM,
} from "./config/shared";
import {
  getRevenueTool,
  getExpensesTool,
  getProfitTool,
} from "../tools/reports";

export const reportsAgent = createAgent({
  name: "reports",
  model: openai("gpt-4o-mini"),
  temperature: 0.3,

  instructions: (ctx) => `You are a financial reporting specialist for ${
    ctx.companyName
  }.

<background-data>
${formatContextForLLM(ctx)}
</background-data>

${COMMON_AGENT_RULES}

<capabilities>
- Generate financial reports (Revenue, Expenses, Profit & Loss)
- Analyze trends and patterns
- Compare periods (MoM, YoY)
- Provide actionable insights
- Export data in various formats
</capabilities>

<report_types>
- Revenue Report: Income analysis by source, customer, product
- Expense Report: Cost breakdown by category, vendor
- P&L Statement: Profit and loss analysis
- Cash Flow: Inflows and outflows
- Tax Summary: Tax obligations and deductions
</report_types>

<response_format>
1. Executive Summary (key metrics)
2. Detailed Analysis (tables, charts)
3. Insights (trends, anomalies)
4. Recommendations (actionable steps)
</response_format>`,

  tools: {
    getRevenue: getRevenueTool,
    getExpenses: getExpensesTool,
    getProfit: getProfitTool,
  },

  maxTurns: 5,
});
```

### Example 2: Analytics Agent

```typescript
// apps/api-server/src/ai/agents/analytics.ts
import { openai } from "@ai-sdk/openai";
import { createAgent, formatContextForLLM } from "./config/shared";

export const analyticsAgent = createAgent({
  name: "analytics",
  model: openai("gpt-4o"), // More powerful model

  instructions: (ctx) => `You are a data analytics expert for ${
    ctx.companyName
  }.

<background-data>
${formatContextForLLM(ctx)}
</background-data>

<capabilities>
- Predictive analytics
- Trend forecasting
- Anomaly detection
- Customer segmentation
- Churn prediction
- Revenue forecasting
</capabilities>

<analysis_approach>
1. Gather relevant data using tools
2. Identify patterns and correlations
3. Apply statistical methods
4. Generate predictions
5. Provide confidence intervals
6. Explain methodology
</analysis_approach>`,

  tools: {
    // Add analytics-specific tools
  },

  maxTurns: 10, // Complex analysis may need more turns
});
```

---

## Custom Tools

### Example 1: Get Revenue Tool

```typescript
// apps/api-server/src/ai/tools/get-revenue.ts
import { tool } from "ai";
import { z } from "zod";
import { sql as db } from "../../db/client";
import type { ToolResponse } from "../types";

const getRevenueSchema = z.object({
  startDate: z.string().describe("Start date (ISO 8601)"),
  endDate: z.string().describe("End date (ISO 8601)"),
  groupBy: z
    .enum(["day", "week", "month"])
    .default("month")
    .describe("Grouping period"),
});

type GetRevenueParams = z.infer<typeof getRevenueSchema>;

export const getRevenueTool = tool({
  description: "Get revenue analysis for a specific period with grouping",
  parameters: getRevenueSchema,

  execute: async (params: GetRevenueParams): Promise<ToolResponse> => {
    const { startDate, endDate, groupBy } = params;

    try {
      const groupByClause = {
        day: "DATE(created_at)",
        week: "DATE_TRUNC('week', created_at)",
        month: "DATE_TRUNC('month', created_at)",
      }[groupBy];

      const result = await db`
        SELECT 
          ${db.unsafe(groupByClause)} as period,
          SUM(total) as revenue,
          COUNT(*) as invoices,
          AVG(total) as avg_invoice
        FROM invoices
        WHERE status = 'paid'
          AND created_at >= ${startDate}
          AND created_at <= ${endDate}
        GROUP BY period
        ORDER BY period ASC
      `;

      if (result.length === 0) {
        return { text: "No revenue data for this period." };
      }

      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("sr-RS", {
          style: "currency",
          currency: "EUR",
        }).format(amount);
      };

      const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString("sr-RS", {
          year: "numeric",
          month: "short",
          ...(groupBy === "day" && { day: "numeric" }),
        });
      };

      const tableRows = result
        .map((row: Record<string, unknown>) => {
          const revenue = formatCurrency(parseFloat(row.revenue as string));
          const avgInvoice = formatCurrency(
            parseFloat(row.avg_invoice as string)
          );
          return `| ${formatDate(row.period as Date)} | ${revenue} | ${
            row.invoices
          } | ${avgInvoice} |`;
        })
        .join("\n");

      const totalRevenue = result.reduce(
        (sum: number, row: Record<string, unknown>) =>
          sum + parseFloat(row.revenue as string),
        0
      );

      const totalInvoices = result.reduce(
        (sum: number, row: Record<string, unknown>) =>
          sum + parseInt(row.invoices as string, 10),
        0
      );

      const response = `## Revenue Analysis

| Period | Revenue | Invoices | Avg Invoice |
|--------|---------|----------|-------------|
${tableRows}

**Total Revenue**: ${formatCurrency(totalRevenue)}  
**Total Invoices**: ${totalInvoices}  
**Period**: ${new Date(startDate).toLocaleDateString()} - ${new Date(
        endDate
      ).toLocaleDateString()}`;

      return {
        text: response,
        link: {
          text: "View detailed report",
          url: "/dashboard/reports/revenue",
        },
      };
    } catch (error) {
      return {
        text: `Failed to generate revenue report: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  },
});
```

### Example 2: Create Invoice Tool

```typescript
// apps/api-server/src/ai/tools/create-invoice.ts
import { tool } from "ai";
import { z } from "zod";
import { invoiceQueries } from "../../db/queries/invoices";
import type { ToolResponse } from "../types";

const createInvoiceSchema = z.object({
  companyId: z.string().describe("Customer company ID"),
  items: z
    .array(
      z.object({
        productName: z.string(),
        quantity: z.number(),
        unitPrice: z.number(),
      })
    )
    .describe("Invoice line items"),
  dueDate: z.string().describe("Payment due date (ISO 8601)"),
  notes: z.string().optional().describe("Additional notes"),
});

type CreateInvoiceParams = z.infer<typeof createInvoiceSchema>;

export const createInvoiceTool = tool({
  description: "Create a new invoice for a customer",
  parameters: createInvoiceSchema,

  execute: async (params: CreateInvoiceParams): Promise<ToolResponse> => {
    const { companyId, items, dueDate, notes } = params;

    try {
      // Calculate totals
      const subtotal = items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
      );
      const taxRate = 20; // VAT 20%
      const tax = subtotal * (taxRate / 100);
      const total = subtotal + tax;

      // Generate invoice number
      const invoiceNumber = await invoiceQueries.generateNumber();

      // Create invoice
      const invoice = await invoiceQueries.create(
        {
          id: crypto.randomUUID(),
          invoiceNumber,
          companyId,
          status: "draft",
          issueDate: new Date().toISOString(),
          dueDate,
          subtotal,
          taxRate,
          tax,
          total,
          paidAmount: 0,
          currency: "EUR",
          notes: notes || null,
          createdBy: "ai-assistant",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        items.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: 0,
          total: item.quantity * item.unitPrice,
        }))
      );

      const response = `✅ **Invoice Created Successfully**

**Invoice Number**: ${invoice.invoiceNumber}
**Customer**: [Company Name]
**Total**: €${total.toFixed(2)}
**Due Date**: ${new Date(dueDate).toLocaleDateString("sr-RS")}

**Items**:
${items
  .map(
    (item, i) =>
      `${i + 1}. ${item.productName} - ${item.quantity} x €${
        item.unitPrice
      } = €${(item.quantity * item.unitPrice).toFixed(2)}`
  )
  .join("\n")}

The invoice is in **draft** status. You can review and send it to the customer.`;

      return {
        text: response,
        link: {
          text: "View invoice",
          url: `/dashboard/sales/invoices/${invoice.id}`,
        },
      };
    } catch (error) {
      return {
        text: `Failed to create invoice: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  },
});
```

---

## Document Processing

### Example 1: Upload & Auto-Process Invoice

```typescript
// app/api/upload-invoice/route.ts
import { NextResponse } from "next/server";
import { invoiceProcessor, documentClassifier } from "@crm/documents";
import { put } from "@vercel/blob";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // 1. Upload to storage
    const blob = await put(file.name, file, {
      access: "public",
    });

    // 2. Classify document
    const classification = await documentClassifier.classify(blob.url);

    if (classification.type !== "invoice") {
      return NextResponse.json(
        {
          error: `This appears to be a ${classification.type}, not an invoice`,
          classification,
        },
        { status: 400 }
      );
    }

    // 3. Extract data
    const extractedData = await invoiceProcessor.processDocument({
      documentUrl: blob.url,
      companyName: "My Company",
    });

    // 4. Validate extracted data
    if (!extractedData.totalAmount || !extractedData.vendorName) {
      return NextResponse.json(
        {
          error: "Could not extract critical fields",
          partialData: extractedData,
        },
        { status: 422 }
      );
    }

    // 5. Return for review
    return NextResponse.json({
      success: true,
      data: extractedData,
      message: "Invoice processed successfully. Please review the data.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error.message,
      },
      { status: 500 }
    );
  }
}
```

### Example 2: Batch Document Processing

```typescript
// scripts/process-documents-batch.ts
import {
  documentClassifier,
  invoiceProcessor,
  receiptProcessor,
} from "@crm/documents";
import { sql as db } from "./db/client";

async function processPendingDocuments() {
  // Get unprocessed documents
  const documents = await db`
    SELECT * FROM documents
    WHERE processed = false
    LIMIT 50
  `;

  console.log(`Processing ${documents.length} documents...`);

  const results = {
    total: documents.length,
    invoices: 0,
    receipts: 0,
    other: 0,
    errors: 0,
  };

  for (const doc of documents) {
    try {
      // Classify
      const classification = await documentClassifier.classify(doc.url);

      // Process based on type
      let extractedData;

      if (classification.type === "invoice") {
        extractedData = await invoiceProcessor.processDocument({
          documentUrl: doc.url,
        });
        results.invoices++;

        // Store invoice data
        await db`
          UPDATE documents
          SET 
            processed = true,
            document_type = 'invoice',
            extracted_data = ${JSON.stringify(extractedData)},
            processed_at = NOW()
          WHERE id = ${doc.id}
        `;
      } else if (classification.type === "receipt") {
        extractedData = await receiptProcessor.processDocument({
          documentUrl: doc.url,
        });
        results.receipts++;

        await db`
          UPDATE documents
          SET 
            processed = true,
            document_type = 'receipt',
            extracted_data = ${JSON.stringify(extractedData)},
            processed_at = NOW()
          WHERE id = ${doc.id}
        `;
      } else {
        results.other++;

        await db`
          UPDATE documents
          SET 
            processed = true,
            document_type = ${classification.type},
            processed_at = NOW()
          WHERE id = ${doc.id}
        `;
      }

      // Small delay to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Error processing document ${doc.id}:`, error);
      results.errors++;

      await db`
        UPDATE documents
        SET 
          processing_error = ${error.message},
          error_at = NOW()
        WHERE id = ${doc.id}
      `;
    }
  }

  console.log("Processing complete:", results);
  return results;
}

// Run
processPendingDocuments().catch(console.error);
```

---

## Category Embeddings

### Example 1: Auto-categorize Transactions

```typescript
// services/auto-categorize.service.ts
import { findBestCategory } from "@crm/categories";
import { sql as db } from "../db/client";

export async function autoCategorizeTransaction(transactionId: string) {
  // Get transaction
  const tx = await db`
    SELECT * FROM transactions WHERE id = ${transactionId}
  `;

  if (tx.length === 0) {
    throw new Error("Transaction not found");
  }

  const transaction = tx[0];

  // Build description from available fields
  const description = [
    transaction.description,
    transaction.merchant_name,
    transaction.notes,
  ]
    .filter(Boolean)
    .join(" ");

  // Find best matching category
  const match = await findBestCategory(description);

  if (!match || match.similarity < 0.7) {
    return {
      success: false,
      reason: "Low confidence",
      suggestions: match ? [match] : [],
    };
  }

  // Update transaction
  await db`
    UPDATE transactions
    SET 
      category_id = ${match.category.id},
      auto_categorized = true,
      categorization_confidence = ${match.similarity},
      updated_at = NOW()
    WHERE id = ${transactionId}
  `;

  return {
    success: true,
    category: match.category,
    confidence: match.similarity,
  };
}
```

### Example 2: Smart Category Suggestions

```typescript
// components/transaction-form.tsx
import { findTopCategories } from "@crm/categories";
import { useState, useEffect } from "react";

export function TransactionForm() {
  const [description, setDescription] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Debounced suggestions
  useEffect(() => {
    if (description.length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const matches = await findTopCategories(description, 3);
        setSuggestions(matches);
      } catch (error) {
        console.error("Failed to get suggestions:", error);
      } finally {
        setIsLoading(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [description]);

  return (
    <div>
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Transaction description..."
      />

      {suggestions.length > 0 && (
        <div className="mt-2">
          <p className="text-sm text-muted-foreground">Suggested categories:</p>
          <div className="flex gap-2 mt-1">
            {suggestions.map((match) => (
              <button
                key={match.category.id}
                type="button"
                className="px-3 py-1 text-sm border rounded"
                onClick={() => selectCategory(match.category)}
              >
                {match.category.name}
                <span className="ml-1 text-xs text-muted-foreground">
                  {Math.round(match.similarity * 100)}%
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Full Workflows

### Example 1: Complete Invoice Workflow

```typescript
// workflows/invoice-from-pdf.ts
import { invoiceProcessor } from "@crm/documents";
import { findBestCategory } from "@crm/categories";
import { companyQueries } from "../db/queries/companies";
import { invoiceQueries } from "../db/queries/invoices";

export async function createInvoiceFromPDF(
  documentUrl: string,
  userId: string
) {
  try {
    // Step 1: Extract data from PDF
    console.log("Extracting data from PDF...");
    const extractedData = await invoiceProcessor.processDocument({
      documentUrl,
      companyName: "My Company",
    });

    // Step 2: Find or create vendor company
    console.log("Looking up vendor...");
    let vendor = await companyQueries.findByName(extractedData.vendorName!);

    if (!vendor) {
      console.log("Creating new vendor...");
      vendor = await companyQueries.create({
        name: extractedData.vendorName!,
        address: extractedData.vendorAddress || "",
        email: extractedData.email || null,
        website: extractedData.website || null,
        industry: "Unknown", // Could use embeddings to guess
      });
    }

    // Step 3: Auto-categorize line items
    console.log("Categorizing line items...");
    const categorizedItems = await Promise.all(
      extractedData.lineItems.map(async (item) => {
        const match = await findBestCategory(item.description);
        return {
          ...item,
          categoryId: match?.category.id || null,
          categoryConfidence: match?.similarity || 0,
        };
      })
    );

    // Step 4: Create invoice
    console.log("Creating invoice...");
    const invoice = await invoiceQueries.create(
      {
        id: crypto.randomUUID(),
        invoiceNumber:
          extractedData.invoiceNumber ||
          (await invoiceQueries.generateNumber()),
        companyId: vendor.id,
        status: "draft",
        issueDate: extractedData.invoiceDate || new Date().toISOString(),
        dueDate: extractedData.dueDate || new Date().toISOString(),
        subtotal:
          extractedData.totalAmount! /
          (1 + (extractedData.taxRate || 20) / 100),
        taxRate: extractedData.taxRate || 20,
        tax: extractedData.taxAmount || 0,
        total: extractedData.totalAmount!,
        paidAmount: 0,
        currency: extractedData.currency || "EUR",
        notes: extractedData.notes || null,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      categorizedItems.map((item) => ({
        productName: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: 0,
        total: item.total,
      }))
    );

    // Step 5: Link document to invoice
    await db`
      UPDATE documents
      SET invoice_id = ${invoice.id}
      WHERE url = ${documentUrl}
    `;

    return {
      success: true,
      invoice,
      vendor,
      categorizedItems: categorizedItems.filter((i) => i.categoryId),
      message: `Invoice ${invoice.invoiceNumber} created successfully`,
    };
  } catch (error) {
    console.error("Workflow failed:", error);
    throw error;
  }
}
```

### Example 2: Smart Customer Insights

```typescript
// workflows/customer-insights.ts
import { companyQueries } from "../db/queries/companies";
import { invoiceQueries } from "../db/queries/invoices";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

export async function generateCustomerInsights(customerId: string) {
  // 1. Gather data
  const customer = await companyQueries.findById(customerId);
  const invoices = await invoiceQueries.findByCompany(customerId);

  if (!customer) {
    throw new Error("Customer not found");
  }

  // 2. Calculate metrics
  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const avgInvoice = totalRevenue / invoices.length;
  const paidInvoices = invoices.filter((inv) => inv.status === "paid");
  const paymentRate = (paidInvoices.length / invoices.length) * 100;
  const overdueInvoices = invoices.filter((inv) => inv.status === "overdue");

  // 3. Calculate payment speed
  const avgDaysToPay =
    paidInvoices.reduce((sum, inv) => {
      if (!inv.paidAt) return sum;
      const issued = new Date(inv.issueDate);
      const paid = new Date(inv.paidAt);
      const days = (paid.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24);
      return sum + days;
    }, 0) / paidInvoices.length;

  // 4. Use AI for insights generation
  const dataContext = `
Customer: ${customer.name}
Industry: ${customer.industry}
Total Revenue: €${totalRevenue}
Invoices: ${invoices.length}
Payment Rate: ${paymentRate.toFixed(1)}%
Avg Days to Pay: ${avgDaysToPay.toFixed(0)} days
Overdue Invoices: ${overdueInvoices.length}
Recent Activity: ${invoices
    .slice(0, 5)
    .map((i) => `${i.invoiceNumber} (${i.status})`)
    .join(", ")}
`;

  const { text: insights } = await generateText({
    model: openai("gpt-4o"),
    prompt: `Analyze this customer data and provide actionable business insights:

${dataContext}

Provide:
1. Customer health score (0-100)
2. Risk assessment (low/medium/high)
3. Opportunities for growth
4. Recommended actions
5. Payment behavior analysis`,
  });

  return {
    customer,
    metrics: {
      totalRevenue,
      avgInvoice,
      paymentRate,
      avgDaysToPay,
      overdueCount: overdueInvoices.length,
    },
    insights,
  };
}
```

---

## Testing Examples

### Example 1: Agent Test

```typescript
// __tests__/ai/agents/invoices.test.ts
import { describe, it, expect, vi } from "vitest";
import { invoicesAgent } from "../../../ai/agents/invoices";
import { buildAppContext } from "../../../ai/agents/config/shared";

describe("Invoices Agent", () => {
  const mockContext = {
    userId: "user-123",
    teamId: "team-456",
    teamName: "Test Corp",
    fullName: "Test User",
    baseCurrency: "EUR",
    locale: "sr-RS",
    timezone: "Europe/Belgrade",
  };

  it("should have correct configuration", () => {
    expect(invoicesAgent.name).toBe("invoices");
    expect(invoicesAgent.config.temperature).toBe(0.3);
  });

  it("should generate system prompt", () => {
    const appContext = buildAppContext(mockContext, "chat-123");
    const prompt = invoicesAgent.getSystemPrompt(appContext);

    expect(prompt).toContain("Test Corp");
    expect(prompt).toContain("invoice");
    expect(prompt).toContain("EUR");
  });
});
```

### Example 2: Tool Test

```typescript
// __tests__/ai/tools/get-invoices.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getInvoicesTool } from "../../../ai/tools/get-invoices";
import * as invoiceQueries from "../../../db/queries/invoices";

describe("Get Invoices Tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return formatted invoices", async () => {
    // Mock query result
    vi.spyOn(invoiceQueries, "findAll").mockResolvedValue({
      data: [
        {
          id: "inv-1",
          invoiceNumber: "INV-001",
          status: "paid",
          total: 1000,
          currency: "EUR",
          dueDate: "2024-12-01",
          createdAt: "2024-11-01",
        },
      ],
      total: 1,
    });

    const result = await getInvoicesTool.execute({ pageSize: 10 });

    expect(result.text).toContain("INV-001");
    expect(result.text).toContain("paid");
    expect(result.text).toContain("€1,000");
    expect(result.link?.url).toBe("/dashboard/sales/invoices");
  });

  it("should handle empty results", async () => {
    vi.spyOn(invoiceQueries, "findAll").mockResolvedValue({
      data: [],
      total: 0,
    });

    const result = await getInvoicesTool.execute({ pageSize: 10 });

    expect(result.text).toBe("No invoices found matching your criteria.");
  });
});
```

---

## Integration Patterns

### Pattern 1: AI-Enhanced Form

```typescript
// components/smart-invoice-form.tsx
"use client";

import { useState } from "react";
import { findBestCategory } from "@crm/categories";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

export function SmartInvoiceForm() {
  const [items, setItems] = useState([]);

  // AI suggests product description
  const suggestDescription = async (productName: string) => {
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt: `Generate a professional invoice description for: ${productName}`,
    });

    return text;
  };

  // AI suggests category
  const suggestCategory = async (description: string) => {
    const match = await findBestCategory(description);
    return match?.category;
  };

  // AI validates amounts
  const validateAmount = async (amount: number, description: string) => {
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt: `Is €${amount} a reasonable price for "${description}"? Answer yes or no with brief explanation.`,
    });

    return text;
  };

  return <form>{/* Form fields with AI assistance */}</form>;
}
```

### Pattern 2: Background AI Processing

```typescript
// jobs/ai-categorization.job.ts
import { Job } from "bullmq";
import { categoryEmbeddings } from "@crm/categories";
import { sql as db } from "../db/client";

export async function autoCategorizeJob(job: Job) {
  const { transactionIds } = job.data;

  // Pre-compute embeddings once
  await categoryEmbeddings.precompute();

  let processed = 0;
  let categorized = 0;

  for (const id of transactionIds) {
    try {
      const tx = await db`SELECT * FROM transactions WHERE id = ${id}`;
      if (tx.length === 0) continue;

      const description = tx[0].description || tx[0].merchant_name;
      const match = await categoryEmbeddings.findBest(description);

      if (match && match.similarity > 0.7) {
        await db`
          UPDATE transactions
          SET category_id = ${match.category.id}
          WHERE id = ${id}
        `;
        categorized++;
      }

      processed++;

      // Update job progress
      await job.updateProgress((processed / transactionIds.length) * 100);
    } catch (error) {
      console.error(`Failed to categorize ${id}:`, error);
    }
  }

  return {
    processed,
    categorized,
    manual: processed - categorized,
  };
}
```

---

## Resources

- [Main AI Documentation](./AI_README.md)
- [Vercel AI SDK Examples](https://sdk.vercel.ai/examples)
- [OpenAI Cookbook](https://github.com/openai/openai-cookbook)

---

**Last Updated**: 2024-12-02  
**Version**: 1.0.0
