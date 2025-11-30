/**
 * Safe Query Builder - zamena za db.unsafe()
 *
 * Ovaj modul pruža sigurne metode za kreiranje dinamičkih SQL upita
 * bez rizika od SQL injection napada.
 */

import { sql as db } from "./client";

// ============================================
// Types
// ============================================

// biome-ignore lint: postgres.js uses any[] for parameters internally
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type QueryParam = any;

export interface QueryCondition {
  sql: string;
  values: QueryParam[];
}

export interface PaginationConfig {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// Dozvoljene kolone za sortiranje po tabelama
const ALLOWED_SORT_COLUMNS: Record<string, string[]> = {
  users: ["created_at", "updated_at", "first_name", "last_name", "email", "role", "status"],
  companies: ["created_at", "updated_at", "name", "industry"],
  leads: ["created_at", "updated_at", "name", "email", "status", "source", "value"],
  contacts: ["created_at", "updated_at", "first_name", "last_name", "email", "company"],
  deals: ["created_at", "updated_at", "title", "value", "stage", "priority", "probability"],
  projects: ["created_at", "updated_at", "name", "status", "start_date", "end_date", "budget"],
  tasks: ["created_at", "updated_at", "title", "status", "priority", "due_date"],
  quotes: ["created_at", "updated_at", "quote_number", "status", "issue_date", "valid_until", "total"],
  invoices: ["created_at", "updated_at", "invoice_number", "status", "issue_date", "due_date", "total"],
  delivery_notes: ["created_at", "updated_at", "delivery_number", "status", "ship_date", "delivery_date"],
  milestones: ["created_at", "updated_at", "name", "status", "due_date"],
  products: ["created_at", "updated_at", "name", "sku", "price", "stock_quantity"],
  product_categories: ["created_at", "updated_at", "name", "sort_order"],
  notifications: ["created_at", "type", "is_read"],
  payments: ["created_at", "updated_at", "payment_date", "amount", "status"],
};

// ============================================
// Safe Query Builder Class
// ============================================

export class SafeQueryBuilder {
  private table: string;
  private conditions: QueryCondition[] = [];
  private paramIndex = 1;

  constructor(table: string) {
    this.table = table;
  }

  /**
   * Dodaje ILIKE uslov za pretragu
   */
  addSearchCondition(columns: string[], searchTerm: string | undefined): this {
    if (!searchTerm || searchTerm.trim() === "") return this;

    const sanitizedSearch = `%${searchTerm.trim()}%`;
    const conditions = columns.map((col) => `${col} ILIKE $${this.paramIndex}`).join(" OR ");

    this.conditions.push({
      sql: `(${conditions})`,
      values: Array(columns.length).fill(sanitizedSearch),
    });

    this.paramIndex += columns.length;
    return this;
  }

  /**
   * Dodaje tačan match uslov
   */
  addEqualCondition(column: string, value: unknown | undefined): this {
    if (value === undefined || value === null || value === "") return this;

    this.conditions.push({
      sql: `${column} = $${this.paramIndex}`,
      values: [value],
    });

    this.paramIndex++;
    return this;
  }

  /**
   * Dodaje UUID uslov (sa validacijom)
   */
  addUuidCondition(column: string, value: string | undefined): this {
    if (!value || value.trim() === "") return this;

    // Validiraj UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) return this;

    return this.addEqualCondition(column, value);
  }

  /**
   * Dodaje boolean uslov
   */
  addBooleanCondition(column: string, value: boolean | undefined): this {
    if (value === undefined) return this;

    this.conditions.push({
      sql: `${column} = $${this.paramIndex}`,
      values: [value],
    });

    this.paramIndex++;
    return this;
  }

  /**
   * Dodaje range uslov (za datume ili brojeve)
   */
  addRangeCondition(
    column: string,
    min: number | string | undefined,
    max: number | string | undefined
  ): this {
    if (min !== undefined && min !== null && min !== "") {
      this.conditions.push({
        sql: `${column} >= $${this.paramIndex}`,
        values: [min],
      });
      this.paramIndex++;
    }

    if (max !== undefined && max !== null && max !== "") {
      this.conditions.push({
        sql: `${column} <= $${this.paramIndex}`,
        values: [max],
      });
      this.paramIndex++;
    }

    return this;
  }

  /**
   * Dodaje IN uslov
   */
  addInCondition(column: string, values: unknown[] | undefined): this {
    if (!values || values.length === 0) return this;

    const placeholders = values.map((_, i) => `$${this.paramIndex + i}`).join(", ");

    this.conditions.push({
      sql: `${column} IN (${placeholders})`,
      values: values,
    });

    this.paramIndex += values.length;
    return this;
  }

  /**
   * Gradi WHERE klauzulu
   */
  buildWhereClause(): { clause: string; values: QueryParam[] } {
    if (this.conditions.length === 0) {
      return { clause: "", values: [] };
    }

    const clause = "WHERE " + this.conditions.map((c) => c.sql).join(" AND ");
    const values = this.conditions.flatMap((c) => c.values);

    return { clause, values };
  }

  /**
   * Validira i vraća sigurnu ORDER BY klauzulu
   */
  buildOrderClause(sortBy?: string, sortOrder?: "asc" | "desc"): string {
    const allowedColumns = ALLOWED_SORT_COLUMNS[this.table] || ["created_at"];
    const defaultColumn = "created_at";

    // Validiraj sortBy kolonu
    const safeColumn = sortBy && allowedColumns.includes(sortBy) ? sortBy : defaultColumn;

    // Validiraj sortOrder
    const safeOrder = sortOrder === "asc" ? "ASC" : "DESC";

    return `ORDER BY ${safeColumn} ${safeOrder}`;
  }

  /**
   * Gradi LIMIT/OFFSET klauzulu
   */
  buildPaginationClause(page: number, pageSize: number): { clause: string; values: [number, number] } {
    // Sanitizuj vrednosti
    const safePage = Math.max(1, Math.floor(page));
    const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
    const offset = (safePage - 1) * safePageSize;

    return {
      clause: `LIMIT $${this.paramIndex} OFFSET $${this.paramIndex + 1}`,
      values: [safePageSize, offset],
    };
  }

  /**
   * Resetuje builder za ponovnu upotrebu
   */
  reset(): this {
    this.conditions = [];
    this.paramIndex = 1;
    return this;
  }
}

// ============================================
// Helper funkcije za izvršavanje upita
// ============================================

/**
 * Izvršava SELECT COUNT(*) upit sa parametrizovanim uslovima
 */
export async function executeCount(
  table: string,
  whereClause: string,
  values: unknown[]
): Promise<number> {
  const query = `SELECT COUNT(*) FROM ${table} ${whereClause}`;
  const result = await executeRawQuery(query, values);
  return parseInt(String(result[0]?.count ?? 0), 10);
}

/**
 * Izvršava SELECT upit sa JOIN-ovima
 */
export async function executeSelect<T>(
  selectClause: string,
  fromClause: string,
  whereClause: string,
  orderClause: string,
  paginationClause: string,
  values: unknown[]
): Promise<T[]> {
  const query = `${selectClause} ${fromClause} ${whereClause} ${orderClause} ${paginationClause}`;
  return executeRawQuery(query, values) as Promise<T[]>;
}

/**
 * Interno: Izvršava raw upit sa parametrima
 * NAPOMENA: Ovo je jedino mesto gde se koristi dinamički SQL
 */
async function executeRawQuery(query: string, values: unknown[]): Promise<Record<string, unknown>[]> {
  // Zameni $1, $2, ... sa tagged template literal sintaksom
  // postgres.js očekuje tagged template literals, ali možemo koristiti i .unsafe sa nizom vrednosti

  if (values.length === 0) {
    return db.unsafe(query);
  }

  // Koristimo prepared statement pristup
  // postgres.js podržava pozicione parametre kada se koristi sa nizom
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db.unsafe(query, [...values] as any);
}

// ============================================
// Factory funkcija
// ============================================

export function createQueryBuilder(table: string): SafeQueryBuilder {
  return new SafeQueryBuilder(table);
}

// ============================================
// Tipske pomoćne funkcije
// ============================================

/**
 * Escapuje string za LIKE pattern (ne za SQL injection, samo za wildcard karaktere)
 */
export function escapeLikePattern(str: string): string {
  return str.replace(/[%_\\]/g, "\\$&");
}

/**
 * Validira UUID string
 */
export function isValidUuid(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Sanitizuje sortBy kolonu protiv dozvoljene liste
 */
export function sanitizeSortColumn(table: string, column: string | undefined): string {
  const allowedColumns = ALLOWED_SORT_COLUMNS[table] || ["created_at"];
  return column && allowedColumns.includes(column) ? column : "created_at";
}

/**
 * Sanitizuje sortOrder
 */
export function sanitizeSortOrder(order: string | undefined): "ASC" | "DESC" {
  return order?.toLowerCase() === "asc" ? "ASC" : "DESC";
}

