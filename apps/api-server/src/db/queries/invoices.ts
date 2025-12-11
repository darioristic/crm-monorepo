import type {
  FilterParams,
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  InvoiceWithRelations,
  PaginationParams,
} from "@crm/types";
import { generateUUID } from "@crm/utils";
import { serviceLogger } from "../../lib/logger";
import { sql as db } from "../client";
import {
  createQueryBuilder,
  type QueryParam,
  sanitizeSortColumn,
  sanitizeSortOrder,
} from "../query-builder";

// ============================================
// Invoice Queries
// ============================================

export const invoiceQueries = {
  async findAll(
    companyId: string | null,
    pagination: PaginationParams,
    filters: FilterParams
  ): Promise<{ data: Invoice[]; total: number }> {
    try {
      const { page = 1, pageSize = 20 } = pagination;

      const safePage = Math.max(1, Math.floor(page));
      const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
      const safeOffset = (safePage - 1) * safePageSize;

      // Koristi query builder za sigurne upite
      const qb = createQueryBuilder("invoices");
      // Filter by tenant_id (invoices created by this tenant)
      // Note: companyId parameter actually represents tenant ID in multi-tenant architecture
      if (companyId) {
        qb.addEqualCondition("tenant_id", companyId);
      }
      qb.addSearchCondition(["invoice_number"], filters.search);
      qb.addEqualCondition("status", filters.status);
      // Allow filtering by creator when company filter is not used
      const createdBy = (filters as { createdBy?: string }).createdBy;
      if (createdBy) {
        qb.addEqualCondition("created_by", createdBy);
      }

      const { clause: whereClause, values: whereValues } = qb.buildWhereClause();

      // Count query
      const countQuery = `SELECT COUNT(*) FROM invoices ${whereClause}`;
      const countResult = await db.unsafe(countQuery, whereValues as QueryParam[]);
      const total = parseInt(countResult[0].count, 10);

      const sortBy = sanitizeSortColumn("invoices", pagination.sortBy);
      const sortOrder = sanitizeSortOrder(pagination.sortOrder);

      // Select query
      let data: Record<string, unknown>[] = [];
      try {
        const selectQuery = `
					SELECT * FROM invoices
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
        serviceLogger.error(
          { error: selectError, companyId, pagination, filters },
          "Error selecting invoices"
        );
        data = [];
      }

      // Fetch all items for all invoices in a single query (fixes N+1 problem)
      if (data.length === 0) {
        return { data: [], total };
      }

      const invoiceIds = data.map((row: Record<string, unknown>) => row.id as string);
      const allItems = await db`
				SELECT * FROM invoice_items
				WHERE invoice_id = ANY(${invoiceIds})
				ORDER BY invoice_id
			`;

      // Group items by invoice_id
      const itemsByInvoiceId = (allItems as Record<string, unknown>[]).reduce(
        (acc: Record<string, Record<string, unknown>[]>, item) => {
          const key = item.invoice_id as string;
          if (!acc[key]) {
            acc[key] = [];
          }
          acc[key].push(item);
          return acc;
        },
        {}
      );

      // Map invoices with their items
      const invoicesWithItems = data.map((row: Record<string, unknown>) => {
        const items = itemsByInvoiceId[row.id as string] || [];
        return mapInvoice(row, items);
      });

      return { data: invoicesWithItems, total };
    } catch (error) {
      serviceLogger.error(
        { error, companyId, pagination, filters },
        "Error in invoiceQueries.findAll"
      );
      // Always return a valid response, never throw
      return { data: [], total: 0 };
    }
  },

  async findById(id: string): Promise<InvoiceWithRelations | null> {
    // Fetch invoice with company data for customer details
    const result = await db`
      SELECT i.*,
        c.id as company_id_join, c.name as company_name, c.industry as company_industry, c.address as company_address,
        c.city as company_city, c.zip as company_zip, c.state as company_state, c.country as company_country,
        c.phone as company_phone, c.email as company_email, c.billing_email as company_billing_email,
        c.vat_number as company_vat_number, c.website as company_website,
        c.address_line_1 as company_address_line1, c.zip as company_postal_code,
        c.company_number as company_company_number
      FROM invoices i
      LEFT JOIN companies c ON i.company_id = c.id
      WHERE i.id = ${id}
    `;
    if (result.length === 0) return null;
    const items = await db`SELECT * FROM invoice_items WHERE invoice_id = ${id}`;
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
    invoice: Omit<Invoice, "items"> & { token?: string },
    items: Omit<InvoiceItem, "id" | "invoiceId">[]
  ): Promise<Invoice> {
    // Generate token if not provided
    const token =
      invoice.token || `inv_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    // Note: invoice.sellerCompanyId from service actually contains tenant_id
    const result = await db`
      INSERT INTO invoices (
        id, invoice_number, token, quote_id, company_id, tenant_id, contact_id, status, issue_date, due_date,
        gross_total, subtotal, discount, tax_rate, vat_rate, tax, total, paid_amount, currency,
        notes, terms, from_details, customer_details, logo_url, template_settings,
        created_by, created_at, updated_at
      ) VALUES (
        ${invoice.id}, ${invoice.invoiceNumber}, ${token}, ${invoice.quoteId || null},
        ${invoice.companyId}, ${(invoice as { sellerCompanyId?: string }).sellerCompanyId ?? null}, ${invoice.contactId || null}, ${invoice.status},
        ${invoice.issueDate}, ${invoice.dueDate},
        ${invoice.grossTotal ?? invoice.subtotal}, ${invoice.subtotal}, ${invoice.discount ?? 0},
        ${invoice.taxRate}, ${invoice.vatRate ?? 20}, ${invoice.tax}, ${invoice.total},
        ${invoice.paidAmount}, ${invoice.currency || "EUR"},
        ${invoice.notes || null}, ${invoice.terms || null},
        ${invoice.fromDetails ? JSON.stringify(invoice.fromDetails) : null},
        ${invoice.customerDetails ? JSON.stringify(invoice.customerDetails) : null},
        ${invoice.logoUrl || null},
        ${invoice.templateSettings ? JSON.stringify(invoice.templateSettings) : null},
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

    return mapInvoice(
      result[0],
      insertedItems.map((i) => ({ ...i }))
    );
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
        seller_company_id = COALESCE(${(data as { sellerCompanyId?: string }).sellerCompanyId ?? null}, seller_company_id),
        contact_id = COALESCE(${data.contactId ?? null}, contact_id),
        status = COALESCE(${data.status ?? null}, status),
        due_date = COALESCE(${data.dueDate ?? null}, due_date),
        gross_total = COALESCE(${data.grossTotal ?? null}, gross_total),
        subtotal = COALESCE(${data.subtotal ?? null}, subtotal),
        discount = COALESCE(${data.discount ?? null}, discount),
        tax_rate = COALESCE(${data.taxRate ?? null}, tax_rate),
        vat_rate = COALESCE(${data.vatRate ?? null}, vat_rate),
        tax = COALESCE(${data.tax ?? null}, tax),
        total = COALESCE(${data.total ?? null}, total),
        paid_amount = COALESCE(${data.paidAmount ?? null}, paid_amount),
        currency = COALESCE(${data.currency ?? null}, currency),
        notes = COALESCE(${data.notes ?? null}, notes),
        terms = COALESCE(${data.terms ?? null}, terms),
        from_details = COALESCE(${data.fromDetails ? JSON.stringify(data.fromDetails) : null}, from_details),
        customer_details = COALESCE(${data.customerDetails ? JSON.stringify(data.customerDetails) : null}, customer_details),
        logo_url = COALESCE(${data.logoUrl ?? null}, logo_url),
        template_settings = COALESCE(${data.templateSettings ? JSON.stringify(data.templateSettings) : null}, template_settings),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    // Update items if provided
    if (items) {
      await db`DELETE FROM invoice_items WHERE invoice_id = ${id}`;
      for (const item of items) {
        const itemId = item.id ?? generateUUID();
        await db`
				  INSERT INTO invoice_items (id, invoice_id, product_name, description, quantity, unit_price, discount, total)
				  VALUES (${itemId}, ${id}, ${item.productName}, ${item.description || null}, ${item.quantity}, ${item.unitPrice}, ${item.discount}, ${item.total})
				`;
      }
    }

    const updatedItems = await db`SELECT * FROM invoice_items WHERE invoice_id = ${id}`;
    return mapInvoice(result[0], updatedItems);
  },

  async delete(id: string): Promise<void> {
    // Delete dependents in safe order to satisfy FK constraints
    await db`DELETE FROM invoice_items WHERE invoice_id = ${id}`;
    await db`DELETE FROM payments WHERE invoice_id = ${id}`;
    // Remove delivery note items for notes linked to invoice
    const deliveryNotesForInvoice = await db`
      SELECT id FROM delivery_notes WHERE invoice_id = ${id}
    `;
    const dnIds = (deliveryNotesForInvoice as unknown as Array<{ id: string }>).map((r) => r.id);
    if (dnIds.length > 0) {
      await db`DELETE FROM delivery_note_items WHERE delivery_note_id = ANY(${dnIds})`;
      await db`DELETE FROM delivery_notes WHERE id = ANY(${dnIds})`;
    }
    // Remove orders and their items linked to invoice
    const ordersForInvoice = await db`
      SELECT id FROM orders WHERE invoice_id = ${id}
    `;
    const orderIds = (ordersForInvoice as unknown as Array<{ id: string }>).map((r) => r.id);
    if (orderIds.length > 0) {
      await db`DELETE FROM order_items WHERE order_id = ANY(${orderIds})`;
      await db`DELETE FROM orders WHERE id = ANY(${orderIds})`;
    }
    await db`DELETE FROM invoices WHERE id = ${id}`;
  },

  async count(): Promise<number> {
    const result = await db`SELECT COUNT(*) FROM invoices`;
    return parseInt(result[0].count as string, 10);
  },

  async generateNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const yearPrefix = `INV-${year}-`;

    // Get all invoice numbers for this year
    // We'll extract and sort numerically in code to ensure correct ordering
    const result = await db`
		      SELECT invoice_number 
		      FROM invoices 
		      WHERE invoice_number LIKE ${`${yearPrefix}%`}
        AND LENGTH(invoice_number) = ${yearPrefix.length + 5}
      ORDER BY invoice_number DESC
      LIMIT 100
    `;

    let nextNumber = 1;
    if (result.length > 0) {
      // Extract numeric parts and find the maximum
      // This ensures proper numeric sorting (not alphabetical like "00010" < "00002")
      const numbers = result
        .map((row) => {
          const invoiceNumber = row.invoice_number;
          // Extract numeric part after "INV-YYYY-"
          const numericPart = invoiceNumber.substring(yearPrefix.length);
          const num = parseInt(numericPart, 10);
          return Number.isNaN(num) ? 0 : num;
        })
        .filter((n) => n > 0);

      if (numbers.length > 0) {
        nextNumber = Math.max(...numbers) + 1;
      }
    }

    const generatedNumber = `${yearPrefix}${String(nextNumber).padStart(5, "0")}`;

    // Double-check that this number doesn't exist (race condition protection)
    const exists = await db`
      SELECT id FROM invoices WHERE invoice_number = ${generatedNumber} LIMIT 1
    `;

    if (exists.length > 0) {
      // If it exists, try next number
      nextNumber += 1;
      return `${yearPrefix}${String(nextNumber).padStart(5, "0")}`;
    }

    return generatedNumber;
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

  async getOverdue(companyId: string | null): Promise<Invoice[]> {
    const result = companyId
      ? await db`
        SELECT * FROM invoices
        WHERE company_id = ${companyId}
          AND status IN ('sent', 'partial')
          AND due_date < NOW()
        ORDER BY due_date ASC
      `
      : await db`
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
  if (typeof value === "string") return value;
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
      fromDetails =
        typeof row.from_details === "string"
          ? JSON.parse(row.from_details as string)
          : row.from_details;
    }
  } catch {
    /* ignore parse errors */
  }

  try {
    if (row.customer_details) {
      customerDetails =
        typeof row.customer_details === "string"
          ? JSON.parse(row.customer_details as string)
          : row.customer_details;
    }
  } catch {
    /* ignore parse errors */
  }

  try {
    if (row.template_settings) {
      templateSettings =
        typeof row.template_settings === "string"
          ? JSON.parse(row.template_settings as string)
          : row.template_settings;
    }
  } catch {
    /* ignore parse errors */
  }

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
    tenantId: row.tenant_id as string | undefined,
  } as Invoice;
}

function mapInvoiceWithRelations(
  row: Record<string, unknown>,
  items: unknown[]
): InvoiceWithRelations {
  const invoice = mapInvoice(row, items);
  const hasCustomerDetails = invoice.customerDetails && typeof invoice.customerDetails === "object";
  const customerDetails = hasCustomerDetails
    ? invoice.customerDetails
    : row.contact_id_join
      ? {
          name: `${(row.contact_first_name as string) || ""} ${(row.contact_last_name as string) || ""}`.trim(),
          email: row.contact_email as string,
        }
      : undefined;
  return {
    ...invoice,
    customerDetails,
    company: row.company_id_join
      ? {
          id: row.company_id_join as string,
          createdAt: "",
          updatedAt: "",
          name: row.company_name as string,
          industry: row.company_industry as string,
          address: row.company_address as string,
          addressLine1: row.company_address_line1 as string | undefined,
          city: row.company_city as string | undefined,
          zip: row.company_zip as string | undefined,
          postalCode: row.company_postal_code as string | undefined,
          country: row.company_country as string | undefined,
          phone: row.company_phone as string | undefined,
          email: row.company_email as string | undefined,
          billingEmail: row.company_billing_email as string | undefined,
          vatNumber: row.company_vat_number as string | undefined,
          companyNumber: row.company_company_number as string | undefined,
          registrationNumber: row.company_registration_number as string | undefined,
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
