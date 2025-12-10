/**
 * AI Invoice Filter API Route
 *
 * Parses natural language queries into structured filters for invoice search.
 * Uses AI to understand user intent and map to invoice statuses, date ranges, and amounts.
 */

import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

// AI Configuration
const AI_CONFIG = {
  apiKey: process.env.OPENAI_API_KEY || process.env.AI_API_KEY,
  baseUrl: process.env.OPENAI_BASE_URL || process.env.AI_BASE_URL || "https://api.openai.com/v1",
  model: process.env.AI_MODEL || "gpt-4o-mini",
};

// Invoice statuses
const INVOICE_STATUSES = ["draft", "sent", "paid", "overdue", "cancelled", "partial"] as const;
type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

interface InvoiceFilterResult {
  status?: InvoiceStatus[];
  dateRange?: {
    start?: string;
    end?: string;
  };
  dueDateRange?: {
    start?: string;
    end?: string;
  };
  amountRange?: {
    min?: number;
    max?: number;
  };
  customerName?: string;
  searchQuery?: string;
  sortBy?: "date" | "amount" | "dueDate" | "customer";
  sortOrder?: "asc" | "desc";
}

async function parseWithAI(query: string): Promise<InvoiceFilterResult> {
  if (!AI_CONFIG.apiKey) {
    return { searchQuery: query };
  }

  const today = new Date().toISOString().split("T")[0];

  const systemPrompt = `You are a search filter parser for an invoice management system. Convert natural language queries into structured filters.

Return a JSON object with these optional fields:
- status: Array of invoice statuses from: ${INVOICE_STATUSES.join(", ")}
- dateRange: Object with "start" and/or "end" dates (invoice date) in YYYY-MM-DD format
- dueDateRange: Object with "start" and/or "end" dates (due date) in YYYY-MM-DD format
- amountRange: Object with "min" and/or "max" amounts as numbers
- customerName: Customer/company name to filter by
- searchQuery: Cleaned up search terms (remove filter-related words)
- sortBy: One of "date", "amount", "dueDate", "customer"
- sortOrder: "asc" or "desc"

Status mapping:
- "unpaid" / "pending" / "outstanding" -> ["sent", "overdue"]
- "overdue" / "late" / "past due" -> ["overdue"]
- "paid" / "completed" / "settled" -> ["paid"]
- "draft" / "unsent" -> ["draft"]
- "cancelled" / "voided" -> ["cancelled"]
- "partial" / "partially paid" -> ["partial"]

Amount parsing:
- "over $1000" / "more than 1000" -> { "min": 1000 }
- "under $500" / "less than 500" -> { "max": 500 }
- "between $100 and $500" -> { "min": 100, "max": 500 }
- "large invoices" -> { "min": 5000 }
- "small invoices" -> { "max": 500 }

Date parsing:
- "last month" = previous calendar month
- "this month" = current calendar month
- "last week" = previous 7 days
- "this year" = current year
- "overdue" without date = dueDateRange.end < today

Examples:
- "unpaid invoices over $1000" -> { "status": ["sent", "overdue"], "amountRange": { "min": 1000 } }
- "invoices from Acme Corp" -> { "customerName": "Acme Corp" }
- "paid invoices last month" -> { "status": ["paid"], "dateRange": { "start": "2024-10-01", "end": "2024-10-31" } }
- "overdue invoices" -> { "status": ["overdue"] }
- "largest invoices" -> { "sortBy": "amount", "sortOrder": "desc" }
- "due this week" -> { "dueDateRange": { "start": "${today}", "end": "..." } }

IMPORTANT: Only return valid JSON, no markdown, no explanation.`;

  const userPrompt = `Parse this invoice search query: "${query}"
Today's date: ${today}`;

  try {
    const response = await fetch(`${AI_CONFIG.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_CONFIG.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_CONFIG.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 500,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      logger.error("AI API error:", response.status);
      return { searchQuery: query };
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices[0]?.message?.content;
    if (!content) {
      return { searchQuery: query };
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as InvoiceFilterResult;
    }

    return JSON.parse(content) as InvoiceFilterResult;
  } catch (error) {
    logger.error("AI invoice filter parsing error:", error);
    return { searchQuery: query };
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("access_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { query } = body as { query: string };

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query parameter is required" }, { status: 400 });
    }

    const result = await parseWithAI(query);
    return NextResponse.json(result);
  } catch (error) {
    logger.error("AI invoice filter endpoint error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query) {
      return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
    }

    const result = await parseWithAI(query);
    return NextResponse.json(result);
  } catch (error) {
    logger.error("AI invoice filter endpoint error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
