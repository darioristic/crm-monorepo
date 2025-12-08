import { logger } from "../../lib/logger";
import { sql as db } from "../client";

export const name = "015_update_inline_companies_source";

export async function up(): Promise<void> {
  logger.info(`Running migration: ${name}`);

  // This migration updates existing inline companies to have source = 'inline'
  // Since we can't easily identify which companies were created inline vs manually,
  // we'll leave existing companies as 'manual' (default) and only new inline companies
  // will have source = 'inline'

  // For now, we'll just ensure all companies have a source value
  // Companies without source will be set to 'manual' (they were created before the migration)
  await db`
    UPDATE companies
    SET source = 'manual'
    WHERE source IS NULL
  `;

  logger.info(`✅ Migration ${name} completed`);
}

export async function down(): Promise<void> {
  logger.info(`Rolling back migration: ${name}`);
  // No rollback needed - we're just setting default values
  logger.info(`✅ Rollback ${name} completed`);
}
