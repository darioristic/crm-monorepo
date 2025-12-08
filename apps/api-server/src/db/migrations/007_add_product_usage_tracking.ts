/**
 * Migration: Add product usage tracking fields
 *
 * Adds usageCount and lastUsedAt fields to products table
 * for smart autocomplete and product learning from invoices
 * (like midday-main implementation)
 */

import { logger } from "../../lib/logger";
import { sql as db } from "../client";

export const name = "007_add_product_usage_tracking";

export async function up(): Promise<void> {
  logger.info(`⬆️  Running ${name}...`);

  // Add usage_count column
  await db`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS usage_count INTEGER NOT NULL DEFAULT 0
  `;

  // Add last_used_at column
  await db`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ
  `;

  // Add index for usage_count (for popular products sorting)
  await db`
    CREATE INDEX IF NOT EXISTS idx_products_usage_count
    ON products (usage_count DESC)
  `;

  // Add index for last_used_at (for recent products sorting)
  await db`
    CREATE INDEX IF NOT EXISTS idx_products_last_used_at
    ON products (last_used_at DESC NULLS LAST)
  `;

  logger.info(`✅ ${name} completed`);
}

export async function down(): Promise<void> {
  logger.info(`⬇️  Rolling back ${name}...`);

  // Drop indexes
  await db`DROP INDEX IF EXISTS idx_products_last_used_at`;
  await db`DROP INDEX IF EXISTS idx_products_usage_count`;

  // Drop columns
  await db`ALTER TABLE products DROP COLUMN IF EXISTS last_used_at`;
  await db`ALTER TABLE products DROP COLUMN IF EXISTS usage_count`;

  logger.info(`✅ ${name} rolled back`);
}
