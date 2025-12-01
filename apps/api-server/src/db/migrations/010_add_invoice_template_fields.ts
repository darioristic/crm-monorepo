import { sql as db } from "../client";

export const name = "010_add_invoice_template_fields";

/**
 * Migration: Add template-related fields to invoices and invoice_items tables
 * 
 * This migration adds support for:
 * - fromDetails: Seller/From details stored as JSON
 * - customerDetails: Customer/Bill to details stored as JSON
 * - logoUrl: Logo URL or base64 data for PDF
 * - templateSettings: Template configuration as JSON
 * - vatRate: VAT rate for invoice
 * - currency: Invoice currency
 * - unit and vatRate for invoice items
 */
export async function up() {
  // Add vatRate column to invoices
  await db`
    ALTER TABLE invoices 
    ADD COLUMN IF NOT EXISTS vat_rate TEXT NOT NULL DEFAULT '20'
  `;

  // Add currency column to invoices
  await db`
    ALTER TABLE invoices 
    ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'EUR'
  `;

  // Add fromDetails column to invoices (JSON as TEXT)
  await db`
    ALTER TABLE invoices 
    ADD COLUMN IF NOT EXISTS from_details TEXT
  `;

  // Add customerDetails column to invoices (JSON as TEXT)
  await db`
    ALTER TABLE invoices 
    ADD COLUMN IF NOT EXISTS customer_details TEXT
  `;

  // Add logoUrl column to invoices
  await db`
    ALTER TABLE invoices 
    ADD COLUMN IF NOT EXISTS logo_url TEXT
  `;

  // Add templateSettings column to invoices (JSON as TEXT)
  await db`
    ALTER TABLE invoices 
    ADD COLUMN IF NOT EXISTS template_settings TEXT
  `;

  // Add unit column to invoice_items
  await db`
    ALTER TABLE invoice_items 
    ADD COLUMN IF NOT EXISTS unit VARCHAR(50) NOT NULL DEFAULT 'pcs'
  `;

  // Add vatRate column to invoice_items
  await db`
    ALTER TABLE invoice_items 
    ADD COLUMN IF NOT EXISTS vat_rate TEXT NOT NULL DEFAULT '20'
  `;

  console.log("✅ Migration 010: Added invoice template fields");
}

export async function down() {
  // Remove from invoices
  await db`ALTER TABLE invoices DROP COLUMN IF EXISTS vat_rate`;
  await db`ALTER TABLE invoices DROP COLUMN IF EXISTS currency`;
  await db`ALTER TABLE invoices DROP COLUMN IF EXISTS from_details`;
  await db`ALTER TABLE invoices DROP COLUMN IF EXISTS customer_details`;
  await db`ALTER TABLE invoices DROP COLUMN IF EXISTS logo_url`;
  await db`ALTER TABLE invoices DROP COLUMN IF EXISTS template_settings`;
  
  // Remove from invoice_items
  await db`ALTER TABLE invoice_items DROP COLUMN IF EXISTS unit`;
  await db`ALTER TABLE invoice_items DROP COLUMN IF EXISTS vat_rate`;
  
  console.log("✅ Migration 010: Removed invoice template fields");
}

