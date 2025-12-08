import { logger } from "../../lib/logger";
import { sql as db } from "../client";

export const name = "012_add_company_logo_url";

/**
 * Migration: Add logoUrl field to companies table
 */
export async function up() {
  await db`
    ALTER TABLE companies 
    ADD COLUMN IF NOT EXISTS logo_url TEXT
  `;

  logger.info("✅ Migration 012: Added logo_url column to companies");
}

export async function down() {
  await db`ALTER TABLE companies DROP COLUMN IF EXISTS logo_url`;

  logger.info("✅ Migration 012: Removed logo_url column from companies");
}
