import type {
  Quote,
  QuoteItem,
  QuoteWithRelations,
  PaginationParams,
  FilterParams,
  QuoteStatus,
} from "@crm/types";
import db from "../client";

// ============================================
// Quote Queries
// ============================================

export const quoteQueries = {
  async findAll(
    pagination: PaginationParams,
    filters: FilterParams
  ): Promise<{ data: Quote[]; total: number }> {
    const { page = 1, pageSize = 20 } = pagination;
    const offset = (page - 1) * pageSize;

    let whereClause = "";
    const conditions: string[] = [];

    if (filters.search) {
      conditions.push(
        `(quote_number ILIKE '%${filters.search}%')`
      );
    }
    if (filters.status) {
      conditions.push(`status = '${filters.status}'`);
    }

    if (conditions.length > 0) {
      whereClause = `WHERE ${conditions.join(" AND ")}`;
    }

    const countResult = await db.unsafe(
      `SELECT COUNT(*) FROM quotes ${whereClause}`
    );
    const total = parseInt(countResult[0].count, 10);

    const sortBy = pagination.sortBy || "created_at";
    const sortOrder = pagination.sortOrder || "desc";

    const data = await db.unsafe(
      `SELECT * FROM quotes ${whereClause}
       ORDER BY ${sortBy} ${sortOrder}
       LIMIT ${pageSize} OFFSET ${offset}`
    );

    // Fetch items for each quote
    const quotesWithItems = await Promise.all(
      data.map(async (row: Record<string, unknown>) => {
        const items = await db`
          SELECT * FROM quote_items WHERE quote_id = ${row.id as string}
        `;
        return mapQuote(row, items);
      })
    );

    return { data: quotesWithItems, total };
  },

  async findById(id: string): Promise<QuoteWithRelations | null> {
    const result = await db`
      SELECT q.*,
        c.id as company_id_join, c.name as company_name, c.industry as company_industry, c.address as company_address,
        ct.id as contact_id_join, ct.first_name as contact_first_name, ct.last_name as contact_last_name, ct.email as contact_email
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

  async create(quote: Omit<Quote, "items">, items: Omit<QuoteItem, "id" | "quoteId">[]): Promise<Quote> {
    const result = await db`
      INSERT INTO quotes (
        id, quote_number, company_id, contact_id, status, issue_date, valid_until,
        subtotal, tax_rate, tax, total, notes, terms, created_by, created_at, updated_at
      ) VALUES (
        ${quote.id}, ${quote.quoteNumber}, ${quote.companyId}, ${quote.contactId || null},
        ${quote.status}, ${quote.issueDate}, ${quote.validUntil},
        ${quote.subtotal}, ${quote.taxRate}, ${quote.tax}, ${quote.total},
        ${quote.notes || null}, ${quote.terms || null}, ${quote.createdBy},
        ${quote.createdAt}, ${quote.updatedAt}
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

    return mapQuote(result[0], insertedItems.map((i) => ({ ...i })));
  },

  async update(id: string, data: Partial<Quote>, items?: Omit<QuoteItem, "quoteId">[]): Promise<Quote> {
    const result = await db`
      UPDATE quotes SET
        company_id = COALESCE(${data.companyId}, company_id),
        contact_id = COALESCE(${data.contactId}, contact_id),
        status = COALESCE(${data.status}, status),
        valid_until = COALESCE(${data.validUntil}, valid_until),
        subtotal = COALESCE(${data.subtotal}, subtotal),
        tax_rate = COALESCE(${data.taxRate}, tax_rate),
        tax = COALESCE(${data.tax}, tax),
        total = COALESCE(${data.total}, total),
        notes = COALESCE(${data.notes}, notes),
        terms = COALESCE(${data.terms}, terms),
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
    return parseInt(result[0].count, 10);
  },

  async generateNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const result = await db`
      SELECT COUNT(*) FROM quotes WHERE EXTRACT(YEAR FROM created_at) = ${year}
    `;
    const count = parseInt(result[0].count, 10) + 1;
    return `QUO-${year}-${String(count).padStart(5, "0")}`;
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
// Mapping Functions
// ============================================

function mapQuoteItem(row: Record<string, unknown>): QuoteItem {
  return {
    id: row.id as string,
    quoteId: row.quote_id as string,
    productName: row.product_name as string,
    description: row.description as string | undefined,
    quantity: parseFloat(row.quantity as string),
    unitPrice: parseFloat(row.unit_price as string),
    discount: parseFloat(row.discount as string),
    total: parseFloat(row.total as string),
  };
}

function mapQuote(row: Record<string, unknown>, items: unknown[]): Quote {
  return {
    id: row.id as string,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
    quoteNumber: row.quote_number as string,
    companyId: row.company_id as string,
    contactId: row.contact_id as string | undefined,
    status: row.status as QuoteStatus,
    issueDate: (row.issue_date as Date).toISOString(),
    validUntil: (row.valid_until as Date).toISOString(),
    items: (items as Record<string, unknown>[]).map(mapQuoteItem),
    subtotal: parseFloat(row.subtotal as string),
    taxRate: parseFloat(row.tax_rate as string),
    tax: parseFloat(row.tax as string),
    total: parseFloat(row.total as string),
    notes: row.notes as string | undefined,
    terms: row.terms as string | undefined,
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

