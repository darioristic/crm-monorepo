-- pgvector Extension and Embedding Tables
-- Requires pgvector/pgvector:pg16 Docker image

-- ==============================================
-- ENABLE PGVECTOR EXTENSION
-- ==============================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ==============================================
-- INBOX EMBEDDINGS TABLE (with vector type)
-- ==============================================

CREATE TABLE IF NOT EXISTS inbox_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  inbox_id UUID NOT NULL REFERENCES inbox(id) ON DELETE CASCADE,

  -- Vector embedding (768 dimensions for text-embedding-004)
  embedding vector(768) NOT NULL,

  -- Text that was embedded (for debugging/recomputing)
  source_text TEXT,

  -- Model info
  model VARCHAR(100) NOT NULL DEFAULT 'text-embedding-004',

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- One embedding per inbox item
  CONSTRAINT inbox_embeddings_unique UNIQUE (inbox_id)
);

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_inbox_embeddings_vector
  ON inbox_embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_inbox_embeddings_tenant ON inbox_embeddings(tenant_id);

-- ==============================================
-- TRANSACTION/PAYMENT EMBEDDINGS TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS transaction_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,

  -- Vector embedding (768 dimensions)
  embedding vector(768) NOT NULL,

  -- Text that was embedded
  source_text TEXT,

  -- Model info
  model VARCHAR(100) NOT NULL DEFAULT 'text-embedding-004',

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- One embedding per payment
  CONSTRAINT transaction_embeddings_unique UNIQUE (payment_id)
);

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_transaction_embeddings_vector
  ON transaction_embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_transaction_embeddings_tenant ON transaction_embeddings(tenant_id);

-- ==============================================
-- DOCUMENT EMBEDDINGS TABLE (for vault documents)
-- ==============================================

CREATE TABLE IF NOT EXISTS document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  -- Vector embedding (768 dimensions)
  embedding vector(768) NOT NULL,

  -- Extracted text from document (OCR result)
  source_text TEXT,

  -- OCR metadata
  ocr_completed BOOLEAN NOT NULL DEFAULT false,
  ocr_confidence DECIMAL(5, 2),
  ocr_provider VARCHAR(50), -- 'tesseract', 'google-document-ai', etc.

  -- Extracted structured data from document
  extracted_data JSONB,
  -- Example: { "vendor": "...", "amount": 100, "date": "...", "invoice_number": "..." }

  -- Model info
  model VARCHAR(100) NOT NULL DEFAULT 'text-embedding-004',

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- One embedding per document
  CONSTRAINT document_embeddings_unique UNIQUE (document_id)
);

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_document_embeddings_vector
  ON document_embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_document_embeddings_tenant ON document_embeddings(tenant_id);
CREATE INDEX idx_document_embeddings_ocr ON document_embeddings(ocr_completed);

-- ==============================================
-- HELPER FUNCTION: Cosine Similarity Search
-- ==============================================

-- Function to find similar inbox items by embedding
CREATE OR REPLACE FUNCTION find_similar_inbox(
  p_tenant_id UUID,
  p_embedding vector(768),
  p_limit INTEGER DEFAULT 10,
  p_min_similarity FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  inbox_id UUID,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ie.inbox_id,
    1 - (ie.embedding <=> p_embedding) AS similarity
  FROM inbox_embeddings ie
  WHERE ie.tenant_id = p_tenant_id
    AND 1 - (ie.embedding <=> p_embedding) >= p_min_similarity
  ORDER BY ie.embedding <=> p_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to find similar transactions by embedding
CREATE OR REPLACE FUNCTION find_similar_transactions(
  p_tenant_id UUID,
  p_embedding vector(768),
  p_limit INTEGER DEFAULT 10,
  p_min_similarity FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  payment_id UUID,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    te.payment_id,
    1 - (te.embedding <=> p_embedding) AS similarity
  FROM transaction_embeddings te
  WHERE te.tenant_id = p_tenant_id
    AND 1 - (te.embedding <=> p_embedding) >= p_min_similarity
  ORDER BY te.embedding <=> p_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to find similar documents by embedding
CREATE OR REPLACE FUNCTION find_similar_documents(
  p_tenant_id UUID,
  p_embedding vector(768),
  p_limit INTEGER DEFAULT 10,
  p_min_similarity FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  document_id UUID,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.document_id,
    1 - (de.embedding <=> p_embedding) AS similarity
  FROM document_embeddings de
  WHERE de.tenant_id = p_tenant_id
    AND 1 - (de.embedding <=> p_embedding) >= p_min_similarity
  ORDER BY de.embedding <=> p_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- COMMENTS
-- ==============================================

COMMENT ON TABLE inbox_embeddings IS 'Semantic vector embeddings for inbox items (pgvector)';
COMMENT ON TABLE transaction_embeddings IS 'Semantic vector embeddings for transactions/payments (pgvector)';
COMMENT ON TABLE document_embeddings IS 'Semantic vector embeddings for vault documents with OCR data (pgvector)';
COMMENT ON FUNCTION find_similar_inbox IS 'Find inbox items similar to a given embedding vector';
COMMENT ON FUNCTION find_similar_transactions IS 'Find transactions similar to a given embedding vector';
COMMENT ON FUNCTION find_similar_documents IS 'Find documents similar to a given embedding vector';
