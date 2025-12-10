import type { CustomerOrganization, FilterParams, PaginationParams } from "@crm/types";
import { sql as db } from "../client";
import type { QueryParam } from "../query-builder";
import { sanitizeSortColumn, sanitizeSortOrder } from "../query-builder";

export const organizationQueries = {
  async findAll(pagination: PaginationParams, filters: FilterParams & { search?: string }) {
    const { page = 1, pageSize = 20 } = pagination;
    const safePage = Math.max(1, Math.floor(page));
    const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
    const offset = (safePage - 1) * safePageSize;

    const conditions: string[] = [];
    const values: QueryParam[] = [];
    let paramIndex = 1;

    // Search by organization name
    if (filters.search) {
      values.push(`%${String(filters.search).toLowerCase()}%`);
      conditions.push(`LOWER(co.name) LIKE $${paramIndex++}`);
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
      SELECT co.*
      FROM customer_organizations co
      ${joinClause}
      ${whereClause}
      ORDER BY co.${sortBy} ${sortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const rows = await db.unsafe(selectQuery, [...values, safePageSize, offset]);
    return { data: rows.map(mapOrganization), total };
  },

  async getById(id: string) {
    const rows = await db`SELECT * FROM customer_organizations WHERE id = ${id}`;
    return rows.length ? mapOrganization(rows[0]) : null;
  },

  async create(org: CustomerOrganization): Promise<CustomerOrganization> {
    const result = await db`
      INSERT INTO customer_organizations (
        id, name, email, phone, pib, company_number, contact_person, is_favorite, created_at, updated_at
      ) VALUES (
        ${org.id}, ${org.name}, ${org.email || null}, ${org.phone || null}, ${org.pib || null},
        ${org.companyNumber || null}, ${org.contactPerson || null}, ${org.isFavorite ?? false},
        ${org.createdAt}, ${org.updatedAt}
      )
      RETURNING *
    `;
    return mapOrganization(result[0]);
  },

  async update(id: string, data: Partial<CustomerOrganization>): Promise<CustomerOrganization> {
    const result = await db`
      UPDATE customer_organizations SET
        name = COALESCE(${data.name ?? null}, name),
        email = COALESCE(${data.email ?? null}, email),
        phone = COALESCE(${data.phone ?? null}, phone),
        pib = COALESCE(${data.pib ?? null}, pib),
        company_number = COALESCE(${data.companyNumber ?? null}, company_number),
        contact_person = COALESCE(${data.contactPerson ?? null}, contact_person),
        is_favorite = COALESCE(${data.isFavorite ?? null}, is_favorite),
        updated_at = ${data.updatedAt ?? new Date().toISOString()}
      WHERE id = ${id}
      RETURNING *
    `;
    return mapOrganization(result[0]);
  },

  async delete(id: string): Promise<void> {
    await db`DELETE FROM customer_organizations WHERE id = ${id}`;
  },
};

function mapOrganization(row: Record<string, unknown>): CustomerOrganization {
  return {
    id: row.id as string,
    name: row.name as string,
    email: (row.email as string) || null,
    phone: (row.phone as string) || null,
    pib: (row.pib as string) || null,
    companyNumber: (row.company_number as string) || null,
    contactPerson: (row.contact_person as string) || null,
    isFavorite: (row.is_favorite as boolean | null) ?? null,
    tenantId: (row.tenant_id as string) || undefined,
    roles: (row.roles as string[] | null) || undefined,
    status: (row.status as string | null) || undefined,
    tags: (row.tags as string[] | null) || undefined,
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
