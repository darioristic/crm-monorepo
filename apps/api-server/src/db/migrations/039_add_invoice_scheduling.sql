-- Migration: Add invoice scheduling and timestamp columns
-- This migration adds scheduling columns and ensures all timestamp columns exist
-- for proper invoice lifecycle tracking

-- Add timestamp columns for invoice lifecycle tracking
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Add scheduling columns
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS scheduled_job_id TEXT;

-- Add token column for public invoice access
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS token VARCHAR(100);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invoices_scheduled_at ON invoices(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_token ON invoices(token) WHERE token IS NOT NULL;

-- Update status constraint to include 'scheduled' status (if not already present)
-- Note: This assumes status is stored as text. If it's an enum, this needs to be adjusted.
