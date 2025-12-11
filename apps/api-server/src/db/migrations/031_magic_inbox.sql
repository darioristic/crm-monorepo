-- Magic Inbox - Automated Transaction Matching
-- Based on Midday's Magic Inbox feature
-- Enables automatic matching of documents (invoices, receipts) with transactions

-- Enable pgvector extension for embeddings (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- ==============================================
-- ENUM TYPES
-- ==============================================

-- Email provider types (Gmail, Outlook, etc.)
CREATE TYPE inbox_account_provider AS ENUM ('gmail', 'outlook', 'imap');

-- Connection status for email accounts
CREATE TYPE inbox_account_status AS ENUM ('connected', 'disconnected', 'error');

-- Processing status for inbox items
CREATE TYPE inbox_status AS ENUM (
  'new',           -- Just received
  'processing',    -- Being processed (OCR, AI analysis)
  'analyzing',     -- AI is analyzing content
  'pending',       -- Awaiting user action
  'suggested_match', -- AI suggested a match
  'no_match',      -- No matching transaction found
  'done',          -- Successfully matched/processed
  'archived',      -- Archived by user
  'deleted'        -- Soft deleted
);

-- Type of inbox item
CREATE TYPE inbox_type AS ENUM ('invoice', 'expense', 'receipt', 'other');

-- Blocklist type (email address or domain)
CREATE TYPE inbox_blocklist_type AS ENUM ('email', 'domain');

-- ==============================================
-- INBOX ACCOUNTS TABLE
-- Stores connected email accounts for auto-sync
-- ==============================================

CREATE TABLE IF NOT EXISTS inbox_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Email account details
  email VARCHAR(255) NOT NULL,
  provider inbox_account_provider NOT NULL DEFAULT 'gmail',
  external_id VARCHAR(255) NOT NULL, -- Provider's account ID

  -- OAuth tokens (encrypted in production)
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expiry_date TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Sync status
  status inbox_account_status NOT NULL DEFAULT 'connected',
  last_accessed TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  schedule_id VARCHAR(255), -- For scheduled sync jobs
  error_message TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT inbox_accounts_email_unique UNIQUE (email),
  CONSTRAINT inbox_accounts_external_id_unique UNIQUE (external_id)
);

CREATE INDEX idx_inbox_accounts_tenant ON inbox_accounts(tenant_id);
CREATE INDEX idx_inbox_accounts_status ON inbox_accounts(status);

-- ==============================================
-- INBOX TABLE
-- Main table for document/receipt/invoice items
-- ==============================================

CREATE TABLE IF NOT EXISTS inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Source information
  inbox_account_id UUID REFERENCES inbox_accounts(id) ON DELETE SET NULL,
  reference_id VARCHAR(255), -- Unique ID from email/upload (message ID, upload ID)
  sender_email VARCHAR(255),
  forwarded_to VARCHAR(255), -- If forwarded to inbox email

  -- File information
  file_name VARCHAR(500),
  file_path TEXT[], -- Array of file paths (for multi-page documents)
  content_type VARCHAR(100),
  size BIGINT,

  -- Extracted information (from OCR/AI)
  display_name VARCHAR(500), -- Merchant/sender name
  description TEXT,
  amount DECIMAL(15, 4), -- Extracted amount
  base_amount DECIMAL(15, 4), -- Converted to base currency
  currency VARCHAR(3),
  base_currency VARCHAR(3),
  date DATE, -- Document date

  -- Tax information
  tax_amount DECIMAL(15, 4),
  tax_rate DECIMAL(5, 2),
  tax_type VARCHAR(50),

  -- Document classification
  type inbox_type,
  status inbox_status NOT NULL DEFAULT 'new',
  website VARCHAR(500), -- Extracted website

  -- Matching
  transaction_id UUID, -- Linked transaction (if matched)
  attachment_id UUID, -- Link to transaction_attachments if matched

  -- Metadata
  meta JSONB DEFAULT '{}', -- Products, line items, additional data

  -- Full-text search vector
  fts_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', COALESCE(display_name, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(description, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(sender_email, '')), 'C')
  ) STORED,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT inbox_reference_id_unique UNIQUE (reference_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_inbox_tenant ON inbox(tenant_id);
CREATE INDEX idx_inbox_status ON inbox(status);
CREATE INDEX idx_inbox_created_at ON inbox(created_at DESC);
CREATE INDEX idx_inbox_transaction_id ON inbox(transaction_id);
CREATE INDEX idx_inbox_attachment_id ON inbox(attachment_id);
CREATE INDEX idx_inbox_account ON inbox(inbox_account_id);
CREATE INDEX idx_inbox_fts ON inbox USING gin(fts_vector);

-- ==============================================
-- INBOX BLOCKLIST TABLE
-- Block emails/domains from being processed
-- ==============================================

CREATE TABLE IF NOT EXISTS inbox_blocklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  type inbox_blocklist_type NOT NULL,
  value VARCHAR(255) NOT NULL, -- Email address or domain

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Unique constraint per tenant
  CONSTRAINT inbox_blocklist_unique UNIQUE (tenant_id, type, value)
);

CREATE INDEX idx_inbox_blocklist_tenant ON inbox_blocklist(tenant_id);

-- ==============================================
-- INBOX EMBEDDINGS TABLE
-- Stores AI embeddings for semantic matching
-- ==============================================

CREATE TABLE IF NOT EXISTS inbox_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbox_id UUID NOT NULL REFERENCES inbox(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Embedding vector (768 dimensions for Gemini/OpenAI models)
  embedding vector(768),

  -- Text used to generate embedding
  source_text TEXT NOT NULL,

  -- Model used for embedding
  model VARCHAR(100) NOT NULL DEFAULT 'gemini-embedding-001',

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- One embedding per inbox item
  CONSTRAINT inbox_embeddings_unique UNIQUE (inbox_id)
);

CREATE INDEX idx_inbox_embeddings_inbox ON inbox_embeddings(inbox_id);
CREATE INDEX idx_inbox_embeddings_tenant ON inbox_embeddings(tenant_id);

-- HNSW index for fast cosine similarity search
CREATE INDEX idx_inbox_embeddings_vector ON inbox_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ==============================================
-- TRANSACTION EMBEDDINGS TABLE
-- Stores AI embeddings for transactions
-- ==============================================

CREATE TABLE IF NOT EXISTS transaction_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL, -- Reference to payment/transaction
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Embedding vector
  embedding vector(768),

  -- Text used to generate embedding
  source_text TEXT NOT NULL,

  -- Model used
  model VARCHAR(100) NOT NULL DEFAULT 'gemini-embedding-001',

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- One embedding per transaction
  CONSTRAINT transaction_embeddings_unique UNIQUE (transaction_id)
);

CREATE INDEX idx_transaction_embeddings_transaction ON transaction_embeddings(transaction_id);
CREATE INDEX idx_transaction_embeddings_tenant ON transaction_embeddings(tenant_id);

-- HNSW index for fast cosine similarity search
CREATE INDEX idx_transaction_embeddings_vector ON transaction_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ==============================================
-- TRANSACTION MATCH SUGGESTIONS TABLE
-- Stores AI-generated match suggestions
-- ==============================================

CREATE TABLE IF NOT EXISTS transaction_match_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  inbox_id UUID NOT NULL REFERENCES inbox(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL, -- Reference to payment/transaction

  -- Confidence scores (0.000 to 1.000)
  confidence_score DECIMAL(4,3) NOT NULL,
  amount_score DECIMAL(4,3),
  currency_score DECIMAL(4,3),
  date_score DECIMAL(4,3),
  embedding_score DECIMAL(4,3),
  name_score DECIMAL(4,3),

  -- Match classification
  match_type VARCHAR(50) NOT NULL, -- 'auto_matched', 'high_confidence', 'suggested'
  match_details JSONB, -- Additional match context

  -- User interaction
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'declined', 'expired', 'unmatched'
  user_action_at TIMESTAMP WITH TIME ZONE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- One suggestion per inbox-transaction pair
  CONSTRAINT transaction_match_suggestions_unique UNIQUE (inbox_id, transaction_id)
);

CREATE INDEX idx_match_suggestions_inbox ON transaction_match_suggestions(inbox_id);
CREATE INDEX idx_match_suggestions_transaction ON transaction_match_suggestions(transaction_id);
CREATE INDEX idx_match_suggestions_tenant ON transaction_match_suggestions(tenant_id);
CREATE INDEX idx_match_suggestions_status ON transaction_match_suggestions(status);
CREATE INDEX idx_match_suggestions_confidence ON transaction_match_suggestions(confidence_score DESC);
CREATE INDEX idx_match_suggestions_lookup ON transaction_match_suggestions(transaction_id, tenant_id, status);

-- ==============================================
-- HELPER FUNCTIONS
-- ==============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_inbox_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER tr_inbox_accounts_updated
  BEFORE UPDATE ON inbox_accounts
  FOR EACH ROW EXECUTE FUNCTION update_inbox_updated_at();

CREATE TRIGGER tr_inbox_updated
  BEFORE UPDATE ON inbox
  FOR EACH ROW EXECUTE FUNCTION update_inbox_updated_at();

CREATE TRIGGER tr_match_suggestions_updated
  BEFORE UPDATE ON transaction_match_suggestions
  FOR EACH ROW EXECUTE FUNCTION update_inbox_updated_at();

-- ==============================================
-- COMMENTS
-- ==============================================

COMMENT ON TABLE inbox_accounts IS 'Connected email accounts for automatic document sync';
COMMENT ON TABLE inbox IS 'Main inbox for documents, receipts, and invoices';
COMMENT ON TABLE inbox_blocklist IS 'Blocked emails/domains to skip during sync';
COMMENT ON TABLE inbox_embeddings IS 'AI-generated embeddings for inbox items (semantic search)';
COMMENT ON TABLE transaction_embeddings IS 'AI-generated embeddings for transactions (semantic search)';
COMMENT ON TABLE transaction_match_suggestions IS 'AI-generated match suggestions between inbox items and transactions';

COMMENT ON COLUMN inbox.fts_vector IS 'Full-text search vector for fast text search';
COMMENT ON COLUMN inbox_embeddings.embedding IS '768-dimensional vector for semantic similarity search';
COMMENT ON COLUMN transaction_match_suggestions.confidence_score IS 'Overall confidence: 50% embedding + 35% amount + 10% currency + 5% date';
