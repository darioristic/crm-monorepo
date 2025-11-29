import type {
  User,
  UserWithCompany,
  Company,
  UserRole,
  PaginationParams,
  FilterParams,
} from "@crm/types";
import db from "../client";

// ============================================
// User Queries
// ============================================

export const userQueries = {
  async findAll(
    pagination: PaginationParams,
    filters: FilterParams
  ): Promise<{ data: UserWithCompany[]; total: number }> {
    const { page = 1, pageSize = 20 } = pagination;
    const offset = (page - 1) * pageSize;

    let whereClause = "";
    const conditions: string[] = [];

    if (filters.search) {
      conditions.push(
        `(u.first_name ILIKE '%${filters.search}%' OR u.last_name ILIKE '%${filters.search}%' OR u.email ILIKE '%${filters.search}%')`
      );
    }

    if (filters.status) {
      conditions.push(`u.role = '${filters.status}'`);
    }

    if (conditions.length > 0) {
      whereClause = `WHERE ${conditions.join(" AND ")}`;
    }

    const countResult = await db.unsafe(`SELECT COUNT(*) FROM users u ${whereClause}`);
    const total = parseInt(countResult[0].count, 10);

    const sortBy = pagination.sortBy || "u.created_at";
    const sortOrder = pagination.sortOrder || "desc";

    const data = await db.unsafe(
      `SELECT 
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
       LIMIT ${pageSize} OFFSET ${offset}`
    );

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
        first_name = COALESCE(${data.firstName}, first_name),
        last_name = COALESCE(${data.lastName}, last_name),
        email = COALESCE(${data.email}, email),
        role = COALESCE(${data.role}, role),
        company_id = COALESCE(${data.companyId}, company_id),
        status = COALESCE(${data.status}, status),
        avatar_url = COALESCE(${data.avatarUrl}, avatar_url),
        phone = COALESCE(${data.phone}, phone),
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

function mapUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    email: row.email as string,
    role: row.role as UserRole,
    companyId: row.company_id as string | undefined,
    status: row.status as User["status"],
    avatarUrl: row.avatar_url as string | undefined,
    phone: row.phone as string | undefined,
    lastLoginAt: row.last_login_at ? (row.last_login_at as Date).toISOString() : undefined,
  };
}

function mapUserWithCompany(row: Record<string, unknown>): UserWithCompany {
  const user = mapUser(row);

  let company: Company | undefined;
  if (row.company_id_join) {
    company = {
      id: row.company_id_join as string,
      createdAt: (row.company_created_at as Date).toISOString(),
      updatedAt: (row.company_updated_at as Date).toISOString(),
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
