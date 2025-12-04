/**
 * Migration: Add Performance Indexes
 * 
 * Adds composite indexes for common query patterns to improve performance:
 * - WHERE + ORDER BY combinations
 * - Frequently filtered columns together
 * - Foreign key + status combinations
 */

import { sql as db } from "../client";

export const name = "017_add_performance_indexes";

export async function up(): Promise<void> {
	console.log(`Running migration: ${name}`);
	console.log("Creating performance indexes...");

	// ============================================
	// Invoice Performance Indexes
	// ============================================
	
	// Common pattern: Filter by status and order by date
	await db`
		CREATE INDEX IF NOT EXISTS idx_invoices_status_created_at 
		ON invoices(status, created_at DESC)
	`;
	
	// Filter by company and status
	await db`
		CREATE INDEX IF NOT EXISTS idx_invoices_company_status 
		ON invoices(company_id, status)
	`;
	
	// Filter by company and order by date
	await db`
		CREATE INDEX IF NOT EXISTS idx_invoices_company_created_at 
		ON invoices(company_id, created_at DESC)
	`;
	
	// Invoice number lookup (should be unique, but add index for fast searches)
	await db`
		CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number_lower 
		ON invoices(LOWER(invoice_number))
	`;

	// ============================================
	// Quote Performance Indexes
	// ============================================
	
	await db`
		CREATE INDEX IF NOT EXISTS idx_quotes_status_created_at 
		ON quotes(status, created_at DESC)
	`;
	
	await db`
		CREATE INDEX IF NOT EXISTS idx_quotes_company_status 
		ON quotes(company_id, status)
	`;

	// ============================================
	// Deal Performance Indexes
	// ============================================
	
	// Filter by stage and order by value
	await db`
		CREATE INDEX IF NOT EXISTS idx_deals_stage_value 
		ON deals(stage, value DESC NULLS LAST)
	`;
	
	// Filter by assigned user and stage
	await db`
		CREATE INDEX IF NOT EXISTS idx_deals_assigned_stage 
		ON deals(assigned_to, stage)
	`;
	
	// Filter by contact and stage (deals don't have company_id, they have contact_id)
	await db`
		CREATE INDEX IF NOT EXISTS idx_deals_contact_stage 
		ON deals(contact_id, stage)
	`;

	// ============================================
	// Contact Performance Indexes
	// ============================================
	
	// Filter by company and order by name
	await db`
		CREATE INDEX IF NOT EXISTS idx_contacts_company_name 
		ON contacts(company, last_name, first_name)
	`;
	
	// Email search (case-insensitive)
	await db`
		CREATE INDEX IF NOT EXISTS idx_contacts_email_lower 
		ON contacts(LOWER(email))
	`;

	// ============================================
	// Document (Vault) Performance Indexes
	// ============================================
	
	// Filter by company and order by date
	await db`
		CREATE INDEX IF NOT EXISTS idx_documents_company_date 
		ON documents(company_id, date DESC NULLS LAST)
	`;
	
	// Filter by company and processing status
	await db`
		CREATE INDEX IF NOT EXISTS idx_documents_company_status 
		ON documents(company_id, processing_status)
	`;

	// ============================================
	// User Performance Indexes
	// ============================================
	
	// Filter by company and role
	await db`
		CREATE INDEX IF NOT EXISTS idx_users_company_role 
		ON users(company_id, role)
	`;
	
	// Email lookup (case-insensitive)
	await db`
		CREATE INDEX IF NOT EXISTS idx_users_email_lower 
		ON users(LOWER(email))
	`;

	// ============================================
	// Users on Company Performance Indexes
	// ============================================
	
	// Common lookup: user_id + company_id (already covered by unique constraint, but add for completeness)
	// Filter by company and role
	await db`
		CREATE INDEX IF NOT EXISTS idx_users_on_company_company_role 
		ON users_on_company(company_id, role)
	`;

	// ============================================
	// Payment Performance Indexes
	// ============================================
	
	// Filter by invoice and status
	await db`
		CREATE INDEX IF NOT EXISTS idx_payments_invoice_status 
		ON payments(invoice_id, status)
	`;
	
	// Filter by date range
	await db`
		CREATE INDEX IF NOT EXISTS idx_payments_date_status 
		ON payments(payment_date DESC, status)
	`;

	// ============================================
	// Notification Performance Indexes
	// ============================================
	
	// Common query: unread notifications for user, ordered by date
	await db`
		CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created 
		ON notifications(user_id, is_read, created_at DESC)
	`;
	
	// Filter by type and date
	await db`
		CREATE INDEX IF NOT EXISTS idx_notifications_type_created 
		ON notifications(type, created_at DESC)
	`;

	// ============================================
	// Order Performance Indexes
	// ============================================
	
	// Only create index if orders table exists
	try {
		const tableExists = await db`
			SELECT EXISTS (
				SELECT FROM information_schema.tables 
				WHERE table_schema = 'public' 
				AND table_name = 'orders'
			)
		`;
		
		if (tableExists[0]?.exists) {
			await db`
				CREATE INDEX IF NOT EXISTS idx_orders_company_status_date 
				ON orders(company_id, status, created_at DESC)
			`;
		}
	} catch (error) {
		console.warn("Orders table not found, skipping order indexes:", error);
	}

	console.log("Performance indexes created successfully");
}

export async function down(): Promise<void> {
	console.log("Dropping performance indexes...");

	// Drop all indexes in reverse order
	const indexes = [
		"idx_orders_company_status_date",
		"idx_notifications_type_created",
		"idx_notifications_user_read_created",
		"idx_payments_date_status",
		"idx_payments_invoice_status",
		"idx_users_on_company_company_role",
		"idx_users_email_lower",
		"idx_users_company_role",
		"idx_documents_company_status",
		"idx_documents_company_date",
		"idx_contacts_email_lower",
		"idx_contacts_company_name",
		"idx_deals_contact_stage",
		"idx_deals_assigned_stage",
		"idx_deals_stage_value",
		"idx_quotes_company_status",
		"idx_quotes_status_created_at",
		"idx_invoices_invoice_number_lower",
		"idx_invoices_company_created_at",
		"idx_invoices_company_status",
		"idx_invoices_status_created_at",
	];

	for (const indexName of indexes) {
		// Extract table name from index name (e.g., idx_invoices_status -> invoices)
		const tableMatch = indexName.match(/idx_(\w+)_/);
    if (tableMatch) {
      const _tableName = tableMatch[1];
			try {
				await db.unsafe(`DROP INDEX IF EXISTS ${indexName}`);
				console.log(`Dropped index: ${indexName}`);
			} catch (error) {
				console.warn(`Failed to drop index ${indexName}:`, error);
			}
		}
	}

	console.log("Performance indexes dropped");
}
