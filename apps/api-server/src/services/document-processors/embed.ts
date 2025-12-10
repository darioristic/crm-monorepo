/**
 * Document Embedding Service
 *
 * Generates embeddings for document content for semantic search
 */

import { openai } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";
import { logger } from "../../lib/logger";

const EMBEDDING_CONFIG = {
  model: openai.embedding("text-embedding-3-small"),
  modelName: "text-embedding-3-small",
  dimensions: 1536,
};

export class Embed {
  /**
   * Generate embeddings for multiple text values
   */
  public async embedMany(content: string[]): Promise<{
    embeddings: number[][];
    model: string;
  }> {
    try {
      const { embeddings } = await embedMany({
        model: EMBEDDING_CONFIG.model,
        values: content,
      });

      logger.info({ count: content.length }, "Generated embeddings for multiple documents");

      return {
        embeddings,
        model: EMBEDDING_CONFIG.modelName,
      };
    } catch (error) {
      logger.error({ error }, "Failed to generate embeddings");
      throw error;
    }
  }

  /**
   * Generate embedding for a single text value
   */
  public async embed(content: string): Promise<{
    embedding: number[];
    model: string;
  }> {
    try {
      const { embedding } = await embed({
        model: EMBEDDING_CONFIG.model,
        value: content,
      });

      logger.info({ contentLength: content.length }, "Generated embedding for document");

      return {
        embedding,
        model: EMBEDDING_CONFIG.modelName,
      };
    } catch (error) {
      logger.error({ error }, "Failed to generate embedding");
      throw error;
    }
  }

  /**
   * Generate embedding for a document with its metadata
   */
  public async embedDocument(params: {
    title?: string;
    summary?: string;
    content?: string;
    tags?: string[];
  }): Promise<{
    embedding: number[];
    model: string;
  }> {
    // Combine all text fields for embedding
    const parts: string[] = [];

    if (params.title) {
      parts.push(`Title: ${params.title}`);
    }
    if (params.summary) {
      parts.push(`Summary: ${params.summary}`);
    }
    if (params.tags && params.tags.length > 0) {
      parts.push(`Tags: ${params.tags.join(", ")}`);
    }
    if (params.content) {
      // Limit content length for embedding
      const maxContentLength = 8000;
      const truncatedContent =
        params.content.length > maxContentLength
          ? `${params.content.slice(0, maxContentLength)}...`
          : params.content;
      parts.push(`Content: ${truncatedContent}`);
    }

    const combinedText = parts.join("\n\n");

    return this.embed(combinedText);
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  public cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Embeddings must have the same length");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Find most similar documents from a list
   */
  public findMostSimilar(
    queryEmbedding: number[],
    documentEmbeddings: Array<{ id: string; embedding: number[] }>,
    topK: number = 5
  ): Array<{ id: string; similarity: number }> {
    const similarities = documentEmbeddings.map((doc) => ({
      id: doc.id,
      similarity: this.cosineSimilarity(queryEmbedding, doc.embedding),
    }));

    return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
  }
}

export const embedService = new Embed();
export default embedService;
