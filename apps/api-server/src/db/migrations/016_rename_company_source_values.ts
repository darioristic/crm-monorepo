import { logger } from "../../lib/logger";
import { sql as db } from "../client";

export const name = "016_rename_company_source_values";

export async function up(): Promise<void> {
  logger.info(`Running migration: ${name}`);

  // Rename source values to be more descriptive:
  // 'manual' -> 'account' (companies that use the app - account holders)
  // 'inline' -> 'customer' (companies that are customers/clients)

  await db`
    UPDATE companies
    SET source = 'account'
    WHERE source = 'manual' OR source IS NULL
  `;

  await db`
    UPDATE companies
    SET source = 'customer'
    WHERE source = 'inline'
  `;

  // Update default value
  await db`
    ALTER TABLE companies
    ALTER COLUMN source SET DEFAULT 'account'
  `;

  logger.info(`✅ Migration ${name} completed`);
}

export async function down(): Promise<void> {
  logger.info(`Rolling back migration: ${name}`);

  // Revert back to old values
  await db`
    UPDATE companies
    SET source = 'manual'
    WHERE source = 'account'
  `;

  await db`
    UPDATE companies
    SET source = 'inline'
    WHERE source = 'customer'
  `;

  await db`
    ALTER TABLE companies
    ALTER COLUMN source SET DEFAULT 'manual'
  `;

  logger.info(`✅ Rollback ${name} completed`);
}
