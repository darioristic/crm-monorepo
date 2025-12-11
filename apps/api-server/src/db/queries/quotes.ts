import type {
  FilterParams,
  PaginationParams,
  Quote,
  QuoteItem,
  QuoteStatus,
  QuoteWithRelations,
} from "@crm/types";
import { logger } from "../../lib/logger";
import { sql as db } from "../client";
import {
  createQueryBuilder,
  type QueryParam,
  sanitizeSortColumn,
  sanitizeSortOrder,
} from "../query-builder";

// ============================================
// Quote Queries
// ============================================

export const quoteQueries = {
  async findAll(
    companyId: string | null,
    pagination: PaginationParams,
    filters: FilterParams
  ): Promise<{ data: Quote[]; total: number }> {
    try {
      const { page = 1, pageSize = 20 } = pagination;

      const safePage = Math.max(1, Math.floor(page));
      const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
      const safeOffset = (safePage - 1) * safePageSize;

      // Koristi query builder za sigurne upite
      const qb = createQueryBuilder("quotes");
      // Filter by tenant_id (quotes created by this tenant)
      // Note: companyId parameter actually represents tenant ID in multi-tenant architecture
      logger.info(
        { companyId, pagination, filters },
        "[QUOTES DEBUG] findAll called with companyId"
      );
      if (companyId) {
        // Filter by tenant_id to show quotes created by the tenant
        qb.addEqualCondition("tenant_id", companyId);
        logger.info({ companyId }, "[QUOTES DEBUG] Adding tenant_id filter");
      } else {
        logger.warn(
          "[QUOTES DEBUG] No companyId provided - will return ALL quotes (no tenant filter)"
        );
      }
      qb.addSearchCondition(["quote_number"], filters.search);
      qb.addEqualCondition("status", filters.status);
      const createdBy = (filters as { createdBy?: string }).createdBy;
      if (createdBy) {
        qb.addEqualCondition("created_by", createdBy);
      }

      const { clause: whereClause, values: whereValues } = qb.buildWhereClause();

      const countQuery = `SELECT COUNT(*) FROM quotes ${whereClause}`;
      const countResult = await db.unsafe(countQuery, whereValues as QueryParam[]);
      const total = parseInt((countResult[0]?.count as string) || "0", 10);

      const sortBy = sanitizeSortColumn("quotes", pagination.sortBy);
      const sortOrder = sanitizeSortOrder(pagination.sortOrder);

      // Select query with error handling
      let data: Record<string, unknown>[] = [];
      try {
        const selectQuery = `
          SELECT * FROM quotes
          ${whereClause}
          ORDER BY ${sortBy} ${sortOrder}
          LIMIT $${whereValues.length + 1} OFFSET $${whereValues.length + 2}
        `;
        data = await db.unsafe(selectQuery, [
          ...whereValues,
          safePageSize,
          safeOffset,
        ] as QueryParam[]);
      } catch (selectError) {
        logger.error({ error: selectError }, "Error selecting quotes");
        logger.error({ companyId }, "CompanyId");
        logger.error({ pagination }, "Pagination");
        logger.error({ filters }, "Filters");
        logger.error({ whereValues }, "WhereValues");
        logger.error({ safePageSize, safeOffset }, "Pagination limits");
        data = [];
      }

      // Fetch all items for all quotes in a single query (fixes N+1 problem)
      if (data.length === 0) {
        return { data: [], total };
      }

      const quoteIds = data.map((row: Record<string, unknown>) => row.id as string);

      if (quoteIds.length === 0) {
        return {
          data: data.map((row: Record<string, unknown>) => mapQuote(row, [])),
          total,
        };
      }

      // Fetch all items for all quotes in a single query (fixes N+1 problem)
      const allItems = await db`
        SELECT * FROM quote_items
        WHERE quote_id = ANY(${quoteIds})
        ORDER BY quote_id
      `;

      // Group items by quote_id
      const itemsByQuoteId = (allItems as Record<string, unknown>[]).reduce(
        (acc: Record<string, Record<string, unknown>[]>, item) => {
          const key = item.quote_id as string;
          if (!acc[key]) {
            acc[key] = [];
          }
          acc[key].push(item);
          return acc;
        },
        {}
      );

      // Map quotes with their items
      const quotesWithItems = data.map((row: Record<string, unknown>) => {
        const items = itemsByQuoteId[row.id as string] || [];
        return mapQuote(row, items);
      });

      return { data: quotesWithItems, total };
    } catch (error) {
      logger.error({ error }, "Error in quoteQueries.findAll");
      throw error;
    }
  },

  async findById(id: string): Promise<QuoteWithRelations | null> {
    const result = await db`
	      SELECT q.*,
	        c.id as company_id_join,
	        c.name as company_name,
	        c.industry as company_industry,
	        c.address as company_address,
	        c.email as company_email,
	        c.billing_email as company_billing_email,
	        c.phone as company_phone,
	        c.city as company_city,
	        c.zip as company_zip,
	        c.country as company_country,
	        c.vat_number as company_vat_number,
	        c.company_number as company_company_number,
	        c.registration_number as company_registration_number,
	        c.website as company_website,
	        c.logo_url as company_logo_url,
	        c.address_line1 as company_address_line1,
	        c.postal_code as company_postal_code,
	        ct.id as contact_id_join,
	        ct.first_name as contact_first_name,
	        ct.last_name as contact_last_name,
	        ct.email as contact_email
	      FROM quotes q
	      LEFT JOIN companies c ON q.company_id = c.id
	      LEFT JOIN contacts ct ON q.contact_id = ct.id
	      WHERE q.id = ${id}
	    `;

    if (result.length === 0) return null;

    const items = await db`
      SELECT * FROM quote_items WHERE quote_id = ${id}
    `;

    return mapQuoteWithRelations(result[0], items);
  },

  async findByNumber(quoteNumber: string): Promise<Quote | null> {
    const result = await db`
      SELECT * FROM quotes WHERE quote_number = ${quoteNumber}
    `;
    if (result.length === 0) return null;

    const items = await db`
      SELECT * FROM quote_items WHERE quote_id = ${result[0].id}
    `;

    return mapQuote(result[0], items);
  },

  async findByNumberWithRelations(quoteNumber: string): Promise<QuoteWithRelations | null> {
    const result = await db`
	      SELECT q.*,
	        c.id as company_id_join,
	        c.name as company_name,
	        c.industry as company_industry,
	        c.address as company_address,
	        c.email as company_email,
	        c.phone as company_phone,
	        c.city as company_city,
	        c.zip as company_zip,
	        c.country as company_country,
	        c.vat_number as company_vat_number,
	        c.website as company_website,
	        c.logo_url as company_logo_url,
	        ct.id as contact_id_join,
	        ct.first_name as contact_first_name,
	        ct.last_name as contact_last_name,
	        ct.email as contact_email
	      FROM quotes q
	      LEFT JOIN companies c ON q.company_id = c.id
	      LEFT JOIN contacts ct ON q.contact_id = ct.id
	      WHERE q.quote_number = ${quoteNumber}
	    `;

    if (result.length === 0) return null;

    const items = await db`
      SELECT * FROM quote_items WHERE quote_id = ${result[0].id}
    `;

    return mapQuoteWithRelations(result[0], items);
  },

  async create(
    quote: Omit<Quote, "items">,
    items: Omit<QuoteItem, "id" | "quoteId">[]
  ): Promise<Quote> {
    // Note: quote.sellerCompanyId from service actually contains tenant_id
    const result = await db`
      INSERT INTO quotes (
        id, quote_number, company_id, contact_id, status, issue_date, valid_until,
        subtotal, tax_rate, tax, total, notes, terms, from_details, created_by, tenant_id, created_at, updated_at
      ) VALUES (
        ${quote.id}, ${quote.quoteNumber}, ${quote.companyId}, ${quote.contactId || null},
        ${quote.status}, ${quote.issueDate}, ${quote.validUntil},
        ${quote.subtotal}, ${quote.taxRate}, ${quote.tax}, ${quote.total},
        ${quote.notes || null}, ${quote.terms || null}, ${quote.fromDetails ? JSON.stringify(quote.fromDetails) : null}, ${quote.createdBy},
        ${(quote as { sellerCompanyId?: string }).sellerCompanyId || null}, ${quote.createdAt}, ${quote.updatedAt}
      )
      RETURNING *
    `;

    // Insert items
    const insertedItems: QuoteItem[] = [];
    for (const item of items) {
      const itemResult = await db`
        INSERT INTO quote_items (quote_id, product_name, description, quantity, unit_price, discount, total)
        VALUES (${quote.id}, ${item.productName}, ${item.description || null}, ${item.quantity}, ${item.unitPrice}, ${item.discount}, ${item.total})
        RETURNING *
      `;
      insertedItems.push(mapQuoteItem(itemResult[0]));
    }

    return mapQuote(
      result[0],
      insertedItems.map((i) => ({ ...i }))
    );
  },

  async update(
    id: string,
    data: Partial<Quote>,
    items?: Omit<QuoteItem, "quoteId">[]
  ): Promise<Quote> {
    const result = await db`
      UPDATE quotes SET
        company_id = COALESCE(${data.companyId ?? null}, company_id),
        contact_id = COALESCE(${data.contactId ?? null}, contact_id),
        status = COALESCE(${data.status ?? null}, status),
        valid_until = COALESCE(${data.validUntil ?? null}, valid_until),
        subtotal = COALESCE(${data.subtotal ?? null}, subtotal),
        tax_rate = COALESCE(${data.taxRate ?? null}, tax_rate),
        tax = COALESCE(${data.tax ?? null}, tax),
        total = COALESCE(${data.total ?? null}, total),
        notes = COALESCE(${data.notes ?? null}, notes),
        terms = COALESCE(${data.terms ?? null}, terms),
        from_details = COALESCE(${data.fromDetails ? JSON.stringify(data.fromDetails) : null}, from_details),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    // Update items if provided
    if (items) {
      await db`DELETE FROM quote_items WHERE quote_id = ${id}`;
      for (const item of items) {
        await db`
          INSERT INTO quote_items (id, quote_id, product_name, description, quantity, unit_price, discount, total)
          VALUES (${item.id || db`gen_random_uuid()`}, ${id}, ${item.productName}, ${item.description || null}, ${item.quantity}, ${item.unitPrice}, ${item.discount}, ${item.total})
        `;
      }
    }

    const updatedItems = await db`SELECT * FROM quote_items WHERE quote_id = ${id}`;
    return mapQuote(result[0], updatedItems);
  },

  async delete(id: string): Promise<void> {
    await db`DELETE FROM quotes WHERE id = ${id}`;
  },

  async count(): Promise<number> {
    const result = await db`SELECT COUNT(*) FROM quotes`;
    return parseInt(result[0].count as string, 10);
  },

  async generateNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const result = await db`
      SELECT COUNT(*) FROM quotes WHERE EXTRACT(YEAR FROM created_at) = ${year}
    `;
    const count = parseInt(result[0].count as string, 10) + 1;

    // Try a few attempts with random suffix to avoid unique collisions across tenants
    for (let attempt = 0; attempt < 5; attempt++) {
      const suffix = Math.floor(1000 + Math.random() * 9000); // 4-digit
      const candidate = `QUO-${year}-${String(count).padStart(5, "0")}-${suffix}`;
      const exists = await db`
        SELECT 1 FROM quotes WHERE quote_number = ${candidate} LIMIT 1
      `;
      if (exists.length === 0) return candidate;
    }

    // Fallback with timestamp tail to guarantee uniqueness
    const tsTail = String(Date.now()).slice(-6);
    return `QUO-${year}-${String(count).padStart(5, "0")}-${tsTail}`;
  },

  async findByCompany(companyId: string): Promise<Quote[]> {
    const result = await db`
      SELECT * FROM quotes WHERE company_id = ${companyId} ORDER BY created_at DESC
    `;
    return Promise.all(
      result.map(async (row) => {
        const items = await db`SELECT * FROM quote_items WHERE quote_id = ${row.id}`;
        return mapQuote(row, items);
      })
    );
  },

  async findByStatus(status: QuoteStatus): Promise<Quote[]> {
    const result = await db`
      SELECT * FROM quotes WHERE status = ${status} ORDER BY created_at DESC
    `;
    return Promise.all(
      result.map(async (row) => {
        const items = await db`SELECT * FROM quote_items WHERE quote_id = ${row.id}`;
        return mapQuote(row, items);
      })
    );
  },
};

// ============================================
// Helper for date conversion
// ============================================

function toISOString(value: unknown): string {
  if (value === null || value === undefined) {
    return new Date().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    // Try to parse as date first
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
    return value;
  }
  return String(value);
}

// ============================================
// Mapping Functions
// ============================================

function mapQuoteItem(row: Record<string, unknown>): QuoteItem {
  return {
    id: row.id as string,
    quoteId: row.quote_id as string,
    productName: row.product_name as string,
    description: row.description as string | undefined,
    quantity: parseFloat(String(row.quantity || 0)),
    unitPrice: parseFloat(String(row.unit_price || 0)),
    discount: parseFloat(String(row.discount || 0)),
    total: parseFloat(String(row.total || 0)),
  };
}

function mapQuote(row: Record<string, unknown>, items: unknown[]): Quote {
  let fromDetails = null;
  if (row.from_details) {
    try {
      fromDetails =
        typeof row.from_details === "string"
          ? JSON.parse(row.from_details as string)
          : row.from_details;
    } catch {
      fromDetails = null;
    }
  }
  return {
    id: row.id as string,
    createdAt: toISOString(row.created_at),
    updatedAt: toISOString(row.updated_at),
    quoteNumber: row.quote_number as string,
    companyId: row.company_id as string,
    contactId: row.contact_id as string | undefined,
    status: row.status as QuoteStatus,
    issueDate: toISOString(row.issue_date),
    validUntil: toISOString(row.valid_until),
    items: (items as Record<string, unknown>[]).map(mapQuoteItem),
    subtotal: parseFloat(String(row.subtotal || 0)),
    taxRate: parseFloat(String(row.tax_rate || 0)),
    tax: parseFloat(String(row.tax || 0)),
    total: parseFloat(String(row.total || 0)),
    notes: row.notes as string | undefined,
    terms: row.terms as string | undefined,
    fromDetails,
    createdBy: row.created_by as string,
  };
}

function mapQuoteWithRelations(row: Record<string, unknown>, items: unknown[]): QuoteWithRelations {
  const quote = mapQuote(row, items);
  return {
    ...quote,
    company: row.company_id_join
      ? {
          id: row.company_id_join as string,
          createdAt: "",
          updatedAt: "",
          name: row.company_name as string,
          industry: row.company_industry as string,
          address: row.company_address as string,
          addressLine1: (row.company_address_line1 as string) || undefined,
          email: (row.company_email as string) || undefined,
          billingEmail: (row.company_billing_email as string) || undefined,
          phone: (row.company_phone as string) || undefined,
          city: (row.company_city as string) || undefined,
          zip: (row.company_zip as string) || undefined,
          postalCode: (row.company_postal_code as string) || undefined,
          country: (row.company_country as string) || undefined,
          vatNumber: (row.company_vat_number as string) || undefined,
          companyNumber: (row.company_company_number as string) || undefined,
          registrationNumber: (row.company_registration_number as string) || undefined,
          website: (row.company_website as string) || undefined,
          logoUrl: (row.company_logo_url as string) || undefined,
        }
      : undefined,
    contact: row.contact_id_join
      ? {
          id: row.contact_id_join as string,
          createdAt: "",
          updatedAt: "",
          firstName: row.contact_first_name as string,
          lastName: row.contact_last_name as string,
          email: row.contact_email as string,
        }
      : undefined,
  };
}

export default quoteQueries;
