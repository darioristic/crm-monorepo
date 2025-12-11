/**
 * Migration: Fix Magic Inbox Constraints
 * Adds missing unique constraint required for upsert operations
 */

import { logger } from "../../lib/logger";
import { sql as db } from "../client";

export const name = "027_fix_inbox_constraints";

export async function up(): Promise<void> {
  logger.info(`Running migration: ${name}`);

  // Add unique constraint on (inbox_id, transaction_id) for transaction_match_suggestions
  // This is required for the ON CONFLICT clause in createMatchSuggestion
  await db`
    DO $$ BEGIN
      ALTER TABLE transaction_match_suggestions
      ADD CONSTRAINT transaction_match_suggestions_inbox_transaction_unique
      UNIQUE (inbox_id, transaction_id);
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `;

  // Add index to improve inbox queries performance
  await db`CREATE INDEX IF NOT EXISTS idx_inbox_tenant_status ON inbox(tenant_id, status)`;

  logger.info(`Migration ${name} completed successfully`);
}

export async function down(): Promise<void> {
  logger.info(`Rolling back migration: ${name}`);

  await db`ALTER TABLE transaction_match_suggestions DROP CONSTRAINT IF EXISTS transaction_match_suggestions_inbox_transaction_unique`;
  await db`DROP INDEX IF EXISTS idx_inbox_tenant_status`;

  logger.info(`Rollback of ${name} completed successfully`);
}
