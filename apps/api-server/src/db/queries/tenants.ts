import { now } from "@crm/utils";
import { sql } from "../client";

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

/**
 * Get tenant account (seller company details) by tenant ID
 */
export async function getTenantAccountByTenantId(tenantId: string): Promise<{
  id: string;
  tenantId: string;
  name: string;
  industry: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  contact: string | null;
  city: string | null;
  zip: string | null;
  country: string | null;
  countryCode: string | null;
  vatNumber: string | null;
  companyNumber: string | null;
  logoUrl: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
} | null> {
  const result = await sql`
    SELECT
      id,
      tenant_id,
      name,
      industry,
      address,
      email,
      phone,
      website,
      contact,
      city,
      zip,
      country,
      country_code,
      vat_number,
      company_number,
      logo_url,
      note,
      created_at,
      updated_at
    FROM tenant_accounts
    WHERE tenant_id = ${tenantId}
    LIMIT 1
  `;

  if (result.length === 0) {
    return null;
  }

  const row = result[0];
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    name: row.name as string,
    industry: (row.industry as string) || null,
    address: (row.address as string) || null,
    email: (row.email as string) || null,
    phone: (row.phone as string) || null,
    website: (row.website as string) || null,
    contact: (row.contact as string) || null,
    city: (row.city as string) || null,
    zip: (row.zip as string) || null,
    country: (row.country as string) || null,
    countryCode: (row.country_code as string) || null,
    vatNumber: (row.vat_number as string) || null,
    companyNumber: (row.company_number as string) || null,
    logoUrl: (row.logo_url as string) || null,
    note: (row.note as string) || null,
    createdAt: new Date(row.created_at as Date).toISOString(),
    updatedAt: new Date(row.updated_at as Date).toISOString(),
  };
}
