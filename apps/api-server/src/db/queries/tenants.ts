import { sql } from "../client";
import { now } from "@crm/utils";

// ============================================
// Tenant Queries
// ============================================

/**
 * Gets or creates a default tenant with slug "default"
 * This is used for initial setup and for users/companies that don't have a tenant assigned
 */
export async function getOrCreateDefaultTenant(): Promise<string> {
	// First, try to find existing default tenant
	const existing = await sql`
    SELECT id FROM tenants 
    WHERE slug = 'default' 
      AND deleted_at IS NULL
    LIMIT 1
  `;

	if (existing.length > 0) {
		return existing[0].id as string;
	}

	// If not found, create default tenant
	const createdAt = now();
	const [newTenant] = await sql`
    INSERT INTO tenants (
      name,
      slug,
      status,
      metadata,
      created_at,
      updated_at
    )
    VALUES (
      'Default Tenant',
      'default',
      'active',
      '{}'::jsonb,
      ${createdAt},
      ${createdAt}
    )
    RETURNING id
  `;

	return newTenant.id as string;
}

/**
 * Get tenant by ID
 */
export async function getTenantById(tenantId: string): Promise<{
	id: string;
	name: string;
	slug: string;
	status: string;
	metadata: Record<string, unknown> | null;
	createdAt: string;
	updatedAt: string;
} | null> {
	const result = await sql`
    SELECT 
      id,
      name,
      slug,
      status,
      metadata,
      created_at,
      updated_at
    FROM tenants
    WHERE id = ${tenantId}
      AND deleted_at IS NULL
    LIMIT 1
  `;

	if (result.length === 0) {
		return null;
	}

	const row = result[0];
	return {
		id: row.id as string,
		name: row.name as string,
		slug: row.slug as string,
		status: row.status as string,
		metadata: (row.metadata as Record<string, unknown>) || null,
		createdAt: new Date(row.created_at as Date).toISOString(),
		updatedAt: new Date(row.updated_at as Date).toISOString(),
	};
}

/**
 * Get tenant by slug
 */
export async function getTenantBySlug(slug: string): Promise<{
	id: string;
	name: string;
	slug: string;
	status: string;
	metadata: Record<string, unknown> | null;
	createdAt: string;
	updatedAt: string;
} | null> {
	const result = await sql`
    SELECT 
      id,
      name,
      slug,
      status,
      metadata,
      created_at,
      updated_at
    FROM tenants
    WHERE slug = ${slug}
      AND deleted_at IS NULL
    LIMIT 1
  `;

	if (result.length === 0) {
		return null;
	}

	const row = result[0];
	return {
		id: row.id as string,
		name: row.name as string,
		slug: row.slug as string,
		status: row.status as string,
		metadata: (row.metadata as Record<string, unknown>) || null,
		createdAt: new Date(row.created_at as Date).toISOString(),
		updatedAt: new Date(row.updated_at as Date).toISOString(),
	};
}

