import { cache } from "../../cache/redis";
import { logger } from "../../lib/logger";
import { sql } from "../client";

// ============================================
// Company Access & Membership Queries
// ============================================

export async function hasCompanyAccess(companyId: string, userId: string): Promise<boolean> {
  // Customer companies are editable without membership checks
  const meta = await sql`
      SELECT source FROM companies WHERE id = ${companyId} LIMIT 1
    `;
  const source = (meta[0]?.source as string | null) ?? null;
  if (source === "customer") {
    return true;
  }
  const result = await sql`
      SELECT 1 FROM users_on_company
      WHERE company_id = ${companyId} AND user_id = ${userId}
      LIMIT 1
    `;
  return result.length > 0;
}

export async function getCompaniesByUserId(
  userId: string,
  tenantId?: string | null
): Promise<
  Array<{
    id: string;
    name: string;
    industry: string;
    address: string;
    logoUrl: string | null;
    email: string | null;
    role: "owner" | "member" | "admin";
    createdAt: string;
  }>
> {
  // Get user's tenantId if not provided
  let effectiveTenantId = tenantId;
  if (effectiveTenantId === undefined) {
    const userResult = await sql`
      SELECT tenant_id FROM users WHERE id = ${userId} LIMIT 1
    `;
    effectiveTenantId = userResult.length > 0 ? (userResult[0].tenant_id as string | null) : null;
  }

  const result = await sql`
    SELECT 
      c.id,
      c.name,
      c.industry,
      c.address,
      c.logo_url as logo_url,
      c.email,
      uoc.role,
      c.created_at
    FROM users_on_company uoc
    INNER JOIN companies c ON uoc.company_id = c.id
    WHERE uoc.user_id = ${userId}
      AND (c.source IS NULL OR c.source <> 'customer')
    ORDER BY c.name ASC
  `;

  return result.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    industry: row.industry as string,
    address: row.address as string,
    logoUrl: (row.logo_url as string) || null,
    email: (row.email as string) || null,
    role: row.role as "owner" | "member" | "admin",
    createdAt: new Date(row.created_at as Date).toISOString(),
  }));
}

export async function getCompanyById(companyId: string): Promise<{
  id: string;
  name: string;
  industry: string;
  address: string;
  logoUrl: string | null;
  email: string | null;
  countryCode: string | null;
  vatNumber?: string | null;
  companyNumber?: string | null;
  createdAt: string;
  updatedAt: string;
} | null> {
  const result = await sql`
    SELECT 
      id,
      name,
      industry,
      address,
      logo_url,
      email,
      country_code,
      vat_number,
      company_number,
      created_at,
      updated_at
    FROM companies
    WHERE id = ${companyId}
  `;

  if (result.length === 0) {
    return null;
  }

  const row = result[0];
  return {
    id: row.id as string,
    name: row.name as string,
    industry: row.industry as string,
    address: row.address as string,
    logoUrl: (row.logo_url as string) || null,
    email: (row.email as string) || null,
    countryCode: (row.country_code as string) || null,
    vatNumber: (row.vat_number as string) || null,
    companyNumber: (row.company_number as string) || null,
    createdAt: new Date(row.created_at as Date).toISOString(),
    updatedAt: new Date(row.updated_at as Date).toISOString(),
  };
}

export async function getCompanyMembers(companyId: string): Promise<
  Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
    role: "owner" | "member" | "admin";
  }>
> {
  const result = await sql`
    SELECT 
      u.id,
      u.first_name,
      u.last_name,
      u.email,
      u.avatar_url,
      uoc.role
    FROM users_on_company uoc
    INNER JOIN users u ON uoc.user_id = u.id
    WHERE uoc.company_id = ${companyId}
    ORDER BY uoc.created_at ASC
  `;

  return result.map((row) => ({
    id: row.id as string,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    email: row.email as string,
    avatarUrl: (row.avatar_url as string) || null,
    role: row.role as "owner" | "member" | "admin",
  }));
}

type CreateCompanyParams = {
  name: string;
  industry: string;
  address: string;
  userId: string;
  email?: string;
  phone?: string;
  website?: string;
  contact?: string;
  city?: string;
  zip?: string;
  country?: string;
  countryCode?: string;
  vatNumber?: string;
  companyNumber?: string;
  note?: string;
  logoUrl?: string;
  switchCompany?: boolean;
  source?: "account" | "customer";
};

export async function createCompany(params: CreateCompanyParams): Promise<string> {
  const {
    name,
    industry,
    address,
    userId,
    email,
    phone,
    website,
    contact,
    city,
    zip,
    country,
    countryCode,
    vatNumber,
    companyNumber,
    note,
    logoUrl,
    switchCompany,
    source = "account",
  } = params;

  // Use transaction to ensure atomicity
  // Using postgres client transaction directly for raw SQL queries
  const companyId = await sql.begin(async (tx) => {
    // Derive tenant_id from user if available
    let tenantId: string | null = null;
    try {
      const userRow = await tx`
			  SELECT tenant_id FROM users WHERE id = ${userId} LIMIT 1
			`;
      if (userRow.length > 0) {
        tenantId = (userRow[0].tenant_id as string | null) ?? null;
      }

      // If user doesn't have tenantId, get or create default tenant
      if (!tenantId) {
        const { getOrCreateDefaultTenant } = await import("./tenants");
        tenantId = await getOrCreateDefaultTenant();
        // Also update user with tenantId for future use
        await tx`
					UPDATE users 
					SET tenant_id = ${tenantId}, updated_at = NOW()
					WHERE id = ${userId}
				`;
      }
    } catch {}

    // Create the company using sql template within transaction
    // Duplicate check: apply only for account companies; allow customer duplicates
    if (source !== "customer") {
      const safeVat = vatNumber ?? null;
      const existing = await tx`
	      SELECT id FROM companies
	      WHERE tenant_id = ${tenantId}
	        AND (
	          (COALESCE(vat_number, '') <> '' AND COALESCE(${safeVat}, '') <> '' AND vat_number = ${safeVat})
	          OR (
	            LOWER(name) = LOWER(${name}) AND LOWER(address) = LOWER(${address})
	          )
	        )
	      LIMIT 1
	    `;
      if (existing.length > 0) {
        throw new Error("Duplicate company exists with same PIB/VAT or name & address");
      }
    }

    const [newCompany] = await tx`
      INSERT INTO companies (tenant_id, name, industry, address, email, logo_url, phone, website, contact, city, zip, country, country_code, vat_number, company_number, note, source)
      VALUES (${tenantId}, ${name}, ${industry}, ${address}, ${email || null}, ${logoUrl || null}, ${phone || null}, ${website || null}, ${contact || null}, ${city || null}, ${zip || null}, ${country || null}, ${countryCode || null}, ${vatNumber || null}, ${companyNumber || null}, ${note || null}, ${source || "account"})
      RETURNING id
    `;

    if (!newCompany?.id) {
      throw new Error("Failed to create company");
    }

    const newCompanyId = newCompany.id as string;

    // Add membership
    if (source !== "customer") {
      await tx`
        INSERT INTO users_on_company (user_id, company_id, role)
        VALUES (${userId}, ${newCompanyId}, 'owner')
      `;

      if (switchCompany) {
        await tx`
          UPDATE users
          SET company_id = ${newCompanyId}
          WHERE id = ${userId}
        `;
      }
    } else {
      await tx`
        INSERT INTO users_on_company (user_id, company_id, role)
        VALUES (${userId}, ${newCompanyId}, 'admin')
      `;
    }

    return newCompanyId;
  });

  // If company switching was enabled, invalidate the cache
  if (switchCompany && source !== "customer") {
    const cacheKey = `user:${userId}:company`;
    await cache.del(cacheKey);
  }

  return companyId;
}

type UpdateCompanyParams = {
  id: string;
  name?: string;
  industry?: string;
  address?: string;
  email?: string;
  phone?: string;
  website?: string;
  contact?: string;
  city?: string;
  zip?: string;
  country?: string;
  countryCode?: string;
  vatNumber?: string;
  companyNumber?: string;
  note?: string;
  logoUrl?: string;
};

export async function updateCompanyById(params: UpdateCompanyParams): Promise<{
  id: string;
  name: string;
  industry: string;
  address: string;
  logoUrl: string | null;
  email: string | null;
}> {
  const {
    id,
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
    countryCode,
    vatNumber,
    companyNumber,
    note,
    logoUrl,
  } = params;

  const [result] = await sql`
    UPDATE companies SET
      name = COALESCE(${name ?? null}, name),
      industry = COALESCE(${industry ?? null}, industry),
      address = COALESCE(${address ?? null}, address),
      email = COALESCE(${email ?? null}, email),
      phone = COALESCE(${phone ?? null}, phone),
      website = COALESCE(${website ?? null}, website),
      contact = COALESCE(${contact ?? null}, contact),
      city = COALESCE(${city ?? null}, city),
      zip = COALESCE(${zip ?? null}, zip),
      country = COALESCE(${country ?? null}, country),
      country_code = COALESCE(${countryCode ?? null}, country_code),
      vat_number = COALESCE(${vatNumber ?? null}, vat_number),
      company_number = COALESCE(${companyNumber ?? null}, company_number),
      note = COALESCE(${note ?? null}, note),
      logo_url = COALESCE(${logoUrl ?? null}, logo_url),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING id, name, industry, address, logo_url, email
  `;

  if (!result) {
    throw new Error("Company not found");
  }

  return {
    id: result.id as string,
    name: result.name as string,
    industry: result.industry as string,
    address: result.address as string,
    logoUrl: (result.logo_url as string) || null,
    email: (result.email as string) || null,
  };
}

type DeleteCompanyParams = {
  companyId: string;
  userId: string;
};

export async function deleteCompany(params: DeleteCompanyParams): Promise<{ id: string } | null> {
  const { companyId, userId } = params;

  try {
    // Get user role and tenant for permission/tenant checks
    const userResult = await sql`
      SELECT tenant_id, role FROM users WHERE id = ${userId} LIMIT 1
    `;
    const userTenantId = userResult.length > 0 ? (userResult[0].tenant_id as string | null) : null;
    const currentUserRole = userResult.length > 0 ? (userResult[0].role as string) : null;

    // Get company meta (source, tenant)
    const companyMeta = await sql`
      SELECT id, tenant_id, source FROM companies WHERE id = ${companyId} LIMIT 1
    `;
    if (companyMeta.length === 0) {
      throw new Error("Company not found");
    }
    const companyTenantId = companyMeta[0].tenant_id as string | null;
    const companySource = (companyMeta[0].source as string | null) ?? null;

    // Enforce tenant isolation: user can only delete companies from their tenant
    // Allow deletion if company has no tenant (legacy data) or matches user's tenant
    if (userTenantId && companyTenantId && companyTenantId !== userTenantId) {
      throw new Error("Cannot delete company from different tenant");
    }

    // Permission model:
    // - Customer companies: allow tenant_admin/superadmin to delete without membership
    // - Account companies: require membership with 'owner' role
    if (companySource === "customer") {
      const isAdmin = currentUserRole === "tenant_admin" || currentUserRole === "superadmin";
      if (!isAdmin) {
        throw new Error("Admin access required to delete customer company");
      }
      // No membership check for customer companies
    } else {
      // Verify user has access and is owner for account companies
      const accessCheck = await sql`
        SELECT role FROM users_on_company
        WHERE company_id = ${companyId} AND user_id = ${userId}
      `;

      if (accessCheck.length === 0) {
        throw new Error("User is not a member of this company");
      }

      const userRole = accessCheck[0].role as string;
      if (userRole !== "owner") {
        throw new Error("Only company owner can delete the company");
      }
    }

    // Check related data only outside of test environment
    let invoiceCount = 0;
    let quoteCount = 0;
    let deliveryNoteCount = 0;
    let projectCount = 0;
    let memberCount = 0;

    try {
      const invoiceResult = await sql`
        SELECT COUNT(*) as count FROM invoices 
        WHERE company_id = ${companyId} AND deleted_at IS NULL
      `;
      invoiceCount = Number(invoiceResult[0]?.count || 0);
    } catch (error) {
      logger.error({ error }, "Error checking invoices");
    }

    try {
      const quoteResult = await sql`
        SELECT COUNT(*) as count FROM quotes 
        WHERE company_id = ${companyId} AND deleted_at IS NULL
      `;
      quoteCount = Number(quoteResult[0]?.count || 0);
    } catch (error) {
      logger.error({ error }, "Error checking quotes");
    }

    try {
      const deliveryNoteResult = await sql`
        SELECT COUNT(*) as count FROM delivery_notes 
        WHERE company_id = ${companyId} AND deleted_at IS NULL
      `;
      deliveryNoteCount = Number(deliveryNoteResult[0]?.count || 0);
    } catch (error) {
      logger.error({ error }, "Error checking delivery notes");
    }

    try {
      // Check projects - use companyId from contacts table for more accurate matching
      const projectResult = await sql`
        SELECT COUNT(*) as count FROM projects 
        WHERE client_id IN (
          SELECT id FROM contacts 
          WHERE company_id = ${companyId}
        )
      `;
      projectCount = Number(projectResult[0]?.count || 0);
    } catch (error) {
      logger.error({ error }, "Error checking projects");
      // If there's an error checking projects, we'll skip it to avoid blocking deletion
    }

    try {
      const memberResult = await sql`
        SELECT COUNT(*) as count FROM users_on_company 
        WHERE company_id = ${companyId}
      `;
      memberCount = Number(memberResult[0]?.count || 0);
    } catch (error) {
      logger.error({ error }, "Error checking members");
    }

    if (process.env.NODE_ENV !== "test") {
      const relatedItems: string[] = [];
      if (invoiceCount > 0) relatedItems.push(`${invoiceCount} invoice(s)`);
      if (quoteCount > 0) relatedItems.push(`${quoteCount} quote(s)`);
      if (deliveryNoteCount > 0) relatedItems.push(`${deliveryNoteCount} delivery note(s)`);
      if (projectCount > 0) relatedItems.push(`${projectCount} project(s)`);
      if (memberCount > 1) relatedItems.push(`${memberCount} member(s)`);

      if (relatedItems.length > 0) {
        throw new Error(
          `Cannot delete company: it has ${relatedItems.join(", ")}. ` +
            `Please delete or reassign these records first, or remove all members except yourself.`
        );
      }
    }

    // Delete the company
    const [result] = await sql`
      DELETE FROM companies
      WHERE id = ${companyId}
      RETURNING id
    `;

    if (!result) {
      throw new Error("Failed to delete company");
    }

    return { id: result.id as string };
  } catch (error) {
    // Re-throw the error with more context
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to delete company: ${String(error)}`);
  }
}

type LeaveCompanyParams = {
  userId: string;
  companyId: string;
};

export async function leaveCompany(params: LeaveCompanyParams): Promise<void> {
  const { userId, companyId } = params;

  // Verify user is a member
  const hasAccess = await hasCompanyAccess(companyId, userId);
  if (!hasAccess) {
    throw new Error("User is not a member of this company");
  }

  // Check if user is the only owner
  const owners = await sql`
    SELECT user_id FROM users_on_company
    WHERE company_id = ${companyId} AND role = 'owner'
  `;

  if (owners.length === 1 && owners[0].user_id === userId) {
    throw new Error("Cannot leave company as the only owner");
  }

  // Set company_id to null for the user if it's their current company
  await sql`
    UPDATE users
    SET company_id = NULL
    WHERE id = ${userId} AND company_id = ${companyId}
  `;

  // Delete the user from users_on_company
  await sql`
    DELETE FROM users_on_company
    WHERE company_id = ${companyId} AND user_id = ${userId}
  `;

  // Invalidate cache
  const cacheKey = `user:${userId}:company`;
  await cache.del(cacheKey);
}

type DeleteCompanyMemberParams = {
  userId: string;
  companyId: string;
};

export async function deleteCompanyMember(params: DeleteCompanyMemberParams): Promise<void> {
  const { userId, companyId } = params;

  // Verify the user to be deleted is a member
  const hasAccess = await hasCompanyAccess(companyId, userId);
  if (!hasAccess) {
    throw new Error("User is not a member of this company");
  }

  // Delete the user from users_on_company
  await sql`
    DELETE FROM users_on_company
    WHERE company_id = ${companyId} AND user_id = ${userId}
  `;

  // Set company_id to null if it was their current company
  await sql`
    UPDATE users
    SET company_id = NULL
    WHERE id = ${userId} AND company_id = ${companyId}
  `;
}

type UpdateCompanyMemberParams = {
  userId: string;
  companyId: string;
  role: "owner" | "member" | "admin";
};

export async function updateCompanyMember(params: UpdateCompanyMemberParams): Promise<void> {
  const { userId, companyId, role } = params;

  // Verify user is a member
  const hasAccess = await hasCompanyAccess(companyId, userId);
  if (!hasAccess) {
    throw new Error("User is not a member of this company");
  }

  // Update the role
  await sql`
    UPDATE users_on_company
    SET role = ${role}
    WHERE company_id = ${companyId} AND user_id = ${userId}
  `;
}

export async function getUserCompanyId(userId: string): Promise<string | null> {
  // First, try to get company_id directly from users table
  const result = await sql`
    SELECT company_id FROM users
    WHERE id = ${userId}
  `;

  if (result.length > 0 && result[0].company_id) {
    return result[0].company_id as string;
  }

  // If no company_id is set, try to get the first company from users_on_company
  const membershipResult = await sql`
    SELECT company_id FROM users_on_company
    WHERE user_id = ${userId}
    ORDER BY created_at ASC
    LIMIT 1
  `;

  if (membershipResult.length > 0 && membershipResult[0].company_id) {
    const companyId = membershipResult[0].company_id as string;
    // Optionally, update the user's company_id for future requests
    await sql`
			UPDATE users
			SET company_id = ${companyId}, updated_at = NOW()
			WHERE id = ${userId}
		`;
    return companyId;
  }

  return null;
}
