import type {
  Company,
  FilterParams,
  PaginationParams,
  User,
  UserRole,
  UserWithCompany,
} from "@crm/types";
import { sql as db, sql } from "../client";
import { createQueryBuilder, sanitizeSortColumn, sanitizeSortOrder } from "../query-builder";

// ============================================
// User Queries
// ============================================

export const userQueries = {
  async findAll(
    pagination: PaginationParams,
    filters: FilterParams
  ): Promise<{ data: UserWithCompany[]; total: number }> {
    const { page = 1, pageSize = 20 } = pagination;

    // Sanitizuj paginaciju
    const safePage = Math.max(1, Math.floor(page));
    const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
    const safeOffset = (safePage - 1) * safePageSize;

    // Gradi uslove sa query builder-om
    const qb = createQueryBuilder("users");
    qb.addSearchCondition(["u.first_name", "u.last_name", "u.email"], filters.search);
    qb.addEqualCondition("u.role", filters.status); // status filter se mapira na role

    const { clause: whereClause, values: whereValues } = qb.buildWhereClause();

    // Izvršavaj count
    const countQuery = `SELECT COUNT(*) FROM users u ${whereClause}`;
    const countResult = await db.unsafe(countQuery, whereValues as unknown[]);
    const total = parseInt(countResult[0].count, 10);

    // Sanitizuj sortiranje - dodaj prefiks za JOIN
    let sortBy = sanitizeSortColumn("users", pagination.sortBy);
    if (!sortBy.startsWith("u.")) {
      sortBy = `u.${sortBy}`;
    }
    const sortOrder = sanitizeSortOrder(pagination.sortOrder);

    // Izvršavaj select sa JOIN-om
    const selectQuery = `
      SELECT
        u.*,
        c.id as company_id_join,
        c.name as company_name,
        c.industry as company_industry,
        c.address as company_address,
        c.city as company_city,
        c.zip as company_zip,
        c.country as company_country,
        c.email as company_email,
        c.phone as company_phone,
        c.vat_number as company_vat_number,
        c.company_number as company_company_number,
        c.created_at as company_created_at,
        c.updated_at as company_updated_at
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${whereValues.length + 1} OFFSET $${whereValues.length + 2}
    `;

    const data = await db.unsafe(selectQuery, [
      ...whereValues,
      safePageSize,
      safeOffset,
    ] as unknown[]);

    return { data: data.map(mapUserWithCompany), total };
  },

  async findById(id: string): Promise<(UserWithCompany & { tenantId?: string }) | null> {
    const result = await db`
      SELECT
        u.*,
        c.id as company_id_join,
        c.name as company_name,
        c.industry as company_industry,
        c.address as company_address,
        c.city as company_city,
        c.zip as company_zip,
        c.country as company_country,
        c.email as company_email,
        c.phone as company_phone,
        c.vat_number as company_vat_number,
        c.company_number as company_company_number,
        c.created_at as company_created_at,
        c.updated_at as company_updated_at
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.id = ${id}
    `;
    return result.length > 0 ? mapUserWithCompany(result[0]) : null;
  },

  async findByEmail(email: string): Promise<(UserWithCompany & { tenantId?: string }) | null> {
    const result = await db`
      SELECT
        u.*,
        c.id as company_id_join,
        c.name as company_name
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE LOWER(u.email) = LOWER(${email})
    `;
    return result.length > 0 ? mapUserWithCompany(result[0]) : null;
  },

  async create(user: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User> {
    const result = await db`
      INSERT INTO users (first_name, last_name, email, role, company_id)
      VALUES (
        ${user.firstName},
        ${user.lastName},
        ${user.email},
        ${user.role},
        ${user.companyId || null}
      )
      RETURNING *
    `;
    return mapUser(result[0]);
  },

  async createWithId(user: User): Promise<User> {
    const result = await db`
      INSERT INTO users (
        id, first_name, last_name, email, role, company_id,
        status, avatar_url, phone, created_at, updated_at
      )
      VALUES (
        ${user.id},
        ${user.firstName},
        ${user.lastName},
        ${user.email},
        ${user.role},
        ${user.companyId || null},
        ${user.status || "active"},
        ${user.avatarUrl || null},
        ${user.phone || null},
        ${user.createdAt},
        ${user.updatedAt}
      )
      RETURNING *
    `;
    return mapUser(result[0]);
  },

  async update(id: string, data: Partial<User & { tenantId?: string }>): Promise<User> {
    // If companyId is being updated, we need to invalidate cache
    const shouldInvalidateCache = data.companyId !== undefined;

    // Build the update query conditionally
    // For companyId: if undefined, use COALESCE to keep current value; if set, update it
    let result: Array<Record<string, unknown>>;

    const tenantId = (data as { tenantId?: string }).tenantId;

    // Detect if tenant_id column exists to avoid errors on legacy schemas
    let hasTenantIdColumn = true;
    try {
      const columnCheck =
        await db`SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'tenant_id' LIMIT 1`;
      hasTenantIdColumn = columnCheck.length > 0;
    } catch {
      // If check fails, assume column exists to avoid accidental schema drift; subsequent error will be caught
      hasTenantIdColumn = true;
    }

    if (data.companyId !== undefined) {
      // companyId is explicitly provided - update it (can be null to clear it)
      if (hasTenantIdColumn) {
        result = await db`
          UPDATE users SET
            first_name = COALESCE(${data.firstName ?? null}, first_name),
            last_name = COALESCE(${data.lastName ?? null}, last_name),
            email = COALESCE(${data.email ?? null}, email),
            role = COALESCE(${data.role ?? null}, role),
            company_id = ${data.companyId || null},
            tenant_id = ${tenantId !== undefined ? tenantId || null : sql`tenant_id`},
            status = COALESCE(${data.status ?? null}, status),
            avatar_url = COALESCE(${data.avatarUrl ?? null}, avatar_url),
            phone = COALESCE(${data.phone ?? null}, phone),
            updated_at = NOW()
          WHERE id = ${id}
          RETURNING *
        `;
      } else {
        result = await db`
          UPDATE users SET
            first_name = COALESCE(${data.firstName ?? null}, first_name),
            last_name = COALESCE(${data.lastName ?? null}, last_name),
            email = COALESCE(${data.email ?? null}, email),
            role = COALESCE(${data.role ?? null}, role),
            company_id = ${data.companyId || null},
            status = COALESCE(${data.status ?? null}, status),
            avatar_url = COALESCE(${data.avatarUrl ?? null}, avatar_url),
            phone = COALESCE(${data.phone ?? null}, phone),
            updated_at = NOW()
          WHERE id = ${id}
          RETURNING *
        `;
      }
    } else {
      // companyId is not provided - keep current value
      if (hasTenantIdColumn) {
        result = await db`
          UPDATE users SET
            first_name = COALESCE(${data.firstName ?? null}, first_name),
            last_name = COALESCE(${data.lastName ?? null}, last_name),
            email = COALESCE(${data.email ?? null}, email),
            role = COALESCE(${data.role ?? null}, role),
            tenant_id = ${tenantId !== undefined ? tenantId || null : sql`tenant_id`},
            status = COALESCE(${data.status ?? null}, status),
            avatar_url = COALESCE(${data.avatarUrl ?? null}, avatar_url),
            phone = COALESCE(${data.phone ?? null}, phone),
            updated_at = NOW()
          WHERE id = ${id}
          RETURNING *
        `;
      } else {
        result = await db`
          UPDATE users SET
            first_name = COALESCE(${data.firstName ?? null}, first_name),
            last_name = COALESCE(${data.lastName ?? null}, last_name),
            email = COALESCE(${data.email ?? null}, email),
            role = COALESCE(${data.role ?? null}, role),
            status = COALESCE(${data.status ?? null}, status),
            avatar_url = COALESCE(${data.avatarUrl ?? null}, avatar_url),
            phone = COALESCE(${data.phone ?? null}, phone),
            updated_at = NOW()
          WHERE id = ${id}
          RETURNING *
        `;
      }
    }

    if (result.length === 0) {
      throw new Error(`User with id ${id} not found`);
    }

    // Invalidate cache if companyId was updated
    if (shouldInvalidateCache) {
      const { cache } = await import("../../cache/redis");
      const cacheKey = `user:${id}:company`;
      await cache.del(cacheKey);
    }

    return mapUser(result[0]);
  },

  async delete(id: string): Promise<void> {
    await db`DELETE FROM users WHERE id = ${id}`;
  },

  async count(): Promise<number> {
    const result = await db`SELECT COUNT(*) FROM users`;
    return parseInt(result[0].count, 10);
  },

  async findByCompany(companyId: string): Promise<User[]> {
    const result = await db`
      SELECT * FROM users 
      WHERE company_id = ${companyId}
      ORDER BY last_name ASC, first_name ASC
    `;
    return result.map(mapUser);
  },

  async findByRole(role: UserRole): Promise<User[]> {
    const result = await db`
      SELECT * FROM users 
      WHERE role = ${role}
      ORDER BY last_name ASC, first_name ASC
    `;
    return result.map(mapUser);
  },

  async updateLastLogin(id: string): Promise<void> {
    await db`
      UPDATE users SET last_login_at = NOW()
      WHERE id = ${id}
    `;
  },

  async emailExists(email: string, excludeId?: string): Promise<boolean> {
    if (excludeId) {
      const result = await db`
        SELECT COUNT(*) FROM users WHERE LOWER(email) = LOWER(${email}) AND id != ${excludeId}
      `;
      return parseInt(result[0].count, 10) > 0;
    }
    const result = await db`
      SELECT COUNT(*) FROM users WHERE LOWER(email) = LOWER(${email})
    `;
    return parseInt(result[0].count, 10) > 0;
  },

  async getUserCompanyId(userId: string): Promise<string | null> {
    const result = await db`
      SELECT company_id FROM users WHERE id = ${userId}
    `;
    return result.length > 0 ? (result[0].company_id as string | null) : null;
  },
};

// ============================================
// Mapping Functions (snake_case -> camelCase)
// ============================================

function toISOString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return new Date(value).toISOString();
  return new Date().toISOString();
}

function mapUser(row: Record<string, unknown>): User & { tenantId?: string } {
  return {
    id: row.id as string,
    createdAt: toISOString(row.created_at),
    updatedAt: toISOString(row.updated_at),
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    email: row.email as string,
    role: row.role as UserRole,
    companyId: row.company_id as string | undefined,
    tenantId: row.tenant_id as string | undefined,
    status: row.status as User["status"],
    avatarUrl: row.avatar_url as string | undefined,
    phone: row.phone as string | undefined,
    lastLoginAt: row.last_login_at ? toISOString(row.last_login_at) : undefined,
  };
}

function mapUserWithCompany(row: Record<string, unknown>): UserWithCompany {
  const user = mapUser(row);

  let company: Company | undefined;
  if (row.company_id_join) {
    company = {
      id: row.company_id_join as string,
      createdAt: toISOString(row.company_created_at),
      updatedAt: toISOString(row.company_updated_at),
      name: row.company_name as string,
      industry: row.company_industry as string,
      address: row.company_address as string,
      city: row.company_city as string | undefined,
      zip: row.company_zip as string | undefined,
      country: row.company_country as string | undefined,
      email: row.company_email as string | undefined,
      phone: row.company_phone as string | undefined,
      vatNumber: row.company_vat_number as string | undefined,
      companyNumber: row.company_company_number as string | undefined,
    };
  }

  return {
    ...user,
    company,
  };
}

export default userQueries;
