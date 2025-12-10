/**
 * AI Customer Filter API Route
 *
 * Parses natural language queries into structured filters for customer search.
 * Uses AI to understand user intent and map to customer types, industries, and locations.
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

// Customer types
const CUSTOMER_TYPES = ["lead", "prospect", "customer", "churned", "partner"] as const;
type CustomerType = (typeof CUSTOMER_TYPES)[number];

interface CustomerFilterResult {
  type?: CustomerType[];
  industry?: string[];
  country?: string;
  city?: string;
  hasRecentActivity?: boolean;
  createdDateRange?: {
    start?: string;
    end?: string;
  };
  revenueRange?: {
    min?: number;
    max?: number;
  };
  searchQuery?: string;
  sortBy?: "name" | "revenue" | "createdAt" | "lastActivity";
  sortOrder?: "asc" | "desc";
}

async function parseWithAI(
  query: string,
  availableIndustries: string[] = []
): Promise<CustomerFilterResult> {
  if (!AI_CONFIG.apiKey) {
    return { searchQuery: query };
  }

  const today = new Date().toISOString().split("T")[0];

  const systemPrompt = `You are a search filter parser for a CRM customer management system. Convert natural language queries into structured filters.

Return a JSON object with these optional fields:
- type: Array of customer types from: ${CUSTOMER_TYPES.join(", ")}
- industry: Array of industry names
- country: Country name or code
- city: City name
- hasRecentActivity: Boolean for active customers
- createdDateRange: Object with "start" and/or "end" dates in YYYY-MM-DD format
- revenueRange: Object with "min" and/or "max" lifetime revenue amounts
- searchQuery: Cleaned up search terms (company name, contact name, etc.)
- sortBy: One of "name", "revenue", "createdAt", "lastActivity"
- sortOrder: "asc" or "desc"

Type mapping:
- "leads" / "new leads" -> ["lead"]
- "prospects" / "potential" -> ["prospect"]
- "active customers" / "current" -> ["customer"]
- "lost" / "churned" / "inactive" -> ["churned"]
- "partners" / "affiliates" -> ["partner"]
- "all customers" -> ["customer", "partner"]

Activity parsing:
- "active" / "recent" / "engaged" -> hasRecentActivity: true
- "inactive" / "dormant" / "cold" -> hasRecentActivity: false

Revenue parsing:
- "high value" / "enterprise" / "big" -> { "min": 50000 }
- "small" / "starter" / "low value" -> { "max": 5000 }
- "medium" / "mid-market" -> { "min": 5000, "max": 50000 }

Location parsing:
- "in USA" / "US customers" -> { "country": "USA" }
- "European" / "EU" -> { "country": "EU" }
- "from New York" -> { "city": "New York" }

${availableIndustries.length ? `Available industries: ${availableIndustries.join(", ")}` : "Common industries: Technology, Healthcare, Finance, Retail, Manufacturing, Education, Real Estate"}

Examples:
- "tech companies in California" -> { "industry": ["Technology"], "country": "USA", "city": "California" }
- "active enterprise customers" -> { "type": ["customer"], "hasRecentActivity": true, "revenueRange": { "min": 50000 } }
- "new leads from last month" -> { "type": ["lead"], "createdDateRange": { "start": "2024-10-01", "end": "2024-10-31" } }
- "churned healthcare customers" -> { "type": ["churned"], "industry": ["Healthcare"] }
- "top customers by revenue" -> { "type": ["customer"], "sortBy": "revenue", "sortOrder": "desc" }

IMPORTANT: Only return valid JSON, no markdown, no explanation.`;

  const userPrompt = `Parse this customer search query: "${query}"
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
      return JSON.parse(jsonMatch[0]) as CustomerFilterResult;
    }

    return JSON.parse(content) as CustomerFilterResult;
  } catch (error) {
    logger.error("AI customer filter parsing error:", error);
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
    const { query, availableIndustries = [] } = body as {
      query: string;
      availableIndustries?: string[];
    };

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query parameter is required" }, { status: 400 });
    }

    const result = await parseWithAI(query, availableIndustries);
    return NextResponse.json(result);
  } catch (error) {
    logger.error("AI customer filter endpoint error:", error);
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
    logger.error("AI customer filter endpoint error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
