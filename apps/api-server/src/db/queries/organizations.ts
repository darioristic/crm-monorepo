import type { CustomerOrganization, FilterParams, PaginationParams } from "@crm/types";
import { sql as db } from "../client";
import type { QueryParam } from "../query-builder";
import { sanitizeSortColumn, sanitizeSortOrder } from "../query-builder";

export const organizationQueries = {
  async findAll(
    pagination: PaginationParams,
    filters: FilterParams & { search?: string; tags?: string[] }
  ) {
    const { page = 1, pageSize = 20 } = pagination;
    const safePage = Math.max(1, Math.floor(page));
    const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
    const offset = (safePage - 1) * safePageSize;

    const conditions: string[] = [];
    const values: QueryParam[] = [];
    let paramIndex = 1;

    // Full-text search across common fields + LIKE on address fields
    if (filters.search) {
      const searchTerm = String(filters.search).trim();
      // FTS term
      values.push(searchTerm);
      const tsParam = `$${paramIndex++}`;
      // LIKE term
      const likeTerm = `%${searchTerm.toLowerCase()}%`;
      values.push(likeTerm);
      const nameParam = `$${paramIndex++}`;
      values.push(likeTerm);
      const addr1Param = `$${paramIndex++}`;
      values.push(likeTerm);
      const cityParam = `$${paramIndex++}`;
      values.push(likeTerm);
      const stateParam = `$${paramIndex++}`;
      values.push(likeTerm);
      const countryParam = `$${paramIndex++}`;
      values.push(likeTerm);
      const zipParam = `$${paramIndex++}`;
      values.push(likeTerm);
      const pibParam = `$${paramIndex++}`;
      values.push(likeTerm);
      const compNumParam = `$${paramIndex++}`;
      values.push(likeTerm);
      const contactParam = `$${paramIndex++}`;
      values.push(likeTerm);
      const emailParam = `$${paramIndex++}`;
      values.push(likeTerm);
      const phoneParam = `$${paramIndex++}`;
      values.push(likeTerm);
      const websiteParam = `$${paramIndex++}`;

      conditions.push(
        `(
          co.fts @@ plainto_tsquery('simple', ${tsParam})
          OR LOWER(co.name) LIKE ${nameParam}
          OR LOWER(COALESCE(co.address_line_1, '')) LIKE ${addr1Param}
          OR LOWER(COALESCE(co.city, '')) LIKE ${cityParam}
          OR LOWER(COALESCE(co.state, '')) LIKE ${stateParam}
          OR LOWER(COALESCE(co.country, '')) LIKE ${countryParam}
          OR LOWER(COALESCE(co.zip, '')) LIKE ${zipParam}
          OR LOWER(COALESCE(co.pib, '')) LIKE ${pibParam}
          OR LOWER(COALESCE(co.company_number, '')) LIKE ${compNumParam}
          OR LOWER(COALESCE(co.contact_person, '')) LIKE ${contactParam}
          OR LOWER(COALESCE(co.email, '')) LIKE ${emailParam}
          OR LOWER(COALESCE(co.phone, '')) LIKE ${phoneParam}
          OR LOWER(COALESCE(co.website, '')) LIKE ${websiteParam}
        )`
      );
    }

    // Tenant scoping: join companies table and filter by tenant_id when provided
    const joinClause = `INNER JOIN companies c ON c.id = co.id`;
    const tenantId = (filters as { tenantId?: string }).tenantId;
    if (tenantId) {
      values.push(String(tenantId));
      conditions.push(`c.tenant_id = $${paramIndex++}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countQuery = `
      SELECT COUNT(*) AS count
      FROM customer_organizations co
      ${joinClause}
      ${whereClause}
    `;
    const countResult = await db.unsafe(countQuery, values);
    const total = parseInt(String(countResult[0]?.count ?? 0), 10);

    const sortBy = sanitizeSortColumn("customer_organizations", pagination.sortBy);
    const sortOrder = sanitizeSortOrder(pagination.sortOrder);

    const selectQuery = `
      SELECT co.*, c.logo_url AS logo_url, c.tenant_id AS tenant_id
      FROM customer_organizations co
      ${joinClause}
      ${whereClause}
      ORDER BY co.${sortBy} ${sortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const rows = await db.unsafe(selectQuery, [...values, safePageSize, offset]);
    return { data: rows.map(mapOrganization), total };
  },

  async getById(id: string, tenantId?: string) {
    if (tenantId) {
      const rows = await db`
        SELECT co.*, c.logo_url AS logo_url, c.tenant_id AS tenant_id
        FROM customer_organizations co
        INNER JOIN companies c ON c.id = co.id
        WHERE co.id = ${id} AND c.tenant_id = ${tenantId}
      `;
      return rows.length ? mapOrganization(rows[0]) : null;
    }
    const rows = await db`
      SELECT co.*, c.logo_url AS logo_url, c.tenant_id AS tenant_id
      FROM customer_organizations co
      LEFT JOIN companies c ON c.id = co.id
      WHERE co.id = ${id}
    `;
    return rows.length ? mapOrganization(rows[0]) : null;
  },

  async create(org: CustomerOrganization): Promise<CustomerOrganization> {
    const result = await db`
      INSERT INTO customer_organizations (
        id, name, email, phone, website, pib, company_number, contact_person, 
        address_line_1, address_line_2, city, state, country, country_code, zip,
        note, tags, is_favorite, created_at, updated_at
      ) VALUES (
        ${org.id}, ${org.name}, ${org.email || null}, ${org.phone || null}, ${org.website || null}, ${org.pib || null},
        ${org.companyNumber || null}, ${org.contactPerson || null},
        ${org.addressLine1 || null}, ${org.addressLine2 || null}, ${org.city || null}, ${org.state || null}, ${org.country || null}, ${org.countryCode || null}, ${org.zip || null},
        ${org.note || null}, ${org.tags ? JSON.stringify(org.tags) : JSON.stringify([])}::jsonb, ${org.isFavorite ?? false},
        ${org.createdAt}, ${org.updatedAt}
      )
      RETURNING *
    `;
    return mapOrganization(result[0]);
  },

  async update(
    id: string,
    data: Partial<CustomerOrganization>,
    tenantId?: string
  ): Promise<CustomerOrganization | null> {
    // Verify tenant ownership before update
    if (tenantId) {
      const exists = await db`
        SELECT 1 FROM customer_organizations co
        INNER JOIN companies c ON c.id = co.id
        WHERE co.id = ${id} AND c.tenant_id = ${tenantId}
      `;
      if (exists.length === 0) return null;
    }
    const result = await db`
      UPDATE customer_organizations SET
        name = COALESCE(${data.name ?? null}, name),
        email = COALESCE(${data.email ?? null}, email),
        phone = COALESCE(${data.phone ?? null}, phone),
        website = COALESCE(${data.website ?? null}, website),
        pib = COALESCE(${data.pib ?? null}, pib),
        company_number = COALESCE(${data.companyNumber ?? null}, company_number),
        contact_person = COALESCE(${data.contactPerson ?? null}, contact_person),
        address_line_1 = COALESCE(${data.addressLine1 ?? null}, address_line_1),
        address_line_2 = COALESCE(${data.addressLine2 ?? null}, address_line_2),
        city = COALESCE(${data.city ?? null}, city),
        state = COALESCE(${data.state ?? null}, state),
        country = COALESCE(${data.country ?? null}, country),
        country_code = COALESCE(${data.countryCode ?? null}, country_code),
        zip = COALESCE(${data.zip ?? null}, zip),
        note = COALESCE(${data.note ?? null}, note),
        tags = COALESCE(${data.tags ? JSON.stringify(data.tags) : null}::jsonb, tags),
        is_favorite = COALESCE(${data.isFavorite ?? null}, is_favorite),
        updated_at = ${data.updatedAt ?? new Date().toISOString()}
      WHERE id = ${id}
      RETURNING *
    `;
    return result.length ? mapOrganization(result[0]) : null;
  },

  async delete(id: string, tenantId?: string): Promise<boolean> {
    // Verify tenant ownership before delete
    if (tenantId) {
      const exists = await db`
        SELECT 1 FROM customer_organizations co
        INNER JOIN companies c ON c.id = co.id
        WHERE co.id = ${id} AND c.tenant_id = ${tenantId}
      `;
      if (exists.length === 0) return false;
    }
    await db`DELETE FROM customer_organizations WHERE id = ${id}`;
    return true;
  },
};

function mapOrganization(row: Record<string, unknown>): CustomerOrganization {
  // Parse tags from JSONB - they can be string[] or {id, name}[]
  let tags: Array<{ id: string; name: string }> | undefined;
  if (row.tags) {
    const rawTags = typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags;
    if (Array.isArray(rawTags)) {
      tags = rawTags.map((tag: string | { id: string; name: string }) => {
        if (typeof tag === "string") {
          return { id: crypto.randomUUID(), name: tag };
        }
        return tag;
      });
    }
  }

  return {
    id: row.id as string,
    name: row.name as string,
    email: (row.email as string) || null,
    phone: (row.phone as string) || null,
    website: (row.website as string) || null,
    pib: (row.pib as string) || null,
    companyNumber: (row.company_number as string) || null,
    contactPerson: (row.contact_person as string) || null,
    isFavorite: (row.is_favorite as boolean | null) ?? null,
    logoUrl: (row.logo_url as string) || null,
    addressLine1: (row.address_line_1 as string) || null,
    addressLine2: (row.address_line_2 as string) || null,
    city: (row.city as string) || null,
    state: (row.state as string) || null,
    country: (row.country as string) || null,
    countryCode: (row.country_code as string) || null,
    zip: (row.zip as string) || null,
    tenantId: (row.tenant_id as string) || undefined,
    roles: (row.roles as string[] | null) || undefined,
    status: (row.status as string | null) || undefined,
    tags,
    note: (row.note as string | null) || null,
    createdAt: toISOString(row.created_at),
    updatedAt: toISOString(row.updated_at),
  } as CustomerOrganization;
}

function toISOString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return String(value);
}
