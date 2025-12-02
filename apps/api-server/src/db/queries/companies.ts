import type { Company, PaginationParams, FilterParams } from "@crm/types";
import { sql as db } from "../client";
import {
	createQueryBuilder,
	sanitizeSortColumn,
	sanitizeSortOrder,
	type QueryParam,
} from "../query-builder";

// ============================================
// Company Queries
// ============================================

export const companyQueries = {
	async findAll(
		pagination: PaginationParams,
		filters: FilterParams,
	): Promise<{ data: Company[]; total: number }> {
		const { page = 1, pageSize = 20 } = pagination;

		// Sanitizuj paginaciju
		const safePage = Math.max(1, Math.floor(page));
		const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
		const safeOffset = (safePage - 1) * safePageSize;

		// Gradi uslove sa query builder-om
		const qb = createQueryBuilder("companies");
		qb.addSearchCondition(
			["name", "industry", "city", "country"],
			filters.search,
		);

		const { clause: whereClause, values: whereValues } = qb.buildWhereClause();

		// Izvršavaj count
		const countQuery = `SELECT COUNT(*) FROM companies ${whereClause}`;
		const countResult = await db.unsafe(
			countQuery,
			whereValues as QueryParam[],
		);
		const total = parseInt(countResult[0].count, 10);

		// Sanitizuj sortiranje
		const sortBy = sanitizeSortColumn("companies", pagination.sortBy);
		const sortOrder = sanitizeSortOrder(pagination.sortOrder);

		// Izvršavaj select - dodaj pagination parametre na kraj
		const selectQuery = `
      SELECT * FROM companies 
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${whereValues.length + 1} OFFSET $${whereValues.length + 2}
    `;

		const data = await db.unsafe(selectQuery, [
			...whereValues,
			safePageSize,
			safeOffset,
		] as QueryParam[]);

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

	async create(
		company: Omit<Company, "id" | "createdAt" | "updatedAt">,
	): Promise<Company> {
		const result = await db`
      INSERT INTO companies (
        name, industry, address,
        email, phone, website, contact,
        city, zip, country, country_code,
        vat_number, company_number, logo_url, note
      )
      VALUES (
        ${company.name}, 
        ${company.industry}, 
        ${company.address},
        ${company.email ?? null},
        ${company.phone ?? null},
        ${company.website ?? null},
        ${company.contact ?? null},
        ${company.city ?? null},
        ${company.zip ?? null},
        ${company.country ?? null},
        ${company.countryCode ?? null},
        ${company.vatNumber ?? null},
        ${company.companyNumber ?? null},
        ${(company as any).logoUrl ?? null},
        ${company.note ?? null}
      )
      RETURNING *
    `;
		return mapCompany(result[0]);
	},

	async createWithId(company: Company): Promise<Company> {
		const result = await db`
      INSERT INTO companies (
        id, name, industry, address,
        email, phone, website, contact,
        city, zip, country, country_code,
        vat_number, company_number, logo_url, note,
        created_at, updated_at
      )
      VALUES (
        ${company.id},
        ${company.name},
        ${company.industry},
        ${company.address},
        ${company.email ?? null},
        ${company.phone ?? null},
        ${company.website ?? null},
        ${company.contact ?? null},
        ${company.city ?? null},
        ${company.zip ?? null},
        ${company.country ?? null},
        ${company.countryCode ?? null},
        ${company.vatNumber ?? null},
        ${company.companyNumber ?? null},
        ${(company as any).logoUrl ?? null},
        ${company.note ?? null},
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
        name = COALESCE(${data.name ?? null}, name),
        industry = COALESCE(${data.industry ?? null}, industry),
        address = COALESCE(${data.address ?? null}, address),
        email = COALESCE(${data.email ?? null}, email),
        phone = COALESCE(${data.phone ?? null}, phone),
        website = COALESCE(${data.website ?? null}, website),
        contact = COALESCE(${data.contact ?? null}, contact),
        city = COALESCE(${data.city ?? null}, city),
        zip = COALESCE(${data.zip ?? null}, zip),
        country = COALESCE(${data.country ?? null}, country),
        country_code = COALESCE(${data.countryCode ?? null}, country_code),
        vat_number = COALESCE(${data.vatNumber ?? null}, vat_number),
        company_number = COALESCE(${data.companyNumber ?? null}, company_number),
        logo_url = COALESCE(${(data as any).logoUrl ?? null}, logo_url),
        note = COALESCE(${data.note ?? null}, note),
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

	async findByCountry(country: string): Promise<Company[]> {
		const result = await db`
      SELECT * FROM companies 
      WHERE country = ${country}
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

	async getCountries(): Promise<string[]> {
		const result = await db`
      SELECT DISTINCT country FROM companies WHERE country IS NOT NULL ORDER BY country ASC
    `;
		return result.map((row) => row.country as string);
	},

	async nameExists(name: string, excludeId?: string): Promise<boolean> {
		if (excludeId) {
			const result = await db`
        SELECT COUNT(*) FROM companies WHERE name = ${name} AND id != ${excludeId}
      `;
			return parseInt(result[0].count, 10) > 0;
		}
		const result = await db`
      SELECT COUNT(*) FROM companies WHERE name = ${name}
    `;
		return parseInt(result[0].count, 10) > 0;
	},
};

// ============================================
// Helper for date conversion
// ============================================

function toISOString(value: unknown): string {
	if (value instanceof Date) return value.toISOString();
	if (typeof value === "string") return value;
	return String(value);
}

// ============================================
// Mapping Function (snake_case -> camelCase)
// ============================================

function mapCompany(row: Record<string, unknown>): Company {
	return {
		id: row.id as string,
		createdAt: toISOString(row.created_at),
		updatedAt: toISOString(row.updated_at),
		name: row.name as string,
		industry: row.industry as string,
		address: row.address as string,
		email: row.email as string | null,
		phone: row.phone as string | null,
		website: row.website as string | null,
		contact: row.contact as string | null,
		city: row.city as string | null,
		zip: row.zip as string | null,
		country: row.country as string | null,
		countryCode: row.country_code as string | null,
		vatNumber: row.vat_number as string | null,
		companyNumber: row.company_number as string | null,
		logoUrl: row.logo_url as string | null,
		note: row.note as string | null,
	} as Company;
}

export default companyQueries;
