import { sql as db } from "../client";

export const name = "011_add_invoice_token_and_timestamps";

/**
 * Migration: Add token and timestamp fields to invoices table
 * 
 * This migration adds support for:
 * - token: Unique public access token for invoice sharing
 * - viewed_at: Timestamp when invoice was first viewed
 * - sent_at: Timestamp when invoice was sent
 * - paid_at: Timestamp when invoice was paid
 */
export async function up() {
  // Add token column to invoices
  await db`
    ALTER TABLE invoices 
    ADD COLUMN IF NOT EXISTS token VARCHAR(100) UNIQUE
  `;

  // Add viewed_at timestamp column
  await db`
    ALTER TABLE invoices 
    ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ
  `;

  // Add sent_at timestamp column
  await db`
    ALTER TABLE invoices 
    ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ
  `;

  // Add paid_at timestamp column
  await db`
    ALTER TABLE invoices 
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ
  `;

  // Create index on token for faster lookups
  await db`
    CREATE INDEX IF NOT EXISTS idx_invoices_token ON invoices(token)
  `;

  // Generate tokens for existing invoices that don't have one
  await db`
    UPDATE invoices 
    SET token = 'inv_' || EXTRACT(EPOCH FROM created_at)::BIGINT || '_' || SUBSTRING(id::TEXT, 1, 8)
    WHERE token IS NULL
  `;

  console.log("✅ Migration 011: Added invoice token and timestamp fields");
}

export async function down() {
  await db`DROP INDEX IF EXISTS idx_invoices_token`;
  await db`ALTER TABLE invoices DROP COLUMN IF EXISTS token`;
  await db`ALTER TABLE invoices DROP COLUMN IF EXISTS viewed_at`;
  await db`ALTER TABLE invoices DROP COLUMN IF EXISTS sent_at`;
  await db`ALTER TABLE invoices DROP COLUMN IF EXISTS paid_at`;
  
  console.log("✅ Migration 011: Removed invoice token and timestamp fields");
}

