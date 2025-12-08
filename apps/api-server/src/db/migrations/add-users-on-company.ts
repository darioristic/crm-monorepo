import { logger } from "../../lib/logger";
import { sql as db } from "../client";

export const name = "013_add_users_on_company";

/**
 * Migration: Add users_on_company table and populate from existing users.company_id
 *
 * This migration:
 * 1. Creates the company_role enum if it doesn't exist
 * 2. Creates the users_on_company table if it doesn't exist
 * 3. Populates it from existing users.company_id relationships
 * 4. Sets role to 'owner' for existing relationships
 * 5. Does NOT delete users.company_id (it remains for current active company)
 */
export async function up(): Promise<void> {
  logger.info(`Running migration: ${name}`);

  // Step 1: Create company_role enum if it doesn't exist
  await db`
		DO $$ BEGIN
			CREATE TYPE company_role AS ENUM ('owner', 'member', 'admin');
		EXCEPTION
			WHEN duplicate_object THEN null;
		END $$
	`;

  // Step 2: Create users_on_company table if it doesn't exist
  await db`
		CREATE TABLE IF NOT EXISTS users_on_company (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
			role company_role NOT NULL DEFAULT 'member',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE(user_id, company_id)
		)
	`;

  // Step 3: Create indexes if they don't exist
  await db`CREATE INDEX IF NOT EXISTS idx_users_on_company_user_id ON users_on_company(user_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_users_on_company_company_id ON users_on_company(company_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_users_on_company_role ON users_on_company(role)`;

  // Step 4: Populate users_on_company from existing users.company_id
  await db`
		INSERT INTO users_on_company (user_id, company_id, role, created_at)
		SELECT 
			u.id as user_id,
			u.company_id as company_id,
			'owner'::company_role as role,
			u.created_at as created_at
		FROM users u
		WHERE u.company_id IS NOT NULL
		AND NOT EXISTS (
			SELECT 1 FROM users_on_company uoc
			WHERE uoc.user_id = u.id AND uoc.company_id = u.company_id
		)
		ON CONFLICT (user_id, company_id) DO NOTHING
	`;

  logger.info(`✅ Migration ${name} completed`);
}

/**
 * Rollback migration
 */
export async function down(): Promise<void> {
  logger.info(`Rolling back migration: ${name}`);

  // Drop indexes
  await db`DROP INDEX IF EXISTS idx_users_on_company_role`;
  await db`DROP INDEX IF EXISTS idx_users_on_company_company_id`;
  await db`DROP INDEX IF EXISTS idx_users_on_company_user_id`;

  // Drop table
  await db`DROP TABLE IF EXISTS users_on_company CASCADE`;

  // Note: We don't drop the company_role enum as it might be used elsewhere
  // If needed, it can be dropped manually: DROP TYPE IF EXISTS company_role;

  logger.info(`✅ Rollback ${name} completed`);
}
