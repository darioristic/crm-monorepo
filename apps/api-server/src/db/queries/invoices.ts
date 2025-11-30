import type {
  Invoice,
  InvoiceItem,
  InvoiceWithRelations,
  PaginationParams,
  FilterParams,
  InvoiceStatus,
} from "@crm/types";
import { sql as db } from "../client";
import {
  createQueryBuilder,
  sanitizeSortColumn,
  sanitizeSortOrder,
  type QueryParam,
} from "../query-builder";

// ============================================
// Invoice Queries
// ============================================

export const invoiceQueries = {
  async findAll(
    pagination: PaginationParams,
    filters: FilterParams
  ): Promise<{ data: Invoice[]; total: number }> {
    const { page = 1, pageSize = 20 } = pagination;

    const safePage = Math.max(1, Math.floor(page));
    const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
    const safeOffset = (safePage - 1) * safePageSize;

    // Koristi query builder za sigurne upite
    const qb = createQueryBuilder("invoices");
    qb.addSearchCondition(["invoice_number"], filters.search);
    qb.addEqualCondition("status", filters.status);

    const { clause: whereClause, values: whereValues } = qb.buildWhereClause();

    const countQuery = `SELECT COUNT(*) FROM invoices ${whereClause}`;
    const countResult = await db.unsafe(countQuery, whereValues as QueryParam[]);
    const total = parseInt(countResult[0].count, 10);

    const sortBy = sanitizeSortColumn("invoices", pagination.sortBy);
    const sortOrder = sanitizeSortOrder(pagination.sortOrder);

    const selectQuery = `
      SELECT * FROM invoices
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${whereValues.length + 1} OFFSET $${whereValues.length + 2}
    `;

    const data = await db.unsafe(selectQuery, [...whereValues, safePageSize, safeOffset] as QueryParam[]);

    // Fetch items for each invoice
    const invoicesWithItems = await Promise.all(
      data.map(async (row: Record<string, unknown>) => {
        const items = await db`
          SELECT * FROM invoice_items WHERE invoice_id = ${row.id as string}
        `;
        return mapInvoice(row, items);
      })
    );

    return { data: invoicesWithItems, total };
  },

  async findById(id: string): Promise<InvoiceWithRelations | null> {
    const result = await db`
      SELECT i.*,
        c.id as company_id_join, c.name as company_name, c.industry as company_industry, c.address as company_address,
        ct.id as contact_id_join, ct.first_name as contact_first_name, ct.last_name as contact_last_name, ct.email as contact_email,
        q.id as quote_id_join, q.quote_number
      FROM invoices i
      LEFT JOIN companies c ON i.company_id = c.id
      LEFT JOIN contacts ct ON i.contact_id = ct.id
      LEFT JOIN quotes q ON i.quote_id = q.id
      WHERE i.id = ${id}
    `;

    if (result.length === 0) return null;

    const items = await db`
      SELECT * FROM invoice_items WHERE invoice_id = ${id}
    `;

    return mapInvoiceWithRelations(result[0], items);
  },

  async findByNumber(invoiceNumber: string): Promise<Invoice | null> {
    const result = await db`
      SELECT * FROM invoices WHERE invoice_number = ${invoiceNumber}
    `;
    if (result.length === 0) return null;

    const items = await db`
      SELECT * FROM invoice_items WHERE invoice_id = ${result[0].id}
    `;

    return mapInvoice(result[0], items);
  },

  async create(
    invoice: Omit<Invoice, "items">,
    items: Omit<InvoiceItem, "id" | "invoiceId">[]
  ): Promise<Invoice> {
    const result = await db`
      INSERT INTO invoices (
        id, invoice_number, quote_id, company_id, contact_id, status, issue_date, due_date,
        subtotal, tax_rate, tax, total, paid_amount, notes, terms, created_by, created_at, updated_at
      ) VALUES (
        ${invoice.id}, ${invoice.invoiceNumber}, ${invoice.quoteId || null},
        ${invoice.companyId}, ${invoice.contactId || null}, ${invoice.status},
        ${invoice.issueDate}, ${invoice.dueDate},
        ${invoice.subtotal}, ${invoice.taxRate}, ${invoice.tax}, ${invoice.total},
        ${invoice.paidAmount}, ${invoice.notes || null}, ${invoice.terms || null},
        ${invoice.createdBy}, ${invoice.createdAt}, ${invoice.updatedAt}
      )
      RETURNING *
    `;

    // Insert items
    const insertedItems: InvoiceItem[] = [];
    for (const item of items) {
      const itemResult = await db`
        INSERT INTO invoice_items (invoice_id, product_name, description, quantity, unit_price, discount, total)
        VALUES (${invoice.id}, ${item.productName}, ${item.description || null}, ${item.quantity}, ${item.unitPrice}, ${item.discount}, ${item.total})
        RETURNING *
      `;
      insertedItems.push(mapInvoiceItem(itemResult[0]));
    }

    return mapInvoice(result[0], insertedItems.map((i) => ({ ...i })));
  },

  async update(
    id: string,
    data: Partial<Invoice>,
    items?: Omit<InvoiceItem, "invoiceId">[]
  ): Promise<Invoice> {
    const result = await db`
      UPDATE invoices SET
        quote_id = COALESCE(${data.quoteId ?? null}, quote_id),
        company_id = COALESCE(${data.companyId ?? null}, company_id),
        contact_id = COALESCE(${data.contactId ?? null}, contact_id),
        status = COALESCE(${data.status ?? null}, status),
        due_date = COALESCE(${data.dueDate ?? null}, due_date),
        subtotal = COALESCE(${data.subtotal ?? null}, subtotal),
        tax_rate = COALESCE(${data.taxRate ?? null}, tax_rate),
        tax = COALESCE(${data.tax ?? null}, tax),
        total = COALESCE(${data.total ?? null}, total),
        paid_amount = COALESCE(${data.paidAmount ?? null}, paid_amount),
        notes = COALESCE(${data.notes ?? null}, notes),
        terms = COALESCE(${data.terms ?? null}, terms),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    // Update items if provided
    if (items) {
      await db`DELETE FROM invoice_items WHERE invoice_id = ${id}`;
      for (const item of items) {
        await db`
          INSERT INTO invoice_items (id, invoice_id, product_name, description, quantity, unit_price, discount, total)
          VALUES (${item.id || db`gen_random_uuid()`}, ${id}, ${item.productName}, ${item.description || null}, ${item.quantity}, ${item.unitPrice}, ${item.discount}, ${item.total})
        `;
      }
    }

    const updatedItems = await db`SELECT * FROM invoice_items WHERE invoice_id = ${id}`;
    return mapInvoice(result[0], updatedItems);
  },

  async delete(id: string): Promise<void> {
    await db`DELETE FROM invoices WHERE id = ${id}`;
  },

  async count(): Promise<number> {
    const result = await db`SELECT COUNT(*) FROM invoices`;
    return parseInt(result[0].count as string, 10);
  },

  async generateNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const result = await db`
      SELECT COUNT(*) FROM invoices WHERE EXTRACT(YEAR FROM created_at) = ${year}
    `;
    const count = parseInt(result[0].count as string, 10) + 1;
    return `INV-${year}-${String(count).padStart(5, "0")}`;
  },

  async findByCompany(companyId: string): Promise<Invoice[]> {
    const result = await db`
      SELECT * FROM invoices WHERE company_id = ${companyId} ORDER BY created_at DESC
    `;
    return Promise.all(
      result.map(async (row) => {
        const items = await db`SELECT * FROM invoice_items WHERE invoice_id = ${row.id}`;
        return mapInvoice(row, items);
      })
    );
  },

  async findByStatus(status: InvoiceStatus): Promise<Invoice[]> {
    const result = await db`
      SELECT * FROM invoices WHERE status = ${status} ORDER BY created_at DESC
    `;
    return Promise.all(
      result.map(async (row) => {
        const items = await db`SELECT * FROM invoice_items WHERE invoice_id = ${row.id}`;
        return mapInvoice(row, items);
      })
    );
  },

  async findByQuote(quoteId: string): Promise<Invoice[]> {
    const result = await db`
      SELECT * FROM invoices WHERE quote_id = ${quoteId} ORDER BY created_at DESC
    `;
    return Promise.all(
      result.map(async (row) => {
        const items = await db`SELECT * FROM invoice_items WHERE invoice_id = ${row.id}`;
        return mapInvoice(row, items);
      })
    );
  },

  async recordPayment(id: string, amount: number): Promise<Invoice> {
    const invoice = await invoiceQueries.findById(id);
    if (!invoice) throw new Error("Invoice not found");

    const newPaidAmount = invoice.paidAmount + amount;
    let newStatus: InvoiceStatus = invoice.status;

    if (newPaidAmount >= invoice.total) {
      newStatus = "paid";
    } else if (newPaidAmount > 0) {
      newStatus = "partial";
    }

    return invoiceQueries.update(id, {
      paidAmount: newPaidAmount,
      status: newStatus,
    });
  },

  async getOverdue(): Promise<Invoice[]> {
    const result = await db`
      SELECT * FROM invoices
      WHERE status IN ('sent', 'partial')
        AND due_date < NOW()
      ORDER BY due_date ASC
    `;
    return Promise.all(
      result.map(async (row) => {
        const items = await db`SELECT * FROM invoice_items WHERE invoice_id = ${row.id}`;
        return mapInvoice(row, items);
      })
    );
  },
};

// ============================================
// Helper for date conversion
// ============================================

function toISOString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return String(value);
}

// ============================================
// Mapping Functions
// ============================================

function mapInvoiceItem(row: Record<string, unknown>): InvoiceItem {
  return {
    id: row.id as string,
    invoiceId: row.invoice_id as string,
    productName: row.product_name as string,
    description: row.description as string | undefined,
    quantity: parseFloat(row.quantity as string),
    unitPrice: parseFloat(row.unit_price as string),
    discount: parseFloat(row.discount as string),
    total: parseFloat(row.total as string),
  };
}

function mapInvoice(row: Record<string, unknown>, items: unknown[]): Invoice {
  return {
    id: row.id as string,
    createdAt: toISOString(row.created_at),
    updatedAt: toISOString(row.updated_at),
    invoiceNumber: row.invoice_number as string,
    quoteId: row.quote_id as string | undefined,
    companyId: row.company_id as string,
    contactId: row.contact_id as string | undefined,
    status: row.status as InvoiceStatus,
    issueDate: toISOString(row.issue_date),
    dueDate: toISOString(row.due_date),
    items: (items as Record<string, unknown>[]).map(mapInvoiceItem),
    subtotal: parseFloat(row.subtotal as string),
    taxRate: parseFloat(row.tax_rate as string),
    tax: parseFloat(row.tax as string),
    total: parseFloat(row.total as string),
    paidAmount: parseFloat(row.paid_amount as string),
    notes: row.notes as string | undefined,
    terms: row.terms as string | undefined,
    createdBy: row.created_by as string,
  };
}

function mapInvoiceWithRelations(
  row: Record<string, unknown>,
  items: unknown[]
): InvoiceWithRelations {
  const invoice = mapInvoice(row, items);
  return {
    ...invoice,
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
    quote: row.quote_id_join
      ? {
          id: row.quote_id_join as string,
          createdAt: "",
          updatedAt: "",
          quoteNumber: row.quote_number as string,
          companyId: invoice.companyId,
          status: "accepted",
          issueDate: "",
          validUntil: "",
          items: [],
          subtotal: 0,
          taxRate: 0,
          tax: 0,
          total: 0,
          createdBy: "",
        }
      : undefined,
  };
}

export default invoiceQueries;
