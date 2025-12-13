-- Category Embeddings Table
-- Vector representations for transaction categories

-- ==============================================
-- CATEGORY EMBEDDINGS TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS category_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES transaction_categories(id) ON DELETE CASCADE,

  -- Vector embedding (1536 dimensions for text-embedding-3-small)
  embedding JSONB NOT NULL,

  -- Text that was embedded (category name + description + keywords)
  embedding_text TEXT,

  -- Model info
  model VARCHAR(100) NOT NULL DEFAULT 'text-embedding-3-small',

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- One embedding per category
  CONSTRAINT category_embeddings_unique UNIQUE (category_id)
);

-- Indexes
CREATE INDEX idx_category_embeddings_tenant ON category_embeddings(tenant_id);
CREATE INDEX idx_category_embeddings_category ON category_embeddings(category_id);

-- ==============================================
-- COMMENTS
-- ==============================================

COMMENT ON TABLE category_embeddings IS 'Semantic vector embeddings for transaction categories enabling smart category recommendations';
COMMENT ON COLUMN category_embeddings.embedding IS 'JSON array of embedding vector values (1536 dimensions)';
COMMENT ON COLUMN category_embeddings.embedding_text IS 'Text used to generate the embedding (name + description + keywords)';
