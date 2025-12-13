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
   * Uses Midday-style prompts with retry logic for better results
   */
  async classifyDocument(
    input: DocumentClassificationInput
  ): Promise<DocumentClassificationResult> {
    const { documentId, filePath, mimetype } = input;

    logger.info({ documentId, mimetype, filePath }, "Classifying document");

    const filename = filePath[filePath.length - 1] || "document";
    let extractedContent = "";

    // Extract actual text content from the document
    if (documentLoader.isSupportedForExtraction(mimetype)) {
      try {
        const buffer = await fileStorage.readFileAsBuffer(filePath);
        if (buffer) {
          logger.info({ documentId, bufferSize: buffer.length }, "File buffer read successfully");

          const fullContent = await documentLoader.loadDocument({
            content: buffer,
            mimetype,
          });

          if (fullContent && fullContent.length > 0) {
            // Get a sample of the content for AI processing (max 8000 chars for better context)
            extractedContent = documentLoader.getContentSample(fullContent, 8000);
            logger.info(
              {
                documentId,
                contentLength: fullContent.length,
                sampleLength: extractedContent.length,
              },
              "Document text extracted successfully"
            );
          } else {
            logger.warn({ documentId, mimetype }, "No text could be extracted from document");
          }
        } else {
          logger.warn({ documentId, filePath }, "Could not read file buffer");
        }
      } catch (error) {
        logger.error({ error, documentId, mimetype }, "Error extracting document content");
      }
    } else {
      logger.info({ documentId, mimetype }, "Mimetype not supported for text extraction");
    }

    // Midday-style document classifier prompt
    const systemPrompt = `You are an expert multilingual document analyzer. Your task is to read the provided business document text (which could be an Invoice, Receipt, Contract, Agreement, Report, etc.) and generate:

1. **Document Title (\`title\`) - REQUIRED:** You MUST provide a descriptive, meaningful title for this document. This field CANNOT be null. The title should be specific and identify the document clearly, suitable for use as a filename in a document vault.

   **GOOD Examples (specific and descriptive):**
   - "Invoice INV-2024-001 from Acme Corp"
   - "Invoice from Acme Corp - 2024-03-15"
   - "Receipt from Starbucks Coffee - 2024-03-15"
   - "Purchase from Amazon - Order #123-4567890"
   - "Service Agreement with Acme Corp - 2024-03-15"
   - "Q1 2024 Financial Report - Acme Corp"

   **BAD Examples (generic, unacceptable):**
   - "Invoice" (too generic)
   - "Receipt" (too generic)
   - "Document" (too generic)
   - "Business document" (too generic)
   - null (not allowed)

   **Requirements:**
   - ALWAYS include key identifying information: document number, company names, dates, or order numbers when available
   - Make it specific to THIS document - include unique identifiers
   - If you cannot find specific details, construct a title from available information (e.g., "Invoice from [Company Name] - [Date]" or "Receipt from [Store Name] - [Date]")
   - This title is critical for document identification in the vault - users rely on it to find documents

2. **A Concise Summary (\`summary\`):** A single sentence capturing the essence of the document (e.g., "Invoice from Supplier X for services rendered in May 2024", "Employment agreement between Company Y and John Doe", "Quarterly financial report for Q1 2024").

3. **The Most Relevant Date (\`date\`):** Identify the single most important date mentioned (e.g., issue date, signing date, effective date). Format it strictly as YYYY-MM-DD. If multiple dates exist, choose the primary one representing the document's core event. If no clear date is found, return null for this field.

4. **Relevant Tags (Up to 5):** Generate up to 5 highly relevant and distinct tags to help classify and find this document later. When creating these tags, **strongly prioritize including:**
   * The inferred **document type** (e.g., "Invoice", "Contract", "Receipt", "Report").
   * Key **company or individual names** explicitly mentioned.
   * The core **subject** or 1-2 defining keywords from the summary or document content.
   * If the document represents a purchase (like an invoice or receipt), include a tag for the **single most significant item or service** purchased (e.g., "Software License", "Consulting Services", "Office Desk").

5. **Language (\`language\`):** The language of the document as a PostgreSQL text search configuration name (e.g., 'english', 'swedish', 'german', 'french', 'serbian', 'croatian')

6. **Confidence (\`confidence\`):** A number 0-1 indicating your confidence in the classification

Make the tags concise and informative. Aim for tags that uniquely identify the document's key characteristics for searching. Avoid overly generic terms (like "document", "file", "text") or date-related tags (as the date is extracted separately). Base tags strictly on the content provided. Ensure all tags are in singular form (e.g., "item" instead of "items").

Return ONLY valid JSON, no markdown code blocks, no explanation.`;

    let userPrompt: string;
    const hasContent = extractedContent && extractedContent.length > 100;

    if (hasContent) {
      // We have actual document content - use it for classification
      userPrompt = `Analyze and classify this document:

Document Content:
${extractedContent}`;
    } else {
      // No content extracted - this is problematic but try to work with what we have
      logger.warn(
        { documentId, filename, mimetype },
        "No content available for classification, using filename only"
      );

      userPrompt = `The document content could not be extracted. Based on the available information, provide the best possible classification:

Filename: ${filename}
File Type: ${mimetype}

Since content is not available, you MUST still provide:
1. A title - construct it from the filename or file type (e.g., "PDF Document - ${new Date().toISOString().split("T")[0]}")
2. A summary describing what type of document this likely is based on the mimetype
3. Tags based on the file type (e.g., "PDF", "Document")
4. Set confidence to a low value (0.2-0.3) since content wasn't available

DO NOT return null for the title field. Even with limited information, create a descriptive title.`;
    }

    // First attempt
    let response = await callAI(systemPrompt, userPrompt, {
      maxTokens: 1000,
      temperature: 0.1,
    });
    let result = parseJSONResponse<DocumentClassificationResult>(response);

    // Retry if title is null or empty (Midday-style retry logic)
    if (!result?.title || result.title.trim().length === 0) {
      logger.warn(
        { documentId },
        "First classification attempt returned null/empty title, retrying with explicit prompt"
      );

      const retryPrompt = `${systemPrompt}

CRITICAL: The previous attempt returned a null or empty title, which is not acceptable. You MUST provide a title. Even if the document is unclear, construct a descriptive title from available information. Examples of acceptable titles even for unclear documents:
- "Business Document - ${new Date().toISOString().split("T")[0]}"
- "Invoice from [Company Name if visible]"
- "Receipt from [Store Name if visible]"
- "Contract Document - [Date if available]"
Never return null or empty for the title field.`;

      response = await callAI(retryPrompt, userPrompt, {
        maxTokens: 1000,
        temperature: 0.1,
      });
      result = parseJSONResponse<DocumentClassificationResult>(response);
    }

    // Final fallback if still no result
    if (!result) {
      logger.warn({ documentId, filename }, "Classification failed, using fallback");

      // Generate a reasonable fallback title
      const fileExt = mimetype.split("/")[1] || "document";
      const dateStr = new Date().toISOString().split("T")[0];

      return {
        title: `${fileExt.toUpperCase()} Document - ${dateStr}`,
        summary: `A ${fileExt} file uploaded on ${dateStr}`,
        tags: [fileExt.toUpperCase()],
        confidence: 0.1,
      };
    }

    // Ensure title is never null
    if (!result.title || result.title.trim().length === 0) {
      const fileExt = mimetype.split("/")[1] || "document";
      const dateStr = new Date().toISOString().split("T")[0];
      result.title = `${fileExt.toUpperCase()} Document - ${dateStr}`;
      result.confidence = Math.min(result.confidence || 0.5, 0.3);
    }

    logger.info(
      { documentId, title: result.title, confidence: result.confidence },
      "Document classified"
    );
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
    const systemPrompt =
      options.systemPrompt || "You are a helpful assistant. Be concise and direct.";

    const response = await callAI(systemPrompt, options.prompt, {
      maxTokens: options.maxTokens || 500,
      temperature: options.temperature || 0.3,
    });

    return response || "";
  },

  /**
   * Extract text from an image using OCR (GPT-4 Vision)
   * Uses Midday-style image classifier prompt for better results
   */
  async extractTextFromImage(input: {
    imageBuffer: Buffer;
    mimetype: string;
    filename?: string;
  }): Promise<{
    text: string;
    title?: string;
    summary?: string;
    tags?: string[];
    confidence: number;
  } | null> {
    if (!AI_CONFIG.apiKey) {
      logger.warn("AI API key not configured, skipping OCR");
      return null;
    }

    const { imageBuffer, mimetype, filename } = input;

    logger.info({ mimetype, filename, size: imageBuffer.length }, "Starting OCR extraction");

    try {
      // Convert buffer to base64
      const base64Image = imageBuffer.toString("base64");
      const dataUrl = `data:${mimetype};base64,${base64Image}`;

      // Midday-style image classifier prompt
      const systemPrompt = `Analyze the provided image and extract the following information:

1. **Document Title (\`title\`) - REQUIRED:** You MUST provide a descriptive, meaningful title for this image. This field CANNOT be null. The title should be specific and identify the document clearly, suitable for use as a filename in a document vault.

   **GOOD Examples (specific and descriptive):**
   - "Receipt from Starbucks Coffee - 2024-03-15"
   - "Invoice INV-2024-001 from Acme Corp"
   - "Acme Corp Logo"
   - "Product Photo - Widget Model X"
   - "Purchase from Amazon - Order #123-4567890"

   **BAD Examples (generic, unacceptable):**
   - "Receipt" (too generic)
   - "Invoice" (too generic)
   - "Image" (too generic)
   - "Photo" (too generic)
   - null (not allowed)

   **Requirements:**
   - ALWAYS include key identifying information: merchant/store names, dates, invoice numbers, or order numbers when visible
   - Make it specific to THIS document - include unique identifiers from the image
   - Use OCR to extract text from the image if needed to identify the document
   - If specific details aren't visible, construct a title from available visual information (e.g., "Receipt from [Visible Store Name] - [Visible Date]" or "Invoice from [Visible Company Name]")
   - This title is critical for document identification in the vault - users rely on it to find documents

2. **Summary (\`summary\`):** A brief, one-sentence summary identifying key business-related visual elements in the image (e.g., "Logo", "Branding", "Letterhead", "Invoice Design", "Product Photo", "Marketing Material", "Website Screenshot").

3. **Content (\`text\`):** Extract ALL visible text content from the image (OCR). This is especially important for receipts and invoices. Include:
   - For forms: All field labels and their values
   - For receipts: Merchant name, items, prices, totals, date, payment method
   - For invoices: Company names, invoice numbers, amounts, dates
   - For documents: Headings, paragraphs, and any structured data
   - For handwriting: Do your best to transcribe it
   - Preserve layout and structure as much as possible

4. **Tags (1-5):** Generate 1-5 concise, relevant tags describing its most important aspects.

   **Instructions for Tags:**
   * **If the image is a receipt or invoice:**
       * Extract the **merchant name** (e.g., "Slack", "Starbucks") as a tag.
       * Identify and tag the **most significant item(s) or service(s)** purchased (e.g., "Coffee", "Subscription", "Consulting Service").
       * Optionally, include relevant context tags like "Receipt", "Invoice", "Subscription", or "One-time Purchase".
   * **If the image is NOT a receipt or invoice:**
       * Describe the key **objects, subjects, or brands** visible (e.g., "Logo", "Letterhead", "Product Photo", "Acme Corp Branding").

   **Rules:**
   * Each tag must be 1–2 words long.
   * Ensure all tags are in singular form (e.g., "item" instead of "items").
   * Avoid generic words like "paper", "text", "photo", "image", "document" unless essential.
   * Prioritize concrete, specific tags.

5. **Confidence (\`confidence\`):** A number 0-1 indicating OCR quality (1 = perfect clarity, 0 = unreadable)

6. **Date (\`date\`):** If a date is visible in the image (transaction date, invoice date, etc.), extract it in YYYY-MM-DD format. Return null if no date is visible.

7. **Language (\`language\`):** The language of the text in the image as a PostgreSQL text search configuration name (e.g., 'english', 'serbian', 'german', 'french', 'croatian')

CRITICAL: Return ONLY valid JSON, no markdown code blocks, no explanation.`;

      // Use GPT-4 Vision for OCR
      const response = await fetch(`${AI_CONFIG.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AI_CONFIG.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.AI_VISION_MODEL || "gpt-4o",
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract all text from this image and classify the document. Include every piece of visible text.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: dataUrl,
                    detail: "high",
                  },
                },
              ],
            },
          ],
          max_tokens: 4000,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error({ status: response.status, error }, "Vision API error");
        return null;
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };

      const content = data.choices[0]?.message?.content;
      if (!content) {
        logger.warn("No content returned from Vision API");
        return null;
      }

      const result = parseJSONResponse<{
        text: string;
        title?: string;
        summary?: string;
        tags?: string[];
        confidence?: number;
        date?: string;
        language?: string;
      }>(content);

      if (!result || !result.text) {
        // If JSON parsing failed, use the raw content as text
        logger.warn(
          { content: content.slice(0, 200) },
          "Failed to parse OCR response as JSON, using raw content"
        );
        return {
          text: content,
          title: `Image Document - ${new Date().toISOString().split("T")[0]}`,
          confidence: 0.5,
        };
      }

      // Ensure title is never null
      if (!result.title || result.title.trim().length === 0) {
        const dateStr = new Date().toISOString().split("T")[0];
        result.title = `Image Document - ${dateStr}`;
      }

      logger.info(
        {
          textLength: result.text.length,
          title: result.title,
          tagCount: result.tags?.length || 0,
          confidence: result.confidence,
        },
        "OCR extraction completed"
      );

      return {
        text: result.text,
        title: result.title,
        summary: result.summary,
        tags: result.tags,
        confidence: result.confidence || 0.8,
      };
    } catch (error) {
      logger.error({ error }, "Failed to extract text from image");
      return null;
    }
  },

  /**
   * Check if a mimetype is an image that can be processed by OCR
   */
  isImageForOcr(mimetype: string): boolean {
    const supportedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
    return supportedTypes.includes(mimetype.toLowerCase());
  },
};

export default aiService;
