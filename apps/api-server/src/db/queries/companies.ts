import type { Company, PaginationParams, FilterParams } from "@crm/types";
import db from "../client";

// ============================================
// Company Queries
// ============================================

export const companyQueries = {
  async findAll(
    pagination: PaginationParams,
    filters: FilterParams
  ): Promise<{ data: Company[]; total: number }> {
    const { page = 1, pageSize = 20 } = pagination;
    const offset = (page - 1) * pageSize;

    let whereClause = "";
    const conditions: string[] = [];

    if (filters.search) {
      conditions.push(`(name ILIKE '%${filters.search}%' OR industry ILIKE '%${filters.search}%')`);
    }

    if (conditions.length > 0) {
      whereClause = `WHERE ${conditions.join(" AND ")}`;
    }

    const countResult = await db.unsafe(`SELECT COUNT(*) FROM companies ${whereClause}`);
    const total = parseInt(countResult[0].count, 10);

    const sortBy = pagination.sortBy || "created_at";
    const sortOrder = pagination.sortOrder || "desc";

    const data = await db.unsafe(
      `SELECT * FROM companies ${whereClause}
       ORDER BY ${sortBy} ${sortOrder}
       LIMIT ${pageSize} OFFSET ${offset}`
    );

    return { data: data.map(mapCompany), total };
  },

  async findById(id: string): Promise<Company | null> {
    const result = await db`SELECT * FROM companies WHERE id = ${id}`;
    return result.length > 0 ? mapCompany(result[0]) : null;
  },

  async findByName(name: string): Promise<Company | null> {
    const result = await db`SELECT * FROM companies WHERE name = ${name}`;
    return result.length > 0 ? mapCompany(result[0]) : null;
  },

  async create(company: Omit<Company, "id" | "createdAt" | "updatedAt">): Promise<Company> {
    const result = await db`
      INSERT INTO companies (name, industry, address)
      VALUES (${company.name}, ${company.industry}, ${company.address})
      RETURNING *
    `;
    return mapCompany(result[0]);
  },

  async createWithId(company: Company): Promise<Company> {
    const result = await db`
      INSERT INTO companies (id, name, industry, address, created_at, updated_at)
      VALUES (
        ${company.id},
        ${company.name},
        ${company.industry},
        ${company.address},
        ${company.createdAt},
        ${company.updatedAt}
      )
      RETURNING *
    `;
    return mapCompany(result[0]);
  },

  async update(id: string, data: Partial<Company>): Promise<Company> {
    const result = await db`
      UPDATE companies SET
        name = COALESCE(${data.name}, name),
        industry = COALESCE(${data.industry}, industry),
        address = COALESCE(${data.address}, address),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    return mapCompany(result[0]);
  },

  async delete(id: string): Promise<void> {
    await db`DELETE FROM companies WHERE id = ${id}`;
  },

  async count(): Promise<number> {
    const result = await db`SELECT COUNT(*) FROM companies`;
    return parseInt(result[0].count, 10);
  },

  async findByIndustry(industry: string): Promise<Company[]> {
    const result = await db`
      SELECT * FROM companies 
      WHERE industry = ${industry}
      ORDER BY name ASC
    `;
    return result.map(mapCompany);
  },

  async getIndustries(): Promise<string[]> {
    const result = await db`
      SELECT DISTINCT industry FROM companies ORDER BY industry ASC
    `;
    return result.map((row) => row.industry as string);
  },
};

// ============================================
// Mapping Function (snake_case -> camelCase)
// ============================================

function mapCompany(row: Record<string, unknown>): Company {
  return {
    id: row.id as string,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
    name: row.name as string,
    industry: row.industry as string,
    address: row.address as string,
  };
}

export default companyQueries;
