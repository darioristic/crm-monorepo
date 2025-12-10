/**
 * AI Product Filter API Route
 *
 * Parses natural language queries into structured filters for product search.
 * Uses AI to understand user intent and map to categories, price ranges, and availability.
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

// Product statuses
const PRODUCT_STATUSES = ["active", "inactive", "discontinued", "out_of_stock"] as const;
type ProductStatus = (typeof PRODUCT_STATUSES)[number];

interface ProductFilterResult {
  status?: ProductStatus[];
  category?: string[];
  priceRange?: {
    min?: number;
    max?: number;
  };
  inStock?: boolean;
  isRecurring?: boolean;
  hasTax?: boolean;
  searchQuery?: string;
  sortBy?: "name" | "price" | "createdAt" | "popularity";
  sortOrder?: "asc" | "desc";
}

async function parseWithAI(
  query: string,
  availableCategories: string[] = []
): Promise<ProductFilterResult> {
  if (!AI_CONFIG.apiKey) {
    return { searchQuery: query };
  }

  const systemPrompt = `You are a search filter parser for a product catalog system. Convert natural language queries into structured filters.

Return a JSON object with these optional fields:
- status: Array of product statuses from: ${PRODUCT_STATUSES.join(", ")}
- category: Array of category names
- priceRange: Object with "min" and/or "max" prices as numbers
- inStock: Boolean for stock availability
- isRecurring: Boolean for subscription/recurring products
- hasTax: Boolean for taxable products
- searchQuery: Cleaned up search terms (product name, SKU, etc.)
- sortBy: One of "name", "price", "createdAt", "popularity"
- sortOrder: "asc" or "desc"

Status mapping:
- "available" / "active" -> ["active"]
- "unavailable" / "disabled" -> ["inactive"]
- "discontinued" / "retired" -> ["discontinued"]
- "out of stock" / "sold out" -> ["out_of_stock"]

Price parsing:
- "cheap" / "budget" / "affordable" -> { "max": 50 }
- "expensive" / "premium" / "high-end" -> { "min": 500 }
- "mid-range" / "moderate" -> { "min": 50, "max": 500 }
- "under $100" -> { "max": 100 }
- "over $1000" -> { "min": 1000 }
- "between $50 and $200" -> { "min": 50, "max": 200 }
- "free" -> { "max": 0 }

Product type parsing:
- "subscription" / "recurring" / "monthly" -> isRecurring: true
- "one-time" / "single purchase" -> isRecurring: false
- "taxable" -> hasTax: true
- "tax-free" / "non-taxable" -> hasTax: false

Stock parsing:
- "in stock" / "available now" -> inStock: true
- "out of stock" / "backordered" -> inStock: false

${availableCategories.length ? `Available categories: ${availableCategories.join(", ")}` : "Common categories: Software, Hardware, Services, Consulting, Training, Support, License"}

Examples:
- "cheap software products" -> { "category": ["Software"], "priceRange": { "max": 50 } }
- "premium services over $1000" -> { "category": ["Services"], "priceRange": { "min": 1000 } }
- "subscription products in stock" -> { "isRecurring": true, "inStock": true }
- "discontinued items" -> { "status": ["discontinued"] }
- "products sorted by price" -> { "sortBy": "price", "sortOrder": "asc" }
- "most expensive first" -> { "sortBy": "price", "sortOrder": "desc" }

IMPORTANT: Only return valid JSON, no markdown, no explanation.`;

  const userPrompt = `Parse this product search query: "${query}"`;

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
      return JSON.parse(jsonMatch[0]) as ProductFilterResult;
    }

    return JSON.parse(content) as ProductFilterResult;
  } catch (error) {
    logger.error("AI product filter parsing error:", error);
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
    const { query, availableCategories = [] } = body as {
      query: string;
      availableCategories?: string[];
    };

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query parameter is required" }, { status: 400 });
    }

    const result = await parseWithAI(query, availableCategories);
    return NextResponse.json(result);
  } catch (error) {
    logger.error("AI product filter endpoint error:", error);
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
    logger.error("AI product filter endpoint error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
