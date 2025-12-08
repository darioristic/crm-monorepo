import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embed, embedMany } from "ai";
import { ALL_CATEGORIES } from "./categories";
import { logger } from "./logger"; // TODO: Adjust path
import type { Category, CategoryMatch, EmbeddingResult, EmbeddingsResult } from "./types";

const GOOGLE_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

// Create Google AI client
const google = GOOGLE_API_KEY ? createGoogleGenerativeAI({ apiKey: GOOGLE_API_KEY }) : null;

const EMBEDDING_CONFIG = {
  modelName: "text-embedding-004",
  dimensions: 768,
};

/**
 * Generate a single embedding for text
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  if (!google) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not configured");
  }

  const model = google.textEmbeddingModel(EMBEDDING_CONFIG.modelName);

  const { embedding } = await embed({
    model: model as any,
    value: text,
  });

  return {
    embedding,
    model: EMBEDDING_CONFIG.modelName,
  };
}

/**
 * Generate embeddings for multiple texts
 */
export async function generateEmbeddings(texts: string[]): Promise<EmbeddingsResult> {
  if (!google) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not configured");
  }

  const model = google.textEmbeddingModel(EMBEDDING_CONFIG.modelName);

  const { embeddings } = await embedMany({
    model: model as any,
    values: texts,
  });

  return {
    embeddings,
    model: EMBEDDING_CONFIG.modelName,
  };
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * Find the best matching category for a given text
 */
export async function findBestCategory(
  text: string,
  categories: Category[] = ALL_CATEGORIES,
  categoryEmbeddings?: Map<string, number[]>
): Promise<CategoryMatch | null> {
  try {
    // Generate embedding for the input text
    const { embedding: textEmbedding } = await generateEmbedding(text);

    // If category embeddings are provided, use them
    // Otherwise, generate them on the fly
    let catEmbeddings = categoryEmbeddings;

    if (!catEmbeddings) {
      const categoryNames = categories.map((c) => c.name);
      const { embeddings } = await generateEmbeddings(categoryNames);

      catEmbeddings = new Map();
      categories.forEach((cat, idx) => {
        catEmbeddings!.set(cat.id, embeddings[idx]);
      });
    }

    // Find best match
    let bestMatch: CategoryMatch | null = null;

    for (const category of categories) {
      const catEmbedding = catEmbeddings.get(category.id);
      if (!catEmbedding) continue;

      const similarity = cosineSimilarity(textEmbedding, catEmbedding);

      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = { category, similarity };
      }
    }

    return bestMatch;
  } catch (error) {
    logger.error("Error finding best category:", error);
    return null;
  }
}

/**
 * Find top N matching categories for a given text
 */
export async function findTopCategories(
  text: string,
  topN = 3,
  categories: Category[] = ALL_CATEGORIES
): Promise<CategoryMatch[]> {
  try {
    // Generate embedding for the input text
    const { embedding: textEmbedding } = await generateEmbedding(text);

    // Generate embeddings for all categories
    const categoryNames = categories.map((c) => c.name);
    const { embeddings: catEmbeddings } = await generateEmbeddings(categoryNames);

    // Calculate similarities
    const matches: CategoryMatch[] = categories.map((cat, idx) => ({
      category: cat,
      similarity: cosineSimilarity(textEmbedding, catEmbeddings[idx]),
    }));

    // Sort by similarity and return top N
    return matches.sort((a, b) => b.similarity - a.similarity).slice(0, topN);
  } catch (error) {
    logger.error("Error finding top categories:", error);
    return [];
  }
}

/**
 * Category Embeddings Service class
 */
export class CategoryEmbeddings {
  private cache = new Map<string, number[]>();

  /**
   * Generate embedding for a single text
   */
  public async embed(text: string): Promise<EmbeddingResult> {
    return generateEmbedding(text);
  }

  /**
   * Generate embeddings for multiple texts
   */
  public async embedMany(texts: string[]): Promise<EmbeddingsResult> {
    return generateEmbeddings(texts);
  }

  /**
   * Find best matching category
   */
  public async findBest(text: string): Promise<CategoryMatch | null> {
    return findBestCategory(text, ALL_CATEGORIES, this.cache.size > 0 ? this.cache : undefined);
  }

  /**
   * Find top matching categories
   */
  public async findTop(text: string, topN = 3): Promise<CategoryMatch[]> {
    return findTopCategories(text, topN);
  }

  /**
   * Pre-compute and cache category embeddings
   */
  public async precompute(categories: Category[] = ALL_CATEGORIES): Promise<void> {
    const names = categories.map((c) => c.name);
    const { embeddings } = await generateEmbeddings(names);

    categories.forEach((cat, idx) => {
      this.cache.set(cat.id, embeddings[idx]);
    });
  }

  /**
   * Clear the embedding cache
   */
  public clearCache(): void {
    this.cache.clear();
  }
}

// Singleton instance
export const categoryEmbeddings = new CategoryEmbeddings();
