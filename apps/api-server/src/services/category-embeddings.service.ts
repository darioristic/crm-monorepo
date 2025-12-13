/**
 * Category Embeddings Service
 *
 * Vector representations for transaction categories enabling:
 * - Semantic similarity between categories
 * - Smart category recommendations based on transaction text
 * - Automatic category suggestions
 */

import OpenAI from "openai";
import { sql as db } from "../db/client";
import * as categoryQueries from "../db/queries/transaction-categories";
import { logger } from "../lib/logger";

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Embedding model
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

export interface CategoryEmbedding {
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  embedding: number[];
  tenantId: string;
  updatedAt: string;
}

export interface CategoryRecommendation {
  categoryId: string;
  slug: string;
  name: string;
  similarity: number;
  description?: string;
}

/**
 * Generate embedding for text using OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  return response.data[0].embedding;
}

/**
 * Generate embedding text for a category
 * Combines name, description, and keywords for better representation
 */
function getCategoryEmbeddingText(category: {
  name: string;
  description?: string | null;
  slug: string;
}): string {
  const parts = [
    category.name,
    category.description || "",
    // Add common variations and keywords based on slug
    getCategoryKeywords(category.slug),
  ].filter(Boolean);

  return parts.join(". ");
}

/**
 * Get keywords for common category slugs
 */
function getCategoryKeywords(slug: string): string {
  const keywordMap: Record<string, string> = {
    software: "software subscription SaaS license cloud hosting tools development",
    "office-supplies": "office supplies equipment furniture stationery printer paper",
    travel: "travel transportation flight hotel accommodation taxi uber bolt",
    meals: "food restaurant cafe lunch dinner catering meals entertainment",
    marketing: "marketing advertising ads promotion campaign social media",
    utilities: "utilities electricity water gas internet phone telecom",
    rent: "rent lease office space premises location building",
    salaries: "salary wages payroll employee compensation bonus",
    taxes: "tax VAT PDV government payment fiscal",
    insurance: "insurance premium coverage policy protection",
    "professional-services": "consulting legal accounting advisory professional services",
    "bank-fees": "bank fees charges transfer wire commission payment processing",
    income: "income revenue payment received sales customer",
    "refunds-received": "refund return credit reimbursement",
    other: "miscellaneous other general uncategorized",
  };

  return keywordMap[slug] || "";
}

/**
 * Generate and store embedding for a single category
 */
export async function generateCategoryEmbedding(
  tenantId: string,
  categoryId: string
): Promise<CategoryEmbedding | null> {
  try {
    // Get category details
    const categories = await categoryQueries.getCategories(tenantId);
    const category = categories.find((c) => c.id === categoryId);

    if (!category) {
      logger.warn({ categoryId }, "Category not found for embedding generation");
      return null;
    }

    // Generate embedding text and embedding
    const embeddingText = getCategoryEmbeddingText(category);
    const embedding = await generateEmbedding(embeddingText);

    // Store in database
    await db`
      INSERT INTO category_embeddings (
        category_id, tenant_id, embedding, embedding_text, updated_at
      ) VALUES (
        ${categoryId}, ${tenantId}, ${JSON.stringify(embedding)}::jsonb, ${embeddingText}, NOW()
      )
      ON CONFLICT (category_id) DO UPDATE SET
        embedding = EXCLUDED.embedding,
        embedding_text = EXCLUDED.embedding_text,
        updated_at = NOW()
    `;

    logger.info({ categoryId, slug: category.slug }, "Category embedding generated");

    return {
      categoryId,
      categorySlug: category.slug,
      categoryName: category.name,
      embedding,
      tenantId,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error({ error, categoryId }, "Failed to generate category embedding");
    throw error;
  }
}

/**
 * Generate embeddings for all categories of a tenant
 */
export async function generateAllCategoryEmbeddings(
  tenantId: string
): Promise<{ generated: number; failed: number }> {
  const categories = await categoryQueries.getCategories(tenantId);
  let generated = 0;
  let failed = 0;

  logger.info({ tenantId, categoryCount: categories.length }, "Generating category embeddings");

  for (const category of categories) {
    try {
      await generateCategoryEmbedding(tenantId, category.id);
      generated++;
    } catch {
      failed++;
    }
  }

  logger.info({ tenantId, generated, failed }, "Category embedding generation complete");

  return { generated, failed };
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Find most similar categories for given text
 */
export async function findSimilarCategories(
  tenantId: string,
  text: string,
  limit: number = 5,
  minSimilarity: number = 0.3
): Promise<CategoryRecommendation[]> {
  // Generate embedding for input text
  const textEmbedding = await generateEmbedding(text);

  // Get all category embeddings for tenant
  const embeddings = await db`
    SELECT
      ce.category_id,
      ce.embedding,
      tc.slug,
      tc.name,
      tc.description
    FROM category_embeddings ce
    JOIN transaction_categories tc ON tc.id = ce.category_id
    WHERE ce.tenant_id = ${tenantId}
  `;

  // Calculate similarities
  const similarities: CategoryRecommendation[] = [];

  for (const row of embeddings) {
    const categoryEmbedding = row.embedding as number[];
    const similarity = cosineSimilarity(textEmbedding, categoryEmbedding);

    if (similarity >= minSimilarity) {
      similarities.push({
        categoryId: row.category_id as string,
        slug: row.slug as string,
        name: row.name as string,
        similarity: Math.round(similarity * 1000) / 1000,
        description: row.description as string | undefined,
      });
    }
  }

  // Sort by similarity and return top results
  return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
}

/**
 * Recommend category for a transaction based on description
 */
export async function recommendCategoryForTransaction(
  tenantId: string,
  transactionText: string
): Promise<CategoryRecommendation | null> {
  const recommendations = await findSimilarCategories(tenantId, transactionText, 1, 0.4);
  return recommendations.length > 0 ? recommendations[0] : null;
}

/**
 * Find similar categories to a given category
 */
export async function findRelatedCategories(
  tenantId: string,
  categoryId: string,
  limit: number = 5
): Promise<CategoryRecommendation[]> {
  // Get the category's embedding
  const result = await db`
    SELECT embedding FROM category_embeddings
    WHERE category_id = ${categoryId} AND tenant_id = ${tenantId}
  `;

  if (result.length === 0) {
    // Generate embedding if not exists
    await generateCategoryEmbedding(tenantId, categoryId);
    return findRelatedCategories(tenantId, categoryId, limit);
  }

  const sourceEmbedding = result[0].embedding as number[];

  // Get all other category embeddings
  const embeddings = await db`
    SELECT
      ce.category_id,
      ce.embedding,
      tc.slug,
      tc.name,
      tc.description
    FROM category_embeddings ce
    JOIN transaction_categories tc ON tc.id = ce.category_id
    WHERE ce.tenant_id = ${tenantId}
      AND ce.category_id != ${categoryId}
  `;

  // Calculate similarities
  const similarities: CategoryRecommendation[] = [];

  for (const row of embeddings) {
    const categoryEmbedding = row.embedding as number[];
    const similarity = cosineSimilarity(sourceEmbedding, categoryEmbedding);

    similarities.push({
      categoryId: row.category_id as string,
      slug: row.slug as string,
      name: row.name as string,
      similarity: Math.round(similarity * 1000) / 1000,
      description: row.description as string | undefined,
    });
  }

  return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
}

/**
 * Check if embeddings exist for a tenant
 */
export async function hasEmbeddings(tenantId: string): Promise<boolean> {
  const result = await db`
    SELECT COUNT(*) as count FROM category_embeddings
    WHERE tenant_id = ${tenantId}
  `;
  return parseInt(result[0].count as string, 10) > 0;
}

/**
 * Get embedding statistics for a tenant
 */
export async function getEmbeddingStats(tenantId: string): Promise<{
  totalCategories: number;
  categoriesWithEmbeddings: number;
  lastUpdated: string | null;
}> {
  const categories = await categoryQueries.getCategories(tenantId);

  const embeddingStats = await db`
    SELECT
      COUNT(*) as count,
      MAX(updated_at) as last_updated
    FROM category_embeddings
    WHERE tenant_id = ${tenantId}
  `;

  return {
    totalCategories: categories.length,
    categoriesWithEmbeddings: parseInt(embeddingStats[0].count as string, 10) || 0,
    lastUpdated: embeddingStats[0].last_updated as string | null,
  };
}

export default {
  generateEmbedding,
  generateCategoryEmbedding,
  generateAllCategoryEmbeddings,
  findSimilarCategories,
  recommendCategoryForTransaction,
  findRelatedCategories,
  hasEmbeddings,
  getEmbeddingStats,
};
