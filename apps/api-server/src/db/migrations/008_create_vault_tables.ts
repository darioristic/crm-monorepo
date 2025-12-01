/**
 * Migration: Create Vault (Documents) Tables
 *
 * Creates tables for document management:
 * - documents: Main table for storing document metadata
 * - document_tags: Tags for categorizing documents
 * - document_tag_assignments: Junction table for document-tag relationships
 */

import { sql as db } from "../client";

export const name = "008_create_vault_tables";

export async function up(): Promise<void> {
	console.log(`⬆️  Running ${name}...`);

	// Create processing status enum
	await db`
    DO $$ BEGIN
      CREATE TYPE document_processing_status AS ENUM (
        'pending', 'processing', 'completed', 'failed'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `;

	// Create documents table
	await db`
    CREATE TABLE IF NOT EXISTS documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT,
      title TEXT,
      summary TEXT,
      content TEXT,
      body TEXT,
      tag VARCHAR(100),
      date DATE,
      language VARCHAR(10),
      path_tokens TEXT[],
      metadata JSONB DEFAULT '{}',
      processing_status document_processing_status DEFAULT 'pending',
      company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
      owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

	// Create document_tags table
	await db`
    CREATE TABLE IF NOT EXISTS document_tags (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL,
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(slug, company_id)
    )
  `;

	// Create document_tag_assignments table
	await db`
    CREATE TABLE IF NOT EXISTS document_tag_assignments (
      document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      tag_id UUID NOT NULL REFERENCES document_tags(id) ON DELETE CASCADE,
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (document_id, tag_id)
    )
  `;

	// Create indexes for documents
	await db`CREATE INDEX IF NOT EXISTS idx_documents_company_id ON documents(company_id)`;
	await db`CREATE INDEX IF NOT EXISTS idx_documents_owner_id ON documents(owner_id)`;
	await db`CREATE INDEX IF NOT EXISTS idx_documents_name ON documents(name)`;
	await db`CREATE INDEX IF NOT EXISTS idx_documents_processing_status ON documents(processing_status)`;
	await db`CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC)`;
	await db`CREATE INDEX IF NOT EXISTS idx_documents_date ON documents(date DESC NULLS LAST)`;
	await db`CREATE INDEX IF NOT EXISTS idx_documents_path_tokens ON documents USING GIN(path_tokens)`;

	// Create GIN index for full-text search on title and summary
	await db`CREATE INDEX IF NOT EXISTS idx_documents_title_trgm ON documents USING GIN(title gin_trgm_ops)`;
	await db`CREATE INDEX IF NOT EXISTS idx_documents_summary_trgm ON documents USING GIN(summary gin_trgm_ops)`;

	// Create indexes for document_tags
	await db`CREATE INDEX IF NOT EXISTS idx_document_tags_company_id ON document_tags(company_id)`;
	await db`CREATE INDEX IF NOT EXISTS idx_document_tags_slug ON document_tags(slug)`;

	// Create indexes for document_tag_assignments
	await db`CREATE INDEX IF NOT EXISTS idx_document_tag_assignments_tag_id ON document_tag_assignments(tag_id)`;
	await db`CREATE INDEX IF NOT EXISTS idx_document_tag_assignments_company_id ON document_tag_assignments(company_id)`;

	console.log(`✅ ${name} completed`);
}

export async function down(): Promise<void> {
	console.log(`⬇️  Rolling back ${name}...`);

	// Drop indexes
	await db`DROP INDEX IF EXISTS idx_document_tag_assignments_company_id`;
	await db`DROP INDEX IF EXISTS idx_document_tag_assignments_tag_id`;
	await db`DROP INDEX IF EXISTS idx_document_tags_slug`;
	await db`DROP INDEX IF EXISTS idx_document_tags_company_id`;
	await db`DROP INDEX IF EXISTS idx_documents_summary_trgm`;
	await db`DROP INDEX IF EXISTS idx_documents_title_trgm`;
	await db`DROP INDEX IF EXISTS idx_documents_path_tokens`;
	await db`DROP INDEX IF EXISTS idx_documents_date`;
	await db`DROP INDEX IF EXISTS idx_documents_created_at`;
	await db`DROP INDEX IF EXISTS idx_documents_processing_status`;
	await db`DROP INDEX IF EXISTS idx_documents_name`;
	await db`DROP INDEX IF EXISTS idx_documents_owner_id`;
	await db`DROP INDEX IF EXISTS idx_documents_company_id`;

	// Drop tables (in reverse order of dependencies)
	await db`DROP TABLE IF EXISTS document_tag_assignments CASCADE`;
	await db`DROP TABLE IF EXISTS document_tags CASCADE`;
	await db`DROP TABLE IF EXISTS documents CASCADE`;

	// Drop enum
	await db`DROP TYPE IF EXISTS document_processing_status`;

	console.log(`✅ ${name} rolled back`);
}

