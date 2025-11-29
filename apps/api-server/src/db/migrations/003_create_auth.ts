import db from "../client";

export const name = "003_create_auth";

export async function up(): Promise<void> {
	console.log("📦 Creating auth_credentials table...");

	// Auth credentials table - separate from users for security
	await db`
    CREATE TABLE IF NOT EXISTS auth_credentials (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

	// Refresh tokens table for token management
	await db`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ
    )
  `;

	console.log("📦 Creating audit_logs table...");

	// Audit logs table for tracking all actions
	await db`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id UUID,
      ip_address VARCHAR(45),
      user_agent TEXT,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

	// Create indexes for auth_credentials
	await db`CREATE INDEX IF NOT EXISTS idx_auth_credentials_user_id ON auth_credentials(user_id)`;

	// Create indexes for refresh_tokens
	await db`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)`;
	await db`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash)`;
	await db`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at)`;

	// Create indexes for audit_logs
	await db`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)`;
	await db`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`;
	await db`CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id)`;
	await db`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)`;

	console.log("✅ Migration 003_create_auth completed");
}

export async function down(): Promise<void> {
	console.log("🔄 Rolling back 003_create_auth...");

	// Drop indexes first
	await db`DROP INDEX IF EXISTS idx_audit_logs_created_at`;
	await db`DROP INDEX IF EXISTS idx_audit_logs_entity`;
	await db`DROP INDEX IF EXISTS idx_audit_logs_action`;
	await db`DROP INDEX IF EXISTS idx_audit_logs_user_id`;
	await db`DROP INDEX IF EXISTS idx_refresh_tokens_expires_at`;
	await db`DROP INDEX IF EXISTS idx_refresh_tokens_token_hash`;
	await db`DROP INDEX IF EXISTS idx_refresh_tokens_user_id`;
	await db`DROP INDEX IF EXISTS idx_auth_credentials_user_id`;

	// Drop tables
	await db`DROP TABLE IF EXISTS audit_logs CASCADE`;
	await db`DROP TABLE IF EXISTS refresh_tokens CASCADE`;
	await db`DROP TABLE IF EXISTS auth_credentials CASCADE`;

	console.log("✅ Rollback 003_create_auth completed");
}

