/**
 * AI Vault Filter API Route
 *
 * Parses natural language queries into structured filters for document search.
 * Uses AI to understand user intent and map to available tags and date ranges.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// AI Configuration
const AI_CONFIG = {
	apiKey: process.env.OPENAI_API_KEY || process.env.AI_API_KEY,
	baseUrl:
		process.env.OPENAI_BASE_URL ||
		process.env.AI_BASE_URL ||
		"https://api.openai.com/v1",
	model: process.env.AI_MODEL || "gpt-4o-mini",
};

interface AIFilterResult {
	tags?: string[];
	dateRange?: {
		start?: string;
		end?: string;
	};
	searchQuery?: string;
}

async function parseWithAI(
	query: string,
	availableTags: string[],
): Promise<AIFilterResult> {
	if (!AI_CONFIG.apiKey) {
		// Fallback: return query as search term
		return { searchQuery: query };
	}

	const today = new Date().toISOString().split("T")[0];

	const systemPrompt = `You are a search filter parser. Convert natural language queries into structured filters for a document search system.

Return a JSON object with these optional fields:
- tags: Array of matching tag names from the available tags list (case-insensitive match)
- dateRange: Object with "start" and/or "end" dates in YYYY-MM-DD format
- searchQuery: Cleaned up search terms for text search (remove filter-related words)

Available tags: ${availableTags.length ? availableTags.join(", ") : "invoice, contract, receipt, report, personal, tax, legal"}

Date parsing rules:
- "last month" = previous calendar month
- "this month" = current calendar month  
- "last week" = previous 7 days
- "this year" = current year
- "2024" = full year 2024
- "january" = January of current/nearest year

Examples:
- "invoices from last month" -> { "tags": ["invoice"], "dateRange": { "start": "2024-10-01", "end": "2024-10-31" } }
- "contracts 2024" -> { "tags": ["contract"], "dateRange": { "start": "2024-01-01", "end": "2024-12-31" } }
- "find receipts" -> { "tags": ["receipt"] }
- "tax documents" -> { "tags": ["tax"] }
- "company reports from january" -> { "tags": ["report"], "dateRange": { "start": "2024-01-01", "end": "2024-01-31" }, "searchQuery": "company" }

IMPORTANT: Only return valid JSON, no markdown, no explanation, just the JSON object.`;

	const userPrompt = `Parse this search query: "${query}"
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
			console.error("AI API error:", response.status);
			return { searchQuery: query };
		}

		const data = (await response.json()) as {
			choices: Array<{ message: { content: string } }>;
		};

		const content = data.choices[0]?.message?.content;
		if (!content) {
			return { searchQuery: query };
		}

		// Parse JSON from response
		const jsonMatch = content.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			return JSON.parse(jsonMatch[0]) as AIFilterResult;
		}

		return JSON.parse(content) as AIFilterResult;
	} catch (error) {
		console.error("AI filter parsing error:", error);
		return { searchQuery: query };
	}
}

export async function POST(request: NextRequest) {
	try {
		// Verify authentication
		const cookieStore = await cookies();
		const token = cookieStore.get("auth_token")?.value;

		if (!token) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const { query, availableTags = [] } = body as {
			query: string;
			availableTags?: string[];
		};

		if (!query || typeof query !== "string") {
			return NextResponse.json(
				{ error: "Query parameter is required" },
				{ status: 400 }
			);
		}

		// Parse the query with AI
		const result = await parseWithAI(query, availableTags);

		return NextResponse.json(result);
	} catch (error) {
		console.error("AI filter endpoint error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}

// Also support GET for simple queries
export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const query = searchParams.get("q");

		if (!query) {
			return NextResponse.json(
				{ error: "Query parameter 'q' is required" },
				{ status: 400 }
			);
		}

		const result = await parseWithAI(query, []);
		return NextResponse.json(result);
	} catch (error) {
		console.error("AI filter endpoint error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}

