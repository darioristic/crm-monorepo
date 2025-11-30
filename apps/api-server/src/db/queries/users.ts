import type {
  User,
  UserWithCompany,
  Company,
  UserRole,
  PaginationParams,
  FilterParams,
} from "@crm/types";
import { sql as db } from "../client";
import {
  createQueryBuilder,
  sanitizeSortColumn,
  sanitizeSortOrder,
  type QueryParam,
} from "../query-builder";

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
    const countResult = await db.unsafe(countQuery, whereValues as QueryParam[]);
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
        c.created_at as company_created_at,
        c.updated_at as company_updated_at
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${whereValues.length + 1} OFFSET $${whereValues.length + 2}
    `;

    const data = await db.unsafe(selectQuery, [...whereValues, safePageSize, safeOffset] as QueryParam[]);

    return { data: data.map(mapUserWithCompany), total };
  },

  async findById(id: string): Promise<UserWithCompany | null> {
    const result = await db`
      SELECT 
        u.*,
        c.id as company_id_join,
        c.name as company_name,
        c.industry as company_industry,
        c.address as company_address,
        c.created_at as company_created_at,
        c.updated_at as company_updated_at
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.id = ${id}
    `;
    return result.length > 0 ? mapUserWithCompany(result[0]) : null;
  },

  async findByEmail(email: string): Promise<UserWithCompany | null> {
    const result = await db`
      SELECT 
        u.*,
        c.id as company_id_join,
        c.name as company_name,
        c.industry as company_industry,
        c.address as company_address,
        c.created_at as company_created_at,
        c.updated_at as company_updated_at
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.email = ${email}
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

  async update(id: string, data: Partial<User>): Promise<User> {
    const result = await db`
      UPDATE users SET
        first_name = COALESCE(${data.firstName ?? null}, first_name),
        last_name = COALESCE(${data.lastName ?? null}, last_name),
        email = COALESCE(${data.email ?? null}, email),
        role = COALESCE(${data.role ?? null}, role),
        company_id = COALESCE(${data.companyId ?? null}, company_id),
        status = COALESCE(${data.status ?? null}, status),
        avatar_url = COALESCE(${data.avatarUrl ?? null}, avatar_url),
        phone = COALESCE(${data.phone ?? null}, phone),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
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
        SELECT COUNT(*) FROM users WHERE email = ${email} AND id != ${excludeId}
      `;
      return parseInt(result[0].count, 10) > 0;
    }
    const result = await db`
      SELECT COUNT(*) FROM users WHERE email = ${email}
    `;
    return parseInt(result[0].count, 10) > 0;
  },
};

// ============================================
// Mapping Functions (snake_case -> camelCase)
// ============================================

function toISOString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return new Date(value).toISOString();
  return new Date().toISOString();
}

function mapUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    createdAt: toISOString(row.created_at),
    updatedAt: toISOString(row.updated_at),
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    email: row.email as string,
    role: row.role as UserRole,
    companyId: row.company_id as string | undefined,
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
    };
  }

  return {
    ...user,
    company,
  };
}

export default userQueries;
