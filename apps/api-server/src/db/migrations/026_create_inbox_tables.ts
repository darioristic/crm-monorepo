/**
 * Migration: Create Magic Inbox Tables
 * Creates all tables needed for the inbox feature
 */

import { logger } from "../../lib/logger";
import { sql as db } from "../client";

export const name = "026_create_inbox_tables";

export async function up(): Promise<void> {
  logger.info(`Running migration: ${name}`);

  // Enable vector extension if not already enabled (for embeddings)
  await db`CREATE EXTENSION IF NOT EXISTS "vector"`.catch(() => {
    logger.warn("Vector extension may already exist or not be available");
  });

  // Create inbox status enum
  await db`
    DO $$ BEGIN
      CREATE TYPE inbox_status AS ENUM (
        'new',
        'processing',
        'analyzing',
        'pending',
        'suggested_match',
        'no_match',
        'done',
        'archived',
        'deleted'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `;

  // Create inbox type enum
  await db`
    DO $$ BEGIN
      CREATE TYPE inbox_type AS ENUM (
        'invoice',
        'expense',
        'receipt',
        'other'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `;

  // Create inbox blocklist type enum
  await db`
    DO $$ BEGIN
      CREATE TYPE inbox_blocklist_type AS ENUM (
        'email',
        'domain'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `;

  // Create inbox_accounts table
  await db`
    CREATE TABLE IF NOT EXISTS inbox_accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      provider TEXT NOT NULL,
      external_id TEXT NOT NULL UNIQUE,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expiry_date TIMESTAMPTZ NOT NULL,
      status TEXT DEFAULT 'connected',
      last_accessed TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      schedule_id TEXT,
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await db`CREATE INDEX IF NOT EXISTS idx_inbox_accounts_tenant ON inbox_accounts(tenant_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_inbox_accounts_email ON inbox_accounts(email)`;
  await db`CREATE INDEX IF NOT EXISTS idx_inbox_accounts_external ON inbox_accounts(external_id)`;

  // Create main inbox table
  await db`
    CREATE TABLE IF NOT EXISTS inbox (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      inbox_account_id UUID REFERENCES inbox_accounts(id) ON DELETE SET NULL,
      reference_id TEXT,
      sender_email TEXT,
      forwarded_to TEXT,
      file_name TEXT,
      file_path TEXT[],
      content_type TEXT,
      size INTEGER,
      display_name TEXT,
      description TEXT,
      amount DECIMAL(15, 2),
      base_amount DECIMAL(15, 2),
      currency TEXT DEFAULT 'EUR',
      base_currency TEXT DEFAULT 'EUR',
      date TIMESTAMPTZ,
      tax_amount DECIMAL(15, 2),
      tax_rate DECIMAL(5, 2),
      tax_type TEXT,
      type inbox_type,
      status inbox_status DEFAULT 'new',
      website TEXT,
      transaction_id UUID,
      attachment_id UUID,
      meta JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await db`CREATE INDEX IF NOT EXISTS idx_inbox_tenant ON inbox(tenant_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_inbox_status ON inbox(status)`;
  await db`CREATE INDEX IF NOT EXISTS idx_inbox_account ON inbox(inbox_account_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_inbox_transaction ON inbox(transaction_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_inbox_created ON inbox(created_at DESC)`;
  await db`CREATE INDEX IF NOT EXISTS idx_inbox_display_name ON inbox(display_name)`;

  // Create inbox_blocklist table
  await db`
    CREATE TABLE IF NOT EXISTS inbox_blocklist (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      type inbox_blocklist_type NOT NULL,
      value TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(tenant_id, type, value)
    )
  `;

  await db`CREATE INDEX IF NOT EXISTS idx_inbox_blocklist_tenant ON inbox_blocklist(tenant_id)`;

  // Create inbox_embeddings table (for AI matching)
  // Use vector(1536) for OpenAI embeddings
  await db`
    CREATE TABLE IF NOT EXISTS inbox_embeddings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      inbox_id UUID NOT NULL REFERENCES inbox(id) ON DELETE CASCADE,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      embedding vector(1536),
      source_text TEXT,
      model TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.catch(() => {
    // If vector extension is not available, create without embedding column
    logger.warn("Vector extension not available, creating table without embedding column");
    return db`
      CREATE TABLE IF NOT EXISTS inbox_embeddings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        inbox_id UUID NOT NULL REFERENCES inbox(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        embedding TEXT,
        source_text TEXT,
        model TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
  });

  await db`CREATE INDEX IF NOT EXISTS idx_inbox_embeddings_inbox ON inbox_embeddings(inbox_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_inbox_embeddings_tenant ON inbox_embeddings(tenant_id)`;

  // Create transaction_match_suggestions table
  await db`
    CREATE TABLE IF NOT EXISTS transaction_match_suggestions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      inbox_id UUID NOT NULL REFERENCES inbox(id) ON DELETE CASCADE,
      transaction_id UUID NOT NULL,
      confidence_score DECIMAL(5, 4) NOT NULL,
      amount_score DECIMAL(5, 4),
      currency_score DECIMAL(5, 4),
      date_score DECIMAL(5, 4),
      embedding_score DECIMAL(5, 4),
      name_score DECIMAL(5, 4),
      match_type TEXT NOT NULL,
      match_details JSONB,
      status TEXT DEFAULT 'pending',
      user_action_at TIMESTAMPTZ,
      user_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await db`CREATE INDEX IF NOT EXISTS idx_match_suggestions_inbox ON transaction_match_suggestions(inbox_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_match_suggestions_transaction ON transaction_match_suggestions(transaction_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_match_suggestions_tenant ON transaction_match_suggestions(tenant_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_match_suggestions_status ON transaction_match_suggestions(status)`;

  // Create updated_at trigger function
  await db`
    CREATE OR REPLACE FUNCTION update_inbox_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `;

  // Create triggers for updated_at
  await db`
    DROP TRIGGER IF EXISTS trigger_inbox_updated_at ON inbox
  `;
  await db`
    CREATE TRIGGER trigger_inbox_updated_at
    BEFORE UPDATE ON inbox
    FOR EACH ROW
    EXECUTE FUNCTION update_inbox_updated_at()
  `;

  await db`
    DROP TRIGGER IF EXISTS trigger_inbox_accounts_updated_at ON inbox_accounts
  `;
  await db`
    CREATE TRIGGER trigger_inbox_accounts_updated_at
    BEFORE UPDATE ON inbox_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_inbox_updated_at()
  `;

  logger.info(`Migration ${name} completed successfully`);
}

export async function down(): Promise<void> {
  logger.info(`Rolling back migration: ${name}`);

  // Drop triggers
  await db`DROP TRIGGER IF EXISTS trigger_inbox_updated_at ON inbox`;
  await db`DROP TRIGGER IF EXISTS trigger_inbox_accounts_updated_at ON inbox_accounts`;

  // Drop function
  await db`DROP FUNCTION IF EXISTS update_inbox_updated_at()`;

  // Drop tables in reverse order (respecting foreign keys)
  await db`DROP TABLE IF EXISTS transaction_match_suggestions`;
  await db`DROP TABLE IF EXISTS inbox_embeddings`;
  await db`DROP TABLE IF EXISTS inbox_blocklist`;
  await db`DROP TABLE IF EXISTS inbox`;
  await db`DROP TABLE IF EXISTS inbox_accounts`;

  // Drop enums
  await db`DROP TYPE IF EXISTS inbox_blocklist_type`;
  await db`DROP TYPE IF EXISTS inbox_type`;
  await db`DROP TYPE IF EXISTS inbox_status`;

  logger.info(`Rollback of ${name} completed successfully`);
}
