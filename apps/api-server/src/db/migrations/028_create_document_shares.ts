/**
 * Migration: Create Document Shares Table
 *
 * Creates table for managing public share links for documents
 */

import { logger } from "../../lib/logger";
import { sql as db } from "../client";

export const name = "028_create_document_shares";

export async function up(): Promise<void> {
  logger.info(`⬆️  Running ${name}...`);

  // Create document_shares table
  await db`
    CREATE TABLE IF NOT EXISTS document_shares (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      token VARCHAR(100) NOT NULL UNIQUE,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      expires_at TIMESTAMPTZ,
      password_hash VARCHAR(255),
      view_count INT DEFAULT 0,
      max_views INT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Create indexes
  await db`CREATE INDEX IF NOT EXISTS idx_document_shares_token ON document_shares(token)`;
  await db`CREATE INDEX IF NOT EXISTS idx_document_shares_document_id ON document_shares(document_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_document_shares_company_id ON document_shares(company_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_document_shares_is_active ON document_shares(is_active)`;

  logger.info(`✅ ${name} completed`);
}

export async function down(): Promise<void> {
  logger.info(`⬇️  Rolling back ${name}...`);

  // Drop indexes
  await db`DROP INDEX IF EXISTS idx_document_shares_is_active`;
  await db`DROP INDEX IF EXISTS idx_document_shares_company_id`;
  await db`DROP INDEX IF EXISTS idx_document_shares_document_id`;
  await db`DROP INDEX IF EXISTS idx_document_shares_token`;

  // Drop table
  await db`DROP TABLE IF EXISTS document_shares CASCADE`;

  logger.info(`✅ ${name} rolled back`);
}
