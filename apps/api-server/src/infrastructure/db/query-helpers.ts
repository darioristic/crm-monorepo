import { eq, and, SQL } from "drizzle-orm";
import {
	companies,
	documents,
	contacts,
	activities,
} from "../../db/schema/index";

/**
 * Enforce tenant scope on a query
 * Adds WHERE clause to filter by tenantId
 */
export function enforceTenantScope(
  tableName: "companies" | "documents" | "contacts" | "activities",
  tenantId: string,
): SQL {
  switch (tableName) {
    case "companies":
      return eq(companies.tenantId, tenantId);
    case "documents":
      return eq(documents.tenantId, tenantId);
    case "contacts":
      return eq(contacts.tenantId, tenantId);
    case "activities":
      return eq(activities.tenantId, tenantId);
    default:
      throw new Error(`Table ${tableName} does not support tenant isolation`);
  }
}

/**
 * Enforce company scope on a query
 * Adds WHERE clause to filter by tenantId AND companyId
 */
export function enforceCompanyScope(
  tableName: "documents" | "contacts" | "activities",
  tenantId: string,
  companyId: string,
): SQL {
  switch (tableName) {
    case "documents":
      return and(eq(documents.tenantId, tenantId), eq(documents.companyId, companyId)) as SQL;
    case "contacts":
      return and(eq(contacts.tenantId, tenantId), eq(contacts.companyId, companyId)) as SQL;
    case "activities":
      return and(eq(activities.tenantId, tenantId), eq(activities.companyId, companyId)) as SQL;
    default:
      throw new Error(`Table ${tableName} does not support company isolation`);
  }
}

/**
 * Wrap a query with tenant isolation
 * Automatically filters results by tenantId
 */
export function withTenantIsolation<T>(
  queryBuilder: (where: SQL) => Promise<T>,
  tenantId: string,
  tableName: "companies" | "documents" | "contacts" | "activities",
): Promise<T> {
  const whereClause = enforceTenantScope(tableName, tenantId);
  return queryBuilder(whereClause);
}

/**
 * Wrap a query with company isolation
 * Automatically filters results by tenantId AND companyId
 */
export function withCompanyIsolation<T>(
  queryBuilder: (where: SQL) => Promise<T>,
  tenantId: string,
  companyId: string,
  tableName: "documents" | "contacts" | "activities",
): Promise<T> {
  const whereClause = enforceCompanyScope(tableName, tenantId, companyId);
  return queryBuilder(whereClause);
}

/**
 * Helper to build tenant-scoped queries for companies
 */
export function buildTenantScopedCompanyQuery(tenantId: string) {
	return eq(companies.tenantId, tenantId);
}

/**
 * Helper to build company-scoped queries for documents
 */
export function buildCompanyScopedDocumentQuery(
	tenantId: string,
	companyId: string,
) {
	return and(
		eq(documents.tenantId, tenantId),
		eq(documents.companyId, companyId),
	);
}

/**
 * Helper to build company-scoped queries for contacts
 */
export function buildCompanyScopedContactQuery(
	tenantId: string,
	companyId: string,
) {
	return and(
		eq(contacts.tenantId, tenantId),
		eq(contacts.companyId, companyId),
	);
}

/**
 * Helper to build company-scoped queries for activities
 */
export function buildCompanyScopedActivityQuery(
	tenantId: string,
	companyId: string,
) {
	return and(
		eq(activities.tenantId, tenantId),
		eq(activities.companyId, companyId),
	);
}
