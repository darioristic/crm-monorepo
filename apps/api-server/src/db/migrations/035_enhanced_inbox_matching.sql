-- Enhanced Inbox Matching Migration
-- Adds tenant calibration, improved indexes for matching performance

-- ==============================================
-- TENANT MATCH CALIBRATION TABLE
-- Stores per-tenant threshold adjustments based on user feedback
-- ==============================================

CREATE TABLE IF NOT EXISTS tenant_match_calibration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Calibrated thresholds (adjusted from defaults based on feedback)
  calibrated_suggested_threshold DECIMAL(4,3) NOT NULL DEFAULT 0.600,
  calibrated_auto_threshold DECIMAL(4,3) NOT NULL DEFAULT 0.900,
  calibrated_high_confidence_threshold DECIMAL(4,3) NOT NULL DEFAULT 0.720,

  -- Performance metrics (cached for quick access)
  total_suggestions INTEGER NOT NULL DEFAULT 0,
  confirmed_suggestions INTEGER NOT NULL DEFAULT 0,
  declined_suggestions INTEGER NOT NULL DEFAULT 0,
  unmatched_suggestions INTEGER NOT NULL DEFAULT 0, -- Post-match negative feedback

  -- Accuracy metrics
  suggested_match_accuracy DECIMAL(4,3) DEFAULT 0,
  auto_match_accuracy DECIMAL(4,3) DEFAULT 0,

  -- Rolling averages for confidence scores
  avg_confidence_confirmed DECIMAL(4,3),
  avg_confidence_declined DECIMAL(4,3),
  avg_confidence_unmatched DECIMAL(4,3),

  -- Timestamps
  last_calibrated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- One calibration record per tenant
  CONSTRAINT tenant_match_calibration_unique UNIQUE (tenant_id)
);

-- Index for quick tenant lookup
CREATE INDEX IF NOT EXISTS idx_tenant_calibration_tenant
  ON tenant_match_calibration(tenant_id);

-- ==============================================
-- IMPROVED INDEXES FOR MATCH SUGGESTIONS
-- ==============================================

-- Index for dismissed match lookup (declined or unmatched)
-- Used by wasPreviouslyDismissed() function
CREATE INDEX IF NOT EXISTS idx_match_suggestions_dismissed
  ON transaction_match_suggestions(tenant_id, inbox_id, transaction_id)
  WHERE status IN ('declined', 'unmatched');

-- Index for calibration queries (90-day lookback window)
-- Used by getTeamCalibration() function
CREATE INDEX IF NOT EXISTS idx_match_suggestions_calibration
  ON transaction_match_suggestions(tenant_id, status, created_at)
  WHERE status IN ('confirmed', 'declined', 'unmatched');

-- Index for merchant pattern queries (semantic similarity history)
-- Used by findSimilarMerchantPatterns() function
CREATE INDEX IF NOT EXISTS idx_match_suggestions_merchant_patterns
  ON transaction_match_suggestions(tenant_id, status, confidence_score, created_at)
  WHERE status = 'confirmed';

-- ==============================================
-- HELPER FUNCTION: Get Tenant Calibration
-- Returns calibrated thresholds for a tenant
-- ==============================================

CREATE OR REPLACE FUNCTION get_tenant_calibration(p_tenant_id UUID)
RETURNS TABLE (
  suggested_threshold DECIMAL(4,3),
  auto_threshold DECIMAL(4,3),
  high_confidence_threshold DECIMAL(4,3),
  accuracy DECIMAL(4,3)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(tmc.calibrated_suggested_threshold, 0.600),
    COALESCE(tmc.calibrated_auto_threshold, 0.900),
    COALESCE(tmc.calibrated_high_confidence_threshold, 0.720),
    COALESCE(tmc.suggested_match_accuracy, 0)
  FROM tenant_match_calibration tmc
  WHERE tmc.tenant_id = p_tenant_id;

  -- Return defaults if no calibration exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0.600::DECIMAL(4,3), 0.900::DECIMAL(4,3), 0.720::DECIMAL(4,3), 0::DECIMAL(4,3);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- HELPER FUNCTION: Find Similar Merchant Patterns
-- Finds historical match patterns for similar merchants
-- ==============================================

CREATE OR REPLACE FUNCTION find_merchant_patterns(
  p_tenant_id UUID,
  p_inbox_embedding vector(768),
  p_transaction_embedding vector(768),
  p_similarity_threshold FLOAT DEFAULT 0.15,
  p_lookback_days INTEGER DEFAULT 180
)
RETURNS TABLE (
  suggestion_id UUID,
  status VARCHAR,
  confidence_score DECIMAL(4,3),
  inbox_similarity FLOAT,
  transaction_similarity FLOAT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    tms.id as suggestion_id,
    tms.status::VARCHAR,
    tms.confidence_score,
    1 - (ie.embedding <=> p_inbox_embedding) AS inbox_similarity,
    1 - (te.embedding <=> p_transaction_embedding) AS transaction_similarity,
    tms.created_at
  FROM transaction_match_suggestions tms
  INNER JOIN inbox_embeddings ie ON tms.inbox_id = ie.inbox_id
  INNER JOIN transaction_embeddings te ON tms.transaction_id = te.payment_id
  WHERE tms.tenant_id = p_tenant_id
    AND tms.status IN ('confirmed', 'declined', 'unmatched')
    AND tms.created_at > NOW() - (p_lookback_days || ' days')::INTERVAL
    AND (ie.embedding <=> p_inbox_embedding) < p_similarity_threshold
    AND (te.embedding <=> p_transaction_embedding) < p_similarity_threshold
  ORDER BY tms.created_at DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- TRIGGER: Auto-update updated_at for calibration
-- ==============================================

CREATE TRIGGER tr_tenant_calibration_updated
  BEFORE UPDATE ON tenant_match_calibration
  FOR EACH ROW EXECUTE FUNCTION update_inbox_updated_at();

-- ==============================================
-- COMMENTS
-- ==============================================

COMMENT ON TABLE tenant_match_calibration IS 'Per-tenant calibration data for inbox matching thresholds';
COMMENT ON COLUMN tenant_match_calibration.calibrated_suggested_threshold IS 'Adjusted threshold for creating match suggestions (default 0.6)';
COMMENT ON COLUMN tenant_match_calibration.calibrated_auto_threshold IS 'Adjusted threshold for auto-matching (default 0.9)';
COMMENT ON COLUMN tenant_match_calibration.unmatched_suggestions IS 'Count of confirmed matches that were later unmatched by user';
COMMENT ON FUNCTION get_tenant_calibration IS 'Returns calibrated thresholds for a tenant, with defaults if none exist';
COMMENT ON FUNCTION find_merchant_patterns IS 'Finds historical match patterns for similar merchants using embedding similarity';
