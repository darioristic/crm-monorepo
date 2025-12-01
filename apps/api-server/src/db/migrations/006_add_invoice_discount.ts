import { sql as db } from "../client";

export const name = "006_add_invoice_discount";

/**
 * Migration: Add discount and grossTotal columns to invoices table
 * 
 * This migration adds support for invoice-level discounts:
 * - gross_total: Sum of all line items (before discount)
 * - discount: Amount deducted from gross total
 * - subtotal: Now represents gross_total - discount
 * 
 * Calculation order:
 * 1. gross_total = sum of line items
 * 2. subtotal = gross_total - discount
 * 3. tax = subtotal * taxRate / 100
 * 4. total = subtotal + tax
 */
export async function up() {
  // Add gross_total column
  await db`
    ALTER TABLE invoices 
    ADD COLUMN IF NOT EXISTS gross_total TEXT NOT NULL DEFAULT '0'
  `;

  // Add discount column
  await db`
    ALTER TABLE invoices 
    ADD COLUMN IF NOT EXISTS discount TEXT NOT NULL DEFAULT '0'
  `;

  // Set gross_total = subtotal for existing invoices (since they had no discount)
  await db`
    UPDATE invoices 
    SET gross_total = subtotal 
    WHERE gross_total = '0'
  `;

  console.log("✅ Migration 006: Added invoice discount columns");
}

export async function down() {
  await db`ALTER TABLE invoices DROP COLUMN IF EXISTS gross_total`;
  await db`ALTER TABLE invoices DROP COLUMN IF EXISTS discount`;
  
  console.log("✅ Migration 006: Removed invoice discount columns");
}

