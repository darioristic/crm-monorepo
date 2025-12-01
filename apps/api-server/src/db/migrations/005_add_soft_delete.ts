import { sql } from "../client";

/**
 * Migration: Add soft delete support for financial documents
 * 
 * This adds deleted_at columns to invoices, quotes, delivery_notes, and payments
 * to support soft deletion instead of permanent removal.
 */

export async function up(): Promise<void> {
  console.log("Running migration: 005_add_soft_delete");

  // Add deleted_at column to invoices
  await sql`
    ALTER TABLE invoices 
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL
  `;

  // Add deleted_at column to quotes
  await sql`
    ALTER TABLE quotes 
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL
  `;

  // Add deleted_at column to delivery_notes
  await sql`
    ALTER TABLE delivery_notes 
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL
  `;

  // Add deleted_at column to payments
  await sql`
    ALTER TABLE payments 
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL
  `;

  // Add deleted_by column to track who deleted the record
  await sql`
    ALTER TABLE invoices 
    ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) DEFAULT NULL
  `;

  await sql`
    ALTER TABLE quotes 
    ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) DEFAULT NULL
  `;

  await sql`
    ALTER TABLE delivery_notes 
    ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) DEFAULT NULL
  `;

  await sql`
    ALTER TABLE payments 
    ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) DEFAULT NULL
  `;

  // Create indexes for soft delete filtering
  await sql`
    CREATE INDEX IF NOT EXISTS idx_invoices_deleted_at ON invoices(deleted_at) 
    WHERE deleted_at IS NULL
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_quotes_deleted_at ON quotes(deleted_at) 
    WHERE deleted_at IS NULL
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_delivery_notes_deleted_at ON delivery_notes(deleted_at) 
    WHERE deleted_at IS NULL
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_payments_deleted_at ON payments(deleted_at) 
    WHERE deleted_at IS NULL
  `;

  console.log("✅ Migration 005_add_soft_delete completed");
}

export async function down(): Promise<void> {
  console.log("Rolling back migration: 005_add_soft_delete");

  // Remove indexes
  await sql`DROP INDEX IF EXISTS idx_invoices_deleted_at`;
  await sql`DROP INDEX IF EXISTS idx_quotes_deleted_at`;
  await sql`DROP INDEX IF EXISTS idx_delivery_notes_deleted_at`;
  await sql`DROP INDEX IF EXISTS idx_payments_deleted_at`;

  // Remove columns
  await sql`ALTER TABLE invoices DROP COLUMN IF EXISTS deleted_at`;
  await sql`ALTER TABLE invoices DROP COLUMN IF EXISTS deleted_by`;
  await sql`ALTER TABLE quotes DROP COLUMN IF EXISTS deleted_at`;
  await sql`ALTER TABLE quotes DROP COLUMN IF EXISTS deleted_by`;
  await sql`ALTER TABLE delivery_notes DROP COLUMN IF EXISTS deleted_at`;
  await sql`ALTER TABLE delivery_notes DROP COLUMN IF EXISTS deleted_by`;
  await sql`ALTER TABLE payments DROP COLUMN IF EXISTS deleted_at`;
  await sql`ALTER TABLE payments DROP COLUMN IF EXISTS deleted_by`;

  console.log("✅ Rollback 005_add_soft_delete completed");
}

// Run migration if this file is executed directly
if (import.meta.main) {
  const command = process.argv[2];
  if (command === "down") {
    await down();
  } else {
    await up();
  }
  process.exit(0);
}

