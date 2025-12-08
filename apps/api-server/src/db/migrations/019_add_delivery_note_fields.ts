import { logger } from "../../lib/logger";
import { sql as db } from "../client";

export const name = "019_add_delivery_note_fields";

/**
 * Migration: Add invoice-like fields to delivery_notes and delivery_note_items tables
 *
 * This migration adds support for:
 * - customerDetails: Customer/Bill to details stored as JSON
 * - terms: Terms and conditions text
 * - taxRate: Tax rate for delivery note
 * - subtotal: Subtotal amount
 * - tax: Tax amount
 * - total: Total amount
 * - unitPrice: Unit price for delivery note items
 * - discount: Discount percentage for delivery note items
 */
export async function up() {
  // Add customerDetails column to delivery_notes (JSON as TEXT)
  await db`
    ALTER TABLE delivery_notes 
    ADD COLUMN IF NOT EXISTS customer_details TEXT
  `;

  // Add terms column to delivery_notes
  await db`
    ALTER TABLE delivery_notes 
    ADD COLUMN IF NOT EXISTS terms TEXT
  `;

  // Add taxRate column to delivery_notes
  await db`
    ALTER TABLE delivery_notes 
    ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 0
  `;

  // Add subtotal column to delivery_notes
  await db`
    ALTER TABLE delivery_notes 
    ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0
  `;

  // Add tax column to delivery_notes
  await db`
    ALTER TABLE delivery_notes 
    ADD COLUMN IF NOT EXISTS tax DECIMAL(10, 2) NOT NULL DEFAULT 0
  `;

  // Add total column to delivery_notes
  await db`
    ALTER TABLE delivery_notes 
    ADD COLUMN IF NOT EXISTS total DECIMAL(10, 2) NOT NULL DEFAULT 0
  `;

  // Add unitPrice column to delivery_note_items
  await db`
    ALTER TABLE delivery_note_items 
    ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0
  `;

  // Add discount column to delivery_note_items
  await db`
    ALTER TABLE delivery_note_items 
    ADD COLUMN IF NOT EXISTS discount DECIMAL(5, 2) NOT NULL DEFAULT 0
  `;

  logger.info("✅ Migration 019: Added delivery note fields");
}

export async function down() {
  // Remove from delivery_notes
  await db`ALTER TABLE delivery_notes DROP COLUMN IF EXISTS customer_details`;
  await db`ALTER TABLE delivery_notes DROP COLUMN IF EXISTS terms`;
  await db`ALTER TABLE delivery_notes DROP COLUMN IF EXISTS tax_rate`;
  await db`ALTER TABLE delivery_notes DROP COLUMN IF EXISTS subtotal`;
  await db`ALTER TABLE delivery_notes DROP COLUMN IF EXISTS tax`;
  await db`ALTER TABLE delivery_notes DROP COLUMN IF EXISTS total`;

  // Remove from delivery_note_items
  await db`ALTER TABLE delivery_note_items DROP COLUMN IF EXISTS unit_price`;
  await db`ALTER TABLE delivery_note_items DROP COLUMN IF EXISTS discount`;

  logger.info("✅ Migration 019: Removed delivery note fields");
}
