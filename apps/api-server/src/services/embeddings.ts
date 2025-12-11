/**
 * AI Embedding Service
 * Uses Google Gemini for generating semantic embeddings
 * Adapted from Midday's embedding system
 */

import { serviceLogger } from "../lib/logger";

// Configuration
const EMBEDDING_CONFIG = {
  model: "text-embedding-004", // Google's latest embedding model
  dimensions: 768,
  taskType: "SEMANTIC_SIMILARITY",
};

// API key from environment
const GOOGLE_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<{
  embedding: number[];
  model: string;
}> {
  if (!GOOGLE_API_KEY) {
    serviceLogger.warn("GOOGLE_GENERATIVE_AI_API_KEY not set, using mock embedding");
    return {
      embedding: new Array(768).fill(0).map(() => Math.random() - 0.5),
      model: "mock",
    };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_CONFIG.model}:embedContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: `models/${EMBEDDING_CONFIG.model}`,
          content: {
            parts: [{ text }],
          },
          taskType: EMBEDDING_CONFIG.taskType,
          outputDimensionality: EMBEDDING_CONFIG.dimensions,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Embedding API error: ${error}`);
    }

    const data = (await response.json()) as { embedding?: { values?: number[] } };
    const embedding = data.embedding?.values;

    if (!embedding || !Array.isArray(embedding)) {
      throw new Error("Invalid embedding response");
    }

    return {
      embedding,
      model: EMBEDDING_CONFIG.model,
    };
  } catch (error) {
    serviceLogger.error({ error }, "Error generating embedding");
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts (batch)
 */
export async function generateEmbeddings(texts: string[]): Promise<{
  embeddings: number[][];
  model: string;
}> {
  if (!GOOGLE_API_KEY) {
    serviceLogger.warn("GOOGLE_GENERATIVE_AI_API_KEY not set, using mock embeddings");
    return {
      embeddings: texts.map(() => new Array(768).fill(0).map(() => Math.random() - 0.5)),
      model: "mock",
    };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_CONFIG.model}:batchEmbedContents?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: texts.map((text) => ({
            model: `models/${EMBEDDING_CONFIG.model}`,
            content: {
              parts: [{ text }],
            },
            taskType: EMBEDDING_CONFIG.taskType,
            outputDimensionality: EMBEDDING_CONFIG.dimensions,
          })),
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Batch embedding API error: ${error}`);
    }

    const data = (await response.json()) as { embeddings?: Array<{ values: number[] }> };
    const embeddings = data.embeddings?.map((e) => e.values);

    if (!embeddings || !Array.isArray(embeddings)) {
      throw new Error("Invalid batch embedding response");
    }

    return {
      embeddings,
      model: EMBEDDING_CONFIG.model,
    };
  } catch (error) {
    serviceLogger.error({ error }, "Error generating batch embeddings");
    throw error;
  }
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Embeddings must have same dimensions");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return similarity;
}

/**
 * Calculate cosine distance (1 - similarity)
 * Lower distance = more similar
 */
export function cosineDistance(a: number[], b: number[]): number {
  return 1 - cosineSimilarity(a, b);
}

/**
 * Prepare text for inbox embedding
 */
export function prepareInboxText(item: {
  displayName: string | null;
  website: string | null;
  description?: string | null;
}): string {
  const parts: string[] = [];

  if (item.displayName) {
    parts.push(item.displayName);
  }

  if (item.website) {
    // Extract domain from URL
    try {
      const url = new URL(item.website);
      parts.push(url.hostname.replace("www.", ""));
    } catch {
      parts.push(item.website);
    }
  }

  if (item.description) {
    parts.push(item.description);
  }

  return parts.join(" ").trim() || "unknown";
}

/**
 * Prepare text for transaction embedding
 */
export function prepareTransactionText(item: {
  name: string | null;
  description: string | null;
  merchantName?: string | null;
}): string {
  const parts: string[] = [];

  if (item.merchantName) {
    parts.push(item.merchantName);
  }

  if (item.name) {
    parts.push(item.name);
  }

  if (item.description) {
    parts.push(item.description);
  }

  return parts.join(" ").trim() || "unknown";
}

export default {
  generateEmbedding,
  generateEmbeddings,
  cosineSimilarity,
  cosineDistance,
  prepareInboxText,
  prepareTransactionText,
};
