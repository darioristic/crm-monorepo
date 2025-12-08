/**
 * Migration: Add Related Documents Function
 *
 * Creates a PostgreSQL function to find similar documents based on title similarity
 * using the pg_trgm extension for trigram-based fuzzy matching.
 */

import { logger } from "../../lib/logger";
import { sql as db } from "../client";

export const name = "009_add_related_documents_function";

export async function up(): Promise<void> {
  logger.info(`⬆️  Running ${name}...`);

  // Create the function to match similar documents by title
  await db`
    CREATE OR REPLACE FUNCTION match_similar_documents_by_title(
      p_document_id UUID,
      p_company_id UUID,
      p_threshold FLOAT DEFAULT 0.3,
      p_limit INT DEFAULT 5
    )
    RETURNS TABLE (
      id UUID,
      name TEXT,
      title TEXT,
      summary TEXT,
      path_tokens TEXT[],
      metadata JSONB,
      processing_status document_processing_status,
      created_at TIMESTAMPTZ,
      similarity_score FLOAT
    ) AS $$
    BEGIN
      RETURN QUERY
      SELECT
        d.id,
        d.name,
        d.title,
        d.summary,
        d.path_tokens,
        d.metadata,
        d.processing_status,
        d.created_at,
        similarity(d.title, (SELECT doc.title FROM documents doc WHERE doc.id = p_document_id))::FLOAT as similarity_score
      FROM documents d
      WHERE d.company_id = p_company_id
        AND d.id != p_document_id
        AND d.processing_status = 'completed'
        AND d.title IS NOT NULL
        AND similarity(d.title, (SELECT doc.title FROM documents doc WHERE doc.id = p_document_id)) > p_threshold
      ORDER BY similarity_score DESC
      LIMIT p_limit;
    END;
    $$ LANGUAGE plpgsql;
  `;

  // Create a function to match similar documents by content/summary
  await db`
    CREATE OR REPLACE FUNCTION match_similar_documents_by_content(
      p_document_id UUID,
      p_company_id UUID,
      p_threshold FLOAT DEFAULT 0.2,
      p_limit INT DEFAULT 5
    )
    RETURNS TABLE (
      id UUID,
      name TEXT,
      title TEXT,
      summary TEXT,
      path_tokens TEXT[],
      metadata JSONB,
      processing_status document_processing_status,
      created_at TIMESTAMPTZ,
      similarity_score FLOAT
    ) AS $$
    DECLARE
      source_summary TEXT;
    BEGIN
      -- Get the source document's summary
      SELECT d.summary INTO source_summary
      FROM documents d
      WHERE d.id = p_document_id;

      -- If no summary, fall back to title matching
      IF source_summary IS NULL THEN
        RETURN QUERY
        SELECT * FROM match_similar_documents_by_title(p_document_id, p_company_id, p_threshold, p_limit);
        RETURN;
      END IF;

      RETURN QUERY
      SELECT
        d.id,
        d.name,
        d.title,
        d.summary,
        d.path_tokens,
        d.metadata,
        d.processing_status,
        d.created_at,
        similarity(d.summary, source_summary)::FLOAT as similarity_score
      FROM documents d
      WHERE d.company_id = p_company_id
        AND d.id != p_document_id
        AND d.processing_status = 'completed'
        AND d.summary IS NOT NULL
        AND similarity(d.summary, source_summary) > p_threshold
      ORDER BY similarity_score DESC
      LIMIT p_limit;
    END;
    $$ LANGUAGE plpgsql;
  `;

  // Create an index to improve trigram similarity performance
  await db`
    CREATE INDEX IF NOT EXISTS idx_documents_title_trgm_ops
    ON documents USING gin (title gin_trgm_ops)
    WHERE title IS NOT NULL
  `;

  await db`
    CREATE INDEX IF NOT EXISTS idx_documents_summary_trgm_ops
    ON documents USING gin (summary gin_trgm_ops)
    WHERE summary IS NOT NULL
  `;

  logger.info(`✅ ${name} completed`);
}

export async function down(): Promise<void> {
  logger.info(`⬇️  Rolling back ${name}...`);

  // Drop the functions
  await db`DROP FUNCTION IF EXISTS match_similar_documents_by_content(UUID, UUID, FLOAT, INT)`;
  await db`DROP FUNCTION IF EXISTS match_similar_documents_by_title(UUID, UUID, FLOAT, INT)`;

  // Drop the indexes (these might have been created in migration 008, but we'll try to drop them)
  await db`DROP INDEX IF EXISTS idx_documents_summary_trgm_ops`;
  await db`DROP INDEX IF EXISTS idx_documents_title_trgm_ops`;

  logger.info(`✅ ${name} rolled back`);
}
