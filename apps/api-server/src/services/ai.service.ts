/**
 * AI Service for Document Processing
 *
 * Handles AI-powered document classification, extraction, and filtering
 * using OpenAI or compatible APIs.
 */

import { logger } from "../lib/logger";
import { documentLoader } from "./document-loader.service";
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
  baseUrl: process.env.OPENAI_BASE_URL || process.env.AI_BASE_URL || "https://api.openai.com/v1",
  model: process.env.AI_MODEL || "gpt-4o-mini",
  maxTokens: parseInt(process.env.AI_MAX_TOKENS || "1000", 10),
};

// ============================================
// Helper Functions
// ============================================

async function callAI(
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number; temperature?: number }
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
    input: DocumentClassificationInput
  ): Promise<DocumentClassificationResult> {
    const { documentId, filePath, mimetype } = input;

    logger.info({ documentId, mimetype }, "Classifying document");

    const filename = filePath[filePath.length - 1] || "document";
    let extractedContent = "";

    // Extract actual text content from the document
    if (documentLoader.isSupportedForExtraction(mimetype)) {
      try {
        const buffer = await fileStorage.readFileAsBuffer(filePath);
        if (buffer) {
          const fullContent = await documentLoader.loadDocument({
            content: buffer,
            mimetype,
          });

          if (fullContent && fullContent.length > 0) {
            // Get a sample of the content for AI processing (max 5000 chars)
            extractedContent = documentLoader.getContentSample(fullContent, 5000);
            logger.info(
              {
                documentId,
                contentLength: fullContent.length,
                sampleLength: extractedContent.length,
              },
              "Document text extracted successfully"
            );
          } else {
            logger.warn({ documentId }, "No text could be extracted from document");
          }
        }
      } catch (error) {
        logger.warn({ error, documentId }, "Could not extract document content");
      }
    }

    // Build the prompt with actual document content
    const systemPrompt = `You are an expert multilingual document analyzer. Your task is to analyze the provided business document and generate structured metadata.

Return a JSON object with these fields:
- title: A clear, descriptive title for the document. If no clear title exists, create one from the content (max 100 chars)
- summary: A single sentence capturing the essence of the document (e.g., "Invoice from Supplier X for services rendered in May 2024", "Employment agreement between Company Y and John Doe", "Quarterly financial report for Q1 2024")
- tags: Up to 5 highly relevant and distinct tags. STRONGLY PRIORITIZE:
  * The inferred document type (e.g., "Invoice", "Contract", "Receipt", "Report", "Agreement")
  * Key company or individual names explicitly mentioned
  * The core subject or 1-2 defining keywords from the content
  * If a purchase document, include the most significant item or service purchased
  Make tags concise and informative. Ensure all tags are in singular form (e.g., "Invoice" not "Invoices")
- language: The language as a PostgreSQL text search configuration name (e.g., "english", "serbian", "german", "french")
- date: The single most relevant date (e.g., issue date, signing date) in ISO 8601 format (YYYY-MM-DD). If no clear date, return null
- confidence: A number 0-1 indicating your confidence in the classification

IMPORTANT RULES:
- Analyze the actual document content carefully
- Avoid overly generic tags like "document", "file", "text"
- Do not use date-related tags (the date is extracted separately)
- Base tags strictly on the content provided
- Return ONLY valid JSON, no markdown, no explanation

Examples of good tags: "Invoice", "Contract", "Receipt", "Tax Return", "Employment Agreement", "Consulting Services", "Software License", "Financial Report"`;

    let userPrompt: string;
    if (extractedContent && extractedContent.length > 50) {
      // We have actual document content - use it for classification
      userPrompt = `Classify this document based on its content:

Filename: ${filename}
Type: ${mimetype}

Document Content:
${extractedContent}`;
    } else {
      // Fallback to filename-based classification
      userPrompt = `Classify this document based on filename only (no content available):

Filename: ${filename}
Type: ${mimetype}

Please infer the document type and create appropriate metadata based on the filename.`;
    }

    const response = await callAI(systemPrompt, userPrompt, {
      maxTokens: 800,
      temperature: 0.3,
    });
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
    documents: Array<{ title: string; summary?: string }>
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
  async suggestTags(content: string, existingTags: string[]): Promise<string[]> {
    const systemPrompt = `You are a tag suggester. Suggest 1-5 relevant tags for the given content.
Only suggest tags from this list if applicable: ${existingTags.join(", ")}
You can also suggest new tags if none of the existing ones fit.
Return only a JSON array of tag strings.`;

    const userPrompt = `Content: ${content.slice(0, 2000)}`;

    const response = await callAI(systemPrompt, userPrompt, { maxTokens: 200 });

    if (!response) return [];

    try {
      const tags = JSON.parse(response);
      return Array.isArray(tags) ? tags.filter((t) => typeof t === "string").slice(0, 5) : [];
    } catch {
      return [];
    }
  },

  /**
   * Generate text completion with a simple prompt
   */
  async generateText(options: {
    prompt: string;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<string> {
    const systemPrompt = options.systemPrompt || "You are a helpful assistant. Be concise and direct.";

    const response = await callAI(systemPrompt, options.prompt, {
      maxTokens: options.maxTokens || 500,
      temperature: options.temperature || 0.3,
    });

    return response || "";
  },
};

export default aiService;
