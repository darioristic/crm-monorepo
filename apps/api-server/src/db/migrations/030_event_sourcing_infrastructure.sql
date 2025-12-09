-- Event Sourcing Infrastructure
-- This adds event store and projections to existing system

-- Event Store: Immutable log of all domain events
CREATE TABLE IF NOT EXISTS event_store (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_id UUID NOT NULL,
  aggregate_type VARCHAR(100) NOT NULL, -- 'Offer', 'SalesOrder', 'DeliveryNote', 'Invoice', 'Payment'
  event_type VARCHAR(100) NOT NULL,
  event_version INT NOT NULL DEFAULT 1,
  event_data JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  sequence_number BIGSERIAL NOT NULL,

  -- Ensure events are ordered per aggregate
  CONSTRAINT unique_aggregate_version UNIQUE (aggregate_id, event_version)
);

-- Indexes for efficient querying
CREATE INDEX idx_event_store_aggregate ON event_store(aggregate_id, event_version);
CREATE INDEX idx_event_store_type ON event_store(aggregate_type, occurred_at DESC);
CREATE INDEX idx_event_store_tenant ON event_store(tenant_id, occurred_at DESC);
CREATE INDEX idx_event_store_sequence ON event_store(sequence_number);

-- Event Subscriptions: Track which projections have processed which events
CREATE TABLE IF NOT EXISTS event_subscriptions (
  subscription_id VARCHAR(100) PRIMARY KEY,
  last_processed_sequence BIGINT NOT NULL DEFAULT 0,
  last_processed_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'paused', 'error'
  error_message TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Payments Table (NEW)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number VARCHAR(50) NOT NULL UNIQUE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Payment details
  amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  payment_date DATE NOT NULL,
  payment_method VARCHAR(50) NOT NULL, -- 'bank_transfer', 'card', 'cash', 'check'

  -- Bank details (for bank transfers)
  transaction_reference VARCHAR(100),
  bank_account VARCHAR(100),

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'registered', -- 'registered', 'confirmed', 'cancelled'

  -- Notes
  notes TEXT,

  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_tenant ON payments(tenant_id);
CREATE INDEX idx_payments_date ON payments(payment_date DESC);
CREATE INDEX idx_payments_status ON payments(status);

-- Delivery Proof / Attachments (NEW)
CREATE TABLE IF NOT EXISTS delivery_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_note_id UUID NOT NULL REFERENCES delivery_notes(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- File details
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL,
  file_type VARCHAR(100) NOT NULL, -- 'application/pdf', 'image/jpeg', etc.

  -- Proof details
  proof_type VARCHAR(50) NOT NULL DEFAULT 'signature', -- 'signature', 'photo', 'document'
  received_by VARCHAR(200), -- Name of person who received delivery
  received_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,

  -- Metadata
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_file_size CHECK (file_size > 0 AND file_size < 52428800) -- Max 50MB
);

CREATE INDEX idx_delivery_proofs_delivery_note ON delivery_proofs(delivery_note_id);
CREATE INDEX idx_delivery_proofs_tenant ON delivery_proofs(tenant_id);

-- Offers Table (NEW - similar to quotes but for formal offers)
-- Note: You already have 'quotes' table, this is for formal offers in the workflow
CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_number VARCHAR(50) NOT NULL UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

  -- Offer details
  title VARCHAR(255) NOT NULL,
  description TEXT,
  valid_until DATE NOT NULL,

  -- Financial
  subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
  tax DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total DECIMAL(15, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',

  -- Status workflow
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- 'draft', 'sent', 'accepted', 'rejected', 'expired'

  -- Timestamps
  sent_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,

  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_offers_tenant ON offers(tenant_id);
CREATE INDEX idx_offers_company ON offers(company_id);
CREATE INDEX idx_offers_status ON offers(status);
CREATE INDEX idx_offers_valid_until ON offers(valid_until);

CREATE TABLE IF NOT EXISTS offer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,

  product_name VARCHAR(255) NOT NULL,
  description TEXT,
  quantity DECIMAL(10, 2) NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
  unit_price DECIMAL(15, 2) NOT NULL,
  discount DECIMAL(5, 2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
  total DECIMAL(15, 2) NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_offer_items_offer ON offer_items(offer_id);

-- Document Relationships (Track parent-child relationships)
CREATE TABLE IF NOT EXISTS document_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_type VARCHAR(50) NOT NULL, -- 'offer', 'quote', 'order', 'delivery_note', 'invoice'
  parent_id UUID NOT NULL,
  child_type VARCHAR(50) NOT NULL,
  child_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) NOT NULL, -- 'derived_from', 'converted_to', 'fulfills', 'invoices'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_parent_child UNIQUE (parent_id, child_id)
);

CREATE INDEX idx_doc_rel_parent ON document_relationships(parent_type, parent_id);
CREATE INDEX idx_doc_rel_child ON document_relationships(child_type, child_id);
CREATE INDEX idx_doc_rel_tenant ON document_relationships(tenant_id);

-- Audit Trail View (Read-optimized projection)
CREATE MATERIALIZED VIEW document_timeline AS
SELECT
  es.aggregate_id,
  es.aggregate_type,
  es.event_type,
  es.event_data,
  es.occurred_at,
  es.tenant_id,
  u.email as user_email,
  u.name as user_name,
  es.sequence_number
FROM event_store es
LEFT JOIN users u ON es.user_id = u.id
ORDER BY es.sequence_number DESC;

CREATE INDEX idx_timeline_aggregate ON document_timeline(aggregate_id);
CREATE INDEX idx_timeline_tenant ON document_timeline(tenant_id);

-- Function to refresh timeline view
CREATE OR REPLACE FUNCTION refresh_document_timeline()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY document_timeline;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to refresh timeline on new events
CREATE TRIGGER refresh_timeline_on_event
AFTER INSERT ON event_store
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_document_timeline();

-- Comments
COMMENT ON TABLE event_store IS 'Immutable event log for all domain events (Event Sourcing)';
COMMENT ON TABLE payments IS 'Payment records linked to invoices';
COMMENT ON TABLE delivery_proofs IS 'Proof of delivery files (signatures, photos, documents)';
COMMENT ON TABLE offers IS 'Formal business offers that can be converted to orders';
COMMENT ON TABLE document_relationships IS 'Parent-child relationships between business documents';
COMMENT ON MATERIALIZED VIEW document_timeline IS 'Read-optimized view of event history for timeline UI';
