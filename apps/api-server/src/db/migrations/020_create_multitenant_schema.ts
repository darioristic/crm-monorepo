/**
 * Migration: Create Multitenant Schema
 * Creates tenants, locations, and updates existing tables with tenantId/companyId
 */

import { logger } from "../../lib/logger";
import { sql as db } from "../client";

export const name = "020_create_multitenant_schema";

export async function up(): Promise<void> {
  logger.info("Creating multitenant schema...");

  // Create tenant_status enum
  await db`
		DO $$ BEGIN
			CREATE TYPE tenant_status AS ENUM ('active', 'suspended', 'deleted');
		EXCEPTION
			WHEN duplicate_object THEN null;
		END $$
	`;

  // Create tenants table
  await db`
		CREATE TABLE IF NOT EXISTS tenants (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			name VARCHAR(255) NOT NULL,
			slug VARCHAR(255) NOT NULL UNIQUE,
			status tenant_status NOT NULL DEFAULT 'active',
			metadata JSONB,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			deleted_at TIMESTAMPTZ
		)
	`;

  // Create locations table
  await db`
		CREATE TABLE IF NOT EXISTS locations (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
			name VARCHAR(255) NOT NULL,
			code VARCHAR(50),
			metadata JSONB,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`;

  // Create user_role enum (idempotent)
  await db`
		DO $$ BEGIN
			CREATE TYPE user_role AS ENUM ('superadmin', 'tenant_admin', 'crm_user');
		EXCEPTION
			WHEN duplicate_object THEN null;
		END $$
	`;

  // Ensure enum values exist (idempotent; supported on modern PostgreSQL)
  await db`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'superadmin'`;
  await db`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'tenant_admin'`;
  await db`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'crm_user'`;

  // Create tenant_role enum
  await db`
		DO $$ BEGIN
			CREATE TYPE tenant_role AS ENUM ('admin', 'manager', 'user');
		EXCEPTION
			WHEN duplicate_object THEN null;
		END $$
	`;

  // Add tenant_id to users table (if not exists)
  await db`
		DO $$ BEGIN
			ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
		EXCEPTION
			WHEN duplicate_column THEN null;
		END $$
	`;

  // Create user_tenant_roles table
  await db`
		CREATE TABLE IF NOT EXISTS user_tenant_roles (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
			role tenant_role NOT NULL DEFAULT 'user',
			permissions JSONB,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`;

  // Add tenant_id to companies table (if not exists)
  await db`
		DO $$ BEGIN
			ALTER TABLE companies ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
		EXCEPTION
			WHEN duplicate_column THEN null;
		END $$
	`;

  // Add location_id to companies table (if not exists)
  await db`
		DO $$ BEGIN
			ALTER TABLE companies ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;
		EXCEPTION
			WHEN duplicate_column THEN null;
		END $$
	`;

  // Add metadata to companies table (if not exists)
  await db`
		DO $$ BEGIN
			ALTER TABLE companies ADD COLUMN IF NOT EXISTS metadata JSONB;
		EXCEPTION
			WHEN duplicate_column THEN null;
		END $$
	`;

  // Create documents table
  await db`
		CREATE TABLE IF NOT EXISTS documents (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
			company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
			created_by UUID REFERENCES users(id) ON DELETE RESTRICT,
			content TEXT,
			metadata JSONB,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`;

  // Ensure documents table has required columns when pre-existing
  await db`
		DO $$ BEGIN
			IF NOT EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_name = 'documents' AND column_name = 'tenant_id'
			) THEN
				ALTER TABLE documents ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
			END IF;
			IF NOT EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_name = 'documents' AND column_name = 'company_id'
			) THEN
				ALTER TABLE documents ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
			END IF;
			IF NOT EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_name = 'documents' AND column_name = 'created_by'
			) THEN
				ALTER TABLE documents ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE RESTRICT;
			END IF;
		END $$
	`;

  // Add tenant_id and company_id to contacts table (if not exists)
  await db`
		DO $$ BEGIN
			ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
			ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
		EXCEPTION
			WHEN duplicate_column THEN null;
		END $$
	`;

  // Add tenant_id and company_id to activities table (if not exists)
  await db`
		DO $$ BEGIN
			ALTER TABLE activities ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
			ALTER TABLE activities ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
		EXCEPTION
			WHEN duplicate_column THEN null;
		END $$
	`;

  // Create indexes
  await db`CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug)`;
  await db`CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status)`;
  await db`CREATE INDEX IF NOT EXISTS idx_tenants_deleted_at ON tenants(deleted_at)`;

  await db`CREATE INDEX IF NOT EXISTS idx_locations_tenant_id ON locations(tenant_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_locations_code ON locations(code)`;

  await db`CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id)`;

  await db`CREATE INDEX IF NOT EXISTS idx_user_tenant_roles_user_id ON user_tenant_roles(user_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_user_tenant_roles_tenant_id ON user_tenant_roles(tenant_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_user_tenant_roles_user_tenant ON user_tenant_roles(user_id, tenant_id)`;

  await db`CREATE INDEX IF NOT EXISTS idx_companies_tenant_id ON companies(tenant_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_companies_company_id_tenant_id ON companies(id, tenant_id)`;

  await db`CREATE INDEX IF NOT EXISTS idx_documents_tenant_company ON documents(tenant_id, company_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_documents_company_id ON documents(company_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_documents_created_by ON documents(created_by)`;

  await db`CREATE INDEX IF NOT EXISTS idx_contacts_tenant_company ON contacts(tenant_id, company_id)`;

  await db`CREATE INDEX IF NOT EXISTS idx_activities_tenant_company ON activities(tenant_id, company_id)`;

  logger.info("✅ Multitenant schema created successfully");
}

export async function down(): Promise<void> {
  logger.info("Rolling back multitenant schema...");

  // Drop indexes
  await db`DROP INDEX IF EXISTS idx_activities_tenant_company`;
  await db`DROP INDEX IF EXISTS idx_contacts_tenant_company`;
  await db`DROP INDEX IF EXISTS idx_documents_created_by`;
  await db`DROP INDEX IF EXISTS idx_documents_company_id`;
  await db`DROP INDEX IF EXISTS idx_documents_tenant_company`;
  await db`DROP INDEX IF EXISTS idx_companies_company_id_tenant_id`;
  await db`DROP INDEX IF EXISTS idx_companies_tenant_id`;
  await db`DROP INDEX IF EXISTS idx_user_tenant_roles_user_tenant`;
  await db`DROP INDEX IF EXISTS idx_user_tenant_roles_tenant_id`;
  await db`DROP INDEX IF EXISTS idx_user_tenant_roles_user_id`;
  await db`DROP INDEX IF EXISTS idx_users_tenant_id`;
  await db`DROP INDEX IF EXISTS idx_locations_code`;
  await db`DROP INDEX IF EXISTS idx_locations_tenant_id`;
  await db`DROP INDEX IF EXISTS idx_tenants_deleted_at`;
  await db`DROP INDEX IF EXISTS idx_tenants_status`;
  await db`DROP INDEX IF EXISTS idx_tenants_slug`;

  // Drop columns from existing tables
  await db`ALTER TABLE activities DROP COLUMN IF EXISTS company_id`;
  await db`ALTER TABLE activities DROP COLUMN IF EXISTS tenant_id`;
  await db`ALTER TABLE contacts DROP COLUMN IF EXISTS company_id`;
  await db`ALTER TABLE contacts DROP COLUMN IF EXISTS tenant_id`;
  await db`ALTER TABLE companies DROP COLUMN IF EXISTS metadata`;
  await db`ALTER TABLE companies DROP COLUMN IF EXISTS location_id`;
  await db`ALTER TABLE companies DROP COLUMN IF EXISTS tenant_id`;
  await db`ALTER TABLE users DROP COLUMN IF EXISTS tenant_id`;

  // Drop new tables
  await db`DROP TABLE IF EXISTS user_tenant_roles CASCADE`;
  await db`DROP TABLE IF EXISTS documents CASCADE`;
  await db`DROP TABLE IF EXISTS locations CASCADE`;
  await db`DROP TABLE IF EXISTS tenants CASCADE`;

  // Drop enums
  await db`DROP TYPE IF EXISTS tenant_role`;
  // Note: We don't drop user_role enum as it might be used elsewhere

  logger.info("✅ Multitenant schema rolled back");
}
