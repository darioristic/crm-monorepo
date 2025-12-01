/**
 * AI Service for Document Processing
 *
 * Handles AI-powered document classification, extraction, and filtering
 * using OpenAI or compatible APIs.
 */

import { logger } from "../lib/logger";
import * as fileStorage from "./file-storage.service";

// ============================================
// Types
// ============================================

export interface DocumentClassificationInput {
	documentId: string;
	companyId: string;
	filePath: string[];
	mimetype: string;
}

export interface DocumentClassificationResult {
	title?: string;
	summary?: string;
	tags?: string[];
	language?: string;
	date?: string;
	confidence?: number;
}

export interface AIFilterInput {
	query: string;
	availableTags?: string[];
}

export interface AIFilterResult {
	tags?: string[];
	dateRange?: {
		start?: string;
		end?: string;
	};
	searchQuery?: string;
}

// ============================================
// Configuration
// ============================================

const AI_CONFIG = {
	apiKey: process.env.OPENAI_API_KEY || process.env.AI_API_KEY,
	baseUrl:
		process.env.OPENAI_BASE_URL ||
		process.env.AI_BASE_URL ||
		"https://api.openai.com/v1",
	model: process.env.AI_MODEL || "gpt-4o-mini",
	maxTokens: parseInt(process.env.AI_MAX_TOKENS || "1000", 10),
};

// ============================================
// Helper Functions
// ============================================

async function callAI(
	systemPrompt: string,
	userPrompt: string,
	options?: { maxTokens?: number; temperature?: number },
): Promise<string | null> {
	if (!AI_CONFIG.apiKey) {
		logger.warn("AI API key not configured, skipping AI processing");
		return null;
	}

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
				max_tokens: options?.maxTokens || AI_CONFIG.maxTokens,
				temperature: options?.temperature || 0.3,
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			logger.error({ status: response.status, error }, "AI API error");
			return null;
		}

		const data = (await response.json()) as {
			choices: Array<{ message: { content: string } }>;
		};
		return data.choices[0]?.message?.content || null;
	} catch (error) {
		logger.error({ error }, "Failed to call AI API");
		return null;
	}
}

function parseJSONResponse<T>(response: string | null): T | null {
	if (!response) return null;

	try {
		// Try to extract JSON from the response
		const jsonMatch = response.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			return JSON.parse(jsonMatch[0]) as T;
		}
		return JSON.parse(response) as T;
	} catch {
		logger.warn({ response }, "Failed to parse AI response as JSON");
		return null;
	}
}

// ============================================
// AI Service
// ============================================

export const aiService = {
	/**
	 * Check if AI is configured and available
	 */
	isConfigured(): boolean {
		return Boolean(AI_CONFIG.apiKey);
	},

	/**
	 * Classify a document and extract metadata
	 */
	async classifyDocument(
		input: DocumentClassificationInput,
	): Promise<DocumentClassificationResult> {
		const { documentId, companyId, filePath, mimetype } = input;

		logger.info({ documentId, mimetype }, "Classifying document");

		// Read file content for text-based files
		let fileContent = "";
		const filename = filePath[filePath.length - 1] || "document";

		if (
			mimetype.includes("text") ||
			mimetype === "application/pdf" ||
			mimetype.includes("document")
		) {
			try {
				const buffer = await fileStorage.readFileAsBuffer(filePath);
				if (buffer) {
					// For now, we'll use the filename and basic info
					// In a full implementation, you'd extract text from PDFs/documents
					fileContent = `Filename: ${filename}\nMimetype: ${mimetype}\nSize: ${buffer.length} bytes`;
				}
			} catch (error) {
				logger.warn({ error }, "Could not read file content");
			}
		}

		const systemPrompt = `You are a document classifier. Analyze the document information and provide structured metadata.
Return a JSON object with these fields:
- title: A clear, descriptive title for the document (max 100 chars)
- summary: A brief summary of what the document contains (max 500 chars)
- tags: An array of 1-5 relevant tags (e.g., "invoice", "contract", "receipt", "report", "personal")
- language: The detected language code (e.g., "en", "sr", "de")
- date: If a date is mentioned, extract it in YYYY-MM-DD format
- confidence: A number 0-1 indicating your confidence

Only return valid JSON, no explanation.`;

		const userPrompt = `Classify this document:
Filename: ${filename}
Type: ${mimetype}
${fileContent ? `Content preview:\n${fileContent.slice(0, 1000)}` : ""}`;

		const response = await callAI(systemPrompt, userPrompt);
		const result = parseJSONResponse<DocumentClassificationResult>(response);

		if (!result) {
			// Return basic fallback
			return {
				title: filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
				summary: `A ${mimetype.split("/")[1] || "document"} file`,
				tags: [],
				confidence: 0,
			};
		}

		logger.info({ documentId, result }, "Document classified");
		return result;
	},

	/**
	 * Parse natural language filter query into structured filters
	 */
	async parseFilterQuery(input: AIFilterInput): Promise<AIFilterResult> {
		const { query, availableTags = [] } = input;

		logger.info({ query }, "Parsing filter query");

		const systemPrompt = `You are a search filter parser. Convert natural language queries into structured filters for a document search.
Return a JSON object with these optional fields:
- tags: Array of matching tag names from the available tags list
- dateRange: Object with "start" and/or "end" dates in YYYY-MM-DD format
- searchQuery: Cleaned up search terms for text search

Available tags: ${availableTags.join(", ") || "none"}

Examples:
- "invoices from last month" -> { "tags": ["invoice"], "dateRange": { "start": "2024-10-01", "end": "2024-10-31" } }
- "contracts 2024" -> { "tags": ["contract"], "dateRange": { "start": "2024-01-01", "end": "2024-12-31" } }
- "find receipts" -> { "tags": ["receipt"] }

Only return valid JSON, no explanation.`;

		const userPrompt = `Parse this search query: "${query}"
Today's date: ${new Date().toISOString().split("T")[0]}`;

		const response = await callAI(systemPrompt, userPrompt, {
			maxTokens: 500,
			temperature: 0.1,
		});

		const result = parseJSONResponse<AIFilterResult>(response);

		if (!result) {
			// Return original query as search
			return {
				searchQuery: query,
			};
		}

		logger.info({ query, result }, "Filter query parsed");
		return result;
	},

	/**
	 * Generate a summary for multiple documents
	 */
	async summarizeDocuments(
		documents: Array<{ title: string; summary?: string }>,
	): Promise<string | null> {
		if (documents.length === 0) return null;

		const systemPrompt = `You are a document summarizer. Given a list of documents, provide a brief overall summary of what the collection contains. Keep it under 200 characters.`;

		const userPrompt = `Summarize this document collection:
${documents.map((d, i) => `${i + 1}. ${d.title}${d.summary ? `: ${d.summary}` : ""}`).join("\n")}`;

		return callAI(systemPrompt, userPrompt, { maxTokens: 100 });
	},

	/**
	 * Suggest tags for a document based on content
	 */
	async suggestTags(
		content: string,
		existingTags: string[],
	): Promise<string[]> {
		const systemPrompt = `You are a tag suggester. Suggest 1-5 relevant tags for the given content.
Only suggest tags from this list if applicable: ${existingTags.join(", ")}
You can also suggest new tags if none of the existing ones fit.
Return only a JSON array of tag strings.`;

		const userPrompt = `Content: ${content.slice(0, 2000)}`;

		const response = await callAI(systemPrompt, userPrompt, { maxTokens: 200 });

		if (!response) return [];

		try {
			const tags = JSON.parse(response);
			return Array.isArray(tags)
				? tags.filter((t) => typeof t === "string").slice(0, 5)
				: [];
		} catch {
			return [];
		}
	},
};

export default aiService;

