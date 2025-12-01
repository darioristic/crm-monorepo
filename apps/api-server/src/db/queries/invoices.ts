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
        c.city as company_city, c.zip as company_zip, c.state as company_state, c.country as company_country,
        c.phone as company_phone, c.email as company_email, c.billing_email as company_billing_email,
        c.vat_number as company_vat_number, c.website as company_website,
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

  async findByToken(token: string): Promise<InvoiceWithRelations | null> {
    const result = await db`
      SELECT i.*,
        c.id as company_id_join, c.name as company_name, c.industry as company_industry, c.address as company_address,
        c.city as company_city, c.zip as company_zip, c.state as company_state, c.country as company_country,
        c.phone as company_phone, c.email as company_email, c.billing_email as company_billing_email,
        c.vat_number as company_vat_number, c.website as company_website,
        ct.id as contact_id_join, ct.first_name as contact_first_name, ct.last_name as contact_last_name, ct.email as contact_email,
        q.id as quote_id_join, q.quote_number
      FROM invoices i
      LEFT JOIN companies c ON i.company_id = c.id
      LEFT JOIN contacts ct ON i.contact_id = ct.id
      LEFT JOIN quotes q ON i.quote_id = q.id
      WHERE i.token = ${token}
    `;

    if (result.length === 0) return null;

    const items = await db`
      SELECT * FROM invoice_items WHERE invoice_id = ${result[0].id}
    `;

    return mapInvoiceWithRelations(result[0], items);
  },

  async updateViewedAt(id: string): Promise<void> {
    await db`
      UPDATE invoices SET viewed_at = NOW() WHERE id = ${id} AND viewed_at IS NULL
    `;
  },

  async updateSentAt(id: string): Promise<void> {
    await db`
      UPDATE invoices SET sent_at = NOW(), status = 'sent' WHERE id = ${id}
    `;
  },

  async create(
    invoice: Omit<Invoice, "items">,
    items: Omit<InvoiceItem, "id" | "invoiceId">[]
  ): Promise<Invoice> {
    // Generate token if not provided
    const token = (invoice as any).token || `inv_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    const result = await db`
      INSERT INTO invoices (
        id, invoice_number, token, quote_id, company_id, contact_id, status, issue_date, due_date,
        gross_total, subtotal, discount, tax_rate, vat_rate, tax, total, paid_amount, currency,
        notes, terms, from_details, customer_details, logo_url, template_settings,
        created_by, created_at, updated_at
      ) VALUES (
        ${invoice.id}, ${invoice.invoiceNumber}, ${token}, ${invoice.quoteId || null},
        ${invoice.companyId}, ${invoice.contactId || null}, ${invoice.status},
        ${invoice.issueDate}, ${invoice.dueDate},
        ${invoice.grossTotal ?? invoice.subtotal}, ${invoice.subtotal}, ${invoice.discount ?? 0},
        ${invoice.taxRate}, ${(invoice as any).vatRate ?? 20}, ${invoice.tax}, ${invoice.total},
        ${invoice.paidAmount}, ${(invoice as any).currency || "EUR"},
        ${invoice.notes || null}, ${invoice.terms || null},
        ${(invoice as any).fromDetails ? JSON.stringify((invoice as any).fromDetails) : null},
        ${(invoice as any).customerDetails ? JSON.stringify((invoice as any).customerDetails) : null},
        ${(invoice as any).logoUrl || null},
        ${(invoice as any).templateSettings ? JSON.stringify((invoice as any).templateSettings) : null},
        ${invoice.createdBy}, ${invoice.createdAt}, ${invoice.updatedAt}
      )
      RETURNING *
    `;

    // Insert items
    const insertedItems: InvoiceItem[] = [];
    for (const item of items) {
      const itemResult = await db`
        INSERT INTO invoice_items (invoice_id, product_name, description, quantity, unit, unit_price, discount, vat_rate, total)
        VALUES (${invoice.id}, ${item.productName}, ${item.description || null}, ${item.quantity}, ${(item as any).unit || "pcs"}, ${item.unitPrice}, ${item.discount}, ${(item as any).vatRate ?? 20}, ${item.total})
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
    const extData = data as any;
    const result = await db`
      UPDATE invoices SET
        quote_id = COALESCE(${data.quoteId ?? null}, quote_id),
        company_id = COALESCE(${data.companyId ?? null}, company_id),
        contact_id = COALESCE(${data.contactId ?? null}, contact_id),
        status = COALESCE(${data.status ?? null}, status),
        due_date = COALESCE(${data.dueDate ?? null}, due_date),
        gross_total = COALESCE(${data.grossTotal ?? null}, gross_total),
        subtotal = COALESCE(${data.subtotal ?? null}, subtotal),
        discount = COALESCE(${data.discount ?? null}, discount),
        tax_rate = COALESCE(${data.taxRate ?? null}, tax_rate),
        vat_rate = COALESCE(${extData.vatRate ?? null}, vat_rate),
        tax = COALESCE(${data.tax ?? null}, tax),
        total = COALESCE(${data.total ?? null}, total),
        paid_amount = COALESCE(${data.paidAmount ?? null}, paid_amount),
        currency = COALESCE(${extData.currency ?? null}, currency),
        notes = COALESCE(${data.notes ?? null}, notes),
        terms = COALESCE(${data.terms ?? null}, terms),
        from_details = COALESCE(${extData.fromDetails ? JSON.stringify(extData.fromDetails) : null}, from_details),
        customer_details = COALESCE(${extData.customerDetails ? JSON.stringify(extData.customerDetails) : null}, customer_details),
        logo_url = COALESCE(${extData.logoUrl ?? null}, logo_url),
        template_settings = COALESCE(${extData.templateSettings ? JSON.stringify(extData.templateSettings) : null}, template_settings),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    // Update items if provided
    if (items) {
      await db`DELETE FROM invoice_items WHERE invoice_id = ${id}`;
      for (const item of items) {
        const extItem = item as any;
        await db`
          INSERT INTO invoice_items (id, invoice_id, product_name, description, quantity, unit, unit_price, discount, vat_rate, total)
          VALUES (${item.id || db`gen_random_uuid()`}, ${id}, ${item.productName}, ${item.description || null}, ${item.quantity}, ${extItem.unit || "pcs"}, ${item.unitPrice}, ${item.discount}, ${extItem.vatRate ?? 20}, ${item.total})
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
    unit: (row.unit as string) || "pcs",
    unitPrice: parseFloat(row.unit_price as string),
    discount: parseFloat(row.discount as string),
    vatRate: parseFloat((row.vat_rate as string) || "20"),
    total: parseFloat(row.total as string),
  };
}

function mapInvoice(row: Record<string, unknown>, items: unknown[]): Invoice {
  // Parse JSON fields safely
  let fromDetails = null;
  let customerDetails = null;
  let templateSettings = null;
  
  try {
    if (row.from_details) {
      fromDetails = typeof row.from_details === 'string' 
        ? JSON.parse(row.from_details as string) 
        : row.from_details;
    }
  } catch { /* ignore parse errors */ }
  
  try {
    if (row.customer_details) {
      customerDetails = typeof row.customer_details === 'string'
        ? JSON.parse(row.customer_details as string)
        : row.customer_details;
    }
  } catch { /* ignore parse errors */ }
  
  try {
    if (row.template_settings) {
      templateSettings = typeof row.template_settings === 'string'
        ? JSON.parse(row.template_settings as string)
        : row.template_settings;
    }
  } catch { /* ignore parse errors */ }

  return {
    id: row.id as string,
    createdAt: toISOString(row.created_at),
    updatedAt: toISOString(row.updated_at),
    invoiceNumber: row.invoice_number as string,
    token: row.token as string | undefined,
    quoteId: row.quote_id as string | undefined,
    companyId: row.company_id as string,
    contactId: row.contact_id as string | undefined,
    status: row.status as InvoiceStatus,
    issueDate: toISOString(row.issue_date),
    dueDate: toISOString(row.due_date),
    items: (items as Record<string, unknown>[]).map(mapInvoiceItem),
    grossTotal: parseFloat((row.gross_total as string) || "0"),
    subtotal: parseFloat(row.subtotal as string),
    discount: parseFloat((row.discount as string) || "0"),
    taxRate: parseFloat(row.tax_rate as string),
    vatRate: parseFloat((row.vat_rate as string) || "20"),
    tax: parseFloat(row.tax as string),
    total: parseFloat(row.total as string),
    paidAmount: parseFloat(row.paid_amount as string),
    currency: (row.currency as string) || "EUR",
    notes: row.notes as string | undefined,
    terms: row.terms as string | undefined,
    fromDetails,
    customerDetails,
    logoUrl: row.logo_url as string | undefined,
    templateSettings,
    viewedAt: row.viewed_at ? toISOString(row.viewed_at) : undefined,
    sentAt: row.sent_at ? toISOString(row.sent_at) : undefined,
    paidAt: row.paid_at ? toISOString(row.paid_at) : undefined,
    createdBy: row.created_by as string,
  } as Invoice;
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
          city: row.company_city as string | undefined,
          state: row.company_state as string | undefined,
          zip: row.company_zip as string | undefined,
          country: row.company_country as string | undefined,
          phone: row.company_phone as string | undefined,
          email: (row.company_email || row.company_billing_email) as string | undefined,
          billingEmail: row.company_billing_email as string | undefined,
          vatNumber: row.company_vat_number as string | undefined,
          website: row.company_website as string | undefined,
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
