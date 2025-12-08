import type {
  DeliveryNote,
  DeliveryNoteItem,
  DeliveryNoteStatus,
  DeliveryNoteWithRelations,
  FilterParams,
  PaginationParams,
} from "@crm/types";
import { sql as db } from "../client";
import {
  createQueryBuilder,
  type QueryParam,
  sanitizeSortColumn,
  sanitizeSortOrder,
} from "../query-builder";

// ============================================
// Delivery Note Queries
// ============================================

export const deliveryNoteQueries = {
  async findAll(
    companyId: string | null,
    pagination: PaginationParams,
    filters: FilterParams
  ): Promise<{ data: DeliveryNote[]; total: number }> {
    const { page = 1, pageSize = 20 } = pagination;

    const safePage = Math.max(1, Math.floor(page));
    const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
    const safeOffset = (safePage - 1) * safePageSize;

    // Koristi query builder za sigurne upite
    const qb = createQueryBuilder("delivery_notes");
    // Only filter by companyId if provided (admin can see all)
    if (companyId) {
      qb.addEqualCondition("company_id", companyId);
    }
    qb.addSearchCondition(["delivery_number"], filters.search);
    qb.addEqualCondition("status", filters.status);
    if ((filters as any).createdBy) {
      qb.addEqualCondition("created_by", (filters as any).createdBy as string);
    }

    const { clause: whereClause, values: whereValues } = qb.buildWhereClause();

    const countQuery = `SELECT COUNT(*) FROM delivery_notes ${whereClause}`;
    const countResult = await db.unsafe(countQuery, whereValues as QueryParam[]);
    const total = parseInt(countResult[0].count, 10);

    const sortBy = sanitizeSortColumn("delivery_notes", pagination.sortBy);
    const sortOrder = sanitizeSortOrder(pagination.sortOrder);

    const selectQuery = `
      SELECT * FROM delivery_notes
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${whereValues.length + 1} OFFSET $${whereValues.length + 2}
    `;

    const data = await db.unsafe(selectQuery, [
      ...whereValues,
      safePageSize,
      safeOffset,
    ] as QueryParam[]);

    // Fetch all items for all delivery notes in a single query (fixes N+1 problem)
    if (data.length === 0) {
      return { data: [], total };
    }

    const noteIds = data.map((row: Record<string, unknown>) => row.id as string);
    const allItems = await db`
      SELECT * FROM delivery_note_items
      WHERE delivery_note_id = ANY(${noteIds})
      ORDER BY delivery_note_id
    `;

    // Group items by delivery_note_id
    const itemsByNoteId = allItems.reduce((acc: Record<string, any[]>, item: any) => {
      if (!acc[item.delivery_note_id]) {
        acc[item.delivery_note_id] = [];
      }
      acc[item.delivery_note_id].push(item);
      return acc;
    }, {});

    // Map delivery notes with their items
    const notesWithItems = data.map((row: Record<string, unknown>) => {
      const items = itemsByNoteId[row.id as string] || [];
      return mapDeliveryNote(row, items);
    });

    return { data: notesWithItems, total };
  },

  async findById(id: string): Promise<DeliveryNoteWithRelations | null> {
    const result = await db`
      SELECT d.*,
        c.id as company_id_join, c.name as company_name, c.industry as company_industry, c.address as company_address,
        ct.id as contact_id_join, ct.first_name as contact_first_name, ct.last_name as contact_last_name, ct.email as contact_email,
        i.id as invoice_id_join, i.invoice_number
      FROM delivery_notes d
      LEFT JOIN companies c ON d.company_id = c.id
      LEFT JOIN contacts ct ON d.contact_id = ct.id
      LEFT JOIN invoices i ON d.invoice_id = i.id
      WHERE d.id = ${id}
    `;

    if (result.length === 0) return null;

    const items = await db`
      SELECT * FROM delivery_note_items WHERE delivery_note_id = ${id}
    `;

    return mapDeliveryNoteWithRelations(result[0], items);
  },

  async findByNumber(deliveryNumber: string): Promise<DeliveryNote | null> {
    const result = await db`
      SELECT * FROM delivery_notes WHERE delivery_number = ${deliveryNumber}
    `;
    if (result.length === 0) return null;

    const items = await db`
      SELECT * FROM delivery_note_items WHERE delivery_note_id = ${result[0].id}
    `;

    return mapDeliveryNote(result[0], items);
  },

  async create(
    note: Omit<DeliveryNote, "items">,
    items: Omit<DeliveryNoteItem, "id" | "deliveryNoteId">[]
  ): Promise<DeliveryNote> {
    const result = await db`
      INSERT INTO delivery_notes (
        id, delivery_number, invoice_id, company_id, contact_id, status,
        ship_date, delivery_date, shipping_address, tracking_number, carrier,
        tax_rate, subtotal, tax, total, notes, terms, customer_details, from_details,
        created_by, created_at, updated_at
      ) VALUES (
        ${note.id}, ${note.deliveryNumber}, ${note.invoiceId || null},
        ${note.companyId}, ${note.contactId || null}, ${note.status},
        ${note.shipDate || null}, ${note.deliveryDate || null}, ${note.shippingAddress},
        ${note.trackingNumber || null}, ${note.carrier || null},
        ${note.taxRate || 0}, ${note.subtotal || 0}, ${note.tax || 0}, ${note.total || 0},
        ${note.notes || null}, ${note.terms || null},
        ${note.customerDetails ? JSON.stringify(note.customerDetails) : null},
        ${note.fromDetails ? JSON.stringify(note.fromDetails) : null},
        ${note.createdBy}, ${note.createdAt}, ${note.updatedAt}
      )
      RETURNING *
    `;

    // Insert items
    const insertedItems: DeliveryNoteItem[] = [];
    for (const item of items) {
      const itemResult = await db`
        INSERT INTO delivery_note_items (delivery_note_id, product_name, description, quantity, unit, unit_price, discount)
        VALUES (${note.id}, ${item.productName}, ${item.description || null}, ${item.quantity}, ${item.unit}, ${item.unitPrice || 0}, ${item.discount || 0})
        RETURNING *
      `;
      insertedItems.push(mapDeliveryNoteItem(itemResult[0]));
    }

    return mapDeliveryNote(
      result[0],
      insertedItems.map((i) => ({ ...i }))
    );
  },

  async update(
    id: string,
    data: Partial<DeliveryNote>,
    items?: Omit<DeliveryNoteItem, "deliveryNoteId">[]
  ): Promise<DeliveryNote> {
    const result = await db`
      UPDATE delivery_notes SET
        invoice_id = COALESCE(${data.invoiceId ?? null}, invoice_id),
        company_id = COALESCE(${data.companyId ?? null}, company_id),
        contact_id = COALESCE(${data.contactId ?? null}, contact_id),
        status = COALESCE(${data.status ?? null}, status),
        ship_date = COALESCE(${data.shipDate ?? null}, ship_date),
        delivery_date = COALESCE(${data.deliveryDate ?? null}, delivery_date),
        shipping_address = COALESCE(${data.shippingAddress ?? null}, shipping_address),
        tracking_number = COALESCE(${data.trackingNumber ?? null}, tracking_number),
        carrier = COALESCE(${data.carrier ?? null}, carrier),
        tax_rate = COALESCE(${data.taxRate ?? null}, tax_rate),
        subtotal = COALESCE(${data.subtotal ?? null}, subtotal),
        tax = COALESCE(${data.tax ?? null}, tax),
        total = COALESCE(${data.total ?? null}, total),
        notes = COALESCE(${data.notes ?? null}, notes),
        terms = COALESCE(${data.terms ?? null}, terms),
        customer_details = COALESCE(${data.customerDetails ? JSON.stringify(data.customerDetails) : null}, customer_details),
        from_details = COALESCE(${data.fromDetails ? JSON.stringify(data.fromDetails) : null}, from_details),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    // Update items if provided
    if (items) {
      await db`DELETE FROM delivery_note_items WHERE delivery_note_id = ${id}`;
      for (const item of items) {
        await db`
          INSERT INTO delivery_note_items (id, delivery_note_id, product_name, description, quantity, unit, unit_price, discount)
          VALUES (${item.id || db`gen_random_uuid()`}, ${id}, ${item.productName}, ${item.description || null}, ${item.quantity}, ${item.unit}, ${item.unitPrice || 0}, ${item.discount || 0})
        `;
      }
    }

    const updatedItems = await db`SELECT * FROM delivery_note_items WHERE delivery_note_id = ${id}`;
    return mapDeliveryNote(result[0], updatedItems);
  },

  async delete(id: string): Promise<void> {
    await db`DELETE FROM delivery_notes WHERE id = ${id}`;
  },

  async count(): Promise<number> {
    const result = await db`SELECT COUNT(*) FROM delivery_notes`;
    return parseInt(result[0].count as string, 10);
  },

  async generateNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const result = await db`
      SELECT COUNT(*) FROM delivery_notes WHERE EXTRACT(YEAR FROM created_at) = ${year}
    `;
    const count = parseInt(result[0].count as string, 10) + 1;
    return `DEL-${year}-${String(count).padStart(5, "0")}`;
  },

  async findByCompany(companyId: string): Promise<DeliveryNote[]> {
    const result = await db`
      SELECT * FROM delivery_notes WHERE company_id = ${companyId} ORDER BY created_at DESC
    `;

    if (result.length === 0) return [];

    const noteIds = result.map((row) => row.id as string);
    const allItems = await db`
      SELECT * FROM delivery_note_items
      WHERE delivery_note_id = ANY(${noteIds})
      ORDER BY delivery_note_id
    `;

    const itemsByNoteId = allItems.reduce((acc: Record<string, any[]>, item: any) => {
      if (!acc[item.delivery_note_id]) {
        acc[item.delivery_note_id] = [];
      }
      acc[item.delivery_note_id].push(item);
      return acc;
    }, {});

    return result.map((row) => {
      const items = itemsByNoteId[row.id as string] || [];
      return mapDeliveryNote(row, items);
    });
  },

  async findByStatus(status: DeliveryNoteStatus): Promise<DeliveryNote[]> {
    const result = await db`
      SELECT * FROM delivery_notes WHERE status = ${status} ORDER BY created_at DESC
    `;

    if (result.length === 0) return [];

    const noteIds = result.map((row) => row.id as string);
    const allItems = await db`
      SELECT * FROM delivery_note_items
      WHERE delivery_note_id = ANY(${noteIds})
      ORDER BY delivery_note_id
    `;

    const itemsByNoteId = allItems.reduce((acc: Record<string, any[]>, item: any) => {
      if (!acc[item.delivery_note_id]) {
        acc[item.delivery_note_id] = [];
      }
      acc[item.delivery_note_id].push(item);
      return acc;
    }, {});

    return result.map((row) => {
      const items = itemsByNoteId[row.id as string] || [];
      return mapDeliveryNote(row, items);
    });
  },

  async findByInvoice(invoiceId: string): Promise<DeliveryNote[]> {
    const result = await db`
      SELECT * FROM delivery_notes WHERE invoice_id = ${invoiceId} ORDER BY created_at DESC
    `;

    if (result.length === 0) return [];

    const noteIds = result.map((row) => row.id as string);
    const allItems = await db`
      SELECT * FROM delivery_note_items
      WHERE delivery_note_id = ANY(${noteIds})
      ORDER BY delivery_note_id
    `;

    const itemsByNoteId = allItems.reduce((acc: Record<string, any[]>, item: any) => {
      if (!acc[item.delivery_note_id]) {
        acc[item.delivery_note_id] = [];
      }
      acc[item.delivery_note_id].push(item);
      return acc;
    }, {});

    return result.map((row) => {
      const items = itemsByNoteId[row.id as string] || [];
      return mapDeliveryNote(row, items);
    });
  },

  async markDelivered(id: string): Promise<DeliveryNote> {
    return deliveryNoteQueries.update(id, {
      status: "delivered",
      deliveryDate: new Date().toISOString(),
    });
  },

  async getPending(companyId: string | null): Promise<DeliveryNote[]> {
    const result = companyId
      ? await db`
        SELECT * FROM delivery_notes
        WHERE company_id = ${companyId}
          AND status = 'pending'
        ORDER BY created_at ASC
      `
      : await db`
        SELECT * FROM delivery_notes
        WHERE status = 'pending'
        ORDER BY created_at ASC
      `;

    if (result.length === 0) return [];

    const noteIds = result.map((row) => row.id as string);
    const allItems = await db`
      SELECT * FROM delivery_note_items
      WHERE delivery_note_id = ANY(${noteIds})
      ORDER BY delivery_note_id
    `;

    const itemsByNoteId = allItems.reduce((acc: Record<string, any[]>, item: any) => {
      if (!acc[item.delivery_note_id]) {
        acc[item.delivery_note_id] = [];
      }
      acc[item.delivery_note_id].push(item);
      return acc;
    }, {});

    return result.map((row) => {
      const items = itemsByNoteId[row.id as string] || [];
      return mapDeliveryNote(row, items);
    });
  },

  async getInTransit(companyId: string | null): Promise<DeliveryNote[]> {
    const result = companyId
      ? await db`
        SELECT * FROM delivery_notes
        WHERE company_id = ${companyId}
          AND status = 'in_transit'
        ORDER BY ship_date ASC
      `
      : await db`
        SELECT * FROM delivery_notes
        WHERE status = 'in_transit'
        ORDER BY ship_date ASC
      `;

    if (result.length === 0) return [];

    const noteIds = result.map((row) => row.id as string);
    const allItems = await db`
      SELECT * FROM delivery_note_items
      WHERE delivery_note_id = ANY(${noteIds})
      ORDER BY delivery_note_id
    `;

    const itemsByNoteId = allItems.reduce((acc: Record<string, any[]>, item: any) => {
      if (!acc[item.delivery_note_id]) {
        acc[item.delivery_note_id] = [];
      }
      acc[item.delivery_note_id].push(item);
      return acc;
    }, {});

    return result.map((row) => {
      const items = itemsByNoteId[row.id as string] || [];
      return mapDeliveryNote(row, items);
    });
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

function mapDeliveryNoteItem(row: Record<string, unknown>): DeliveryNoteItem {
  return {
    id: row.id as string,
    deliveryNoteId: row.delivery_note_id as string,
    productName: row.product_name as string,
    description: row.description as string | undefined,
    quantity: parseFloat(row.quantity as string),
    unit: row.unit as string,
    unitPrice: parseFloat((row.unit_price as string) || "0"),
    discount: parseFloat((row.discount as string) || "0"),
    total: row.total ? parseFloat(row.total as string) : undefined,
  };
}

function mapDeliveryNote(row: Record<string, unknown>, items: unknown[]): DeliveryNote {
  let customerDetails = null;
  if (row.customer_details) {
    customerDetails =
      typeof row.customer_details === "string"
        ? JSON.parse(row.customer_details as string)
        : row.customer_details;
  }
  let fromDetails = null;
  if (row.from_details) {
    fromDetails =
      typeof row.from_details === "string"
        ? JSON.parse(row.from_details as string)
        : row.from_details;
  }

  return {
    id: row.id as string,
    createdAt: toISOString(row.created_at),
    updatedAt: toISOString(row.updated_at),
    deliveryNumber: row.delivery_number as string,
    invoiceId: row.invoice_id as string | undefined,
    companyId: row.company_id as string,
    contactId: row.contact_id as string | undefined,
    status: row.status as DeliveryNoteStatus,
    shipDate: row.ship_date ? toISOString(row.ship_date) : undefined,
    deliveryDate: row.delivery_date ? toISOString(row.delivery_date) : undefined,
    items: (items as Record<string, unknown>[]).map(mapDeliveryNoteItem),
    shippingAddress: row.shipping_address as string,
    trackingNumber: row.tracking_number as string | undefined,
    carrier: row.carrier as string | undefined,
    taxRate: parseFloat((row.tax_rate as string) || "0"),
    subtotal: parseFloat((row.subtotal as string) || "0"),
    tax: parseFloat((row.tax as string) || "0"),
    total: parseFloat((row.total as string) || "0"),
    notes: row.notes as string | undefined,
    terms: row.terms as string | undefined,
    customerDetails,
    fromDetails,
    createdBy: row.created_by as string,
  };
}

function mapDeliveryNoteWithRelations(
  row: Record<string, unknown>,
  items: unknown[]
): DeliveryNoteWithRelations {
  const note = mapDeliveryNote(row, items);
  return {
    ...note,
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
    invoice: row.invoice_id_join
      ? {
          id: row.invoice_id_join as string,
          createdAt: "",
          updatedAt: "",
          invoiceNumber: row.invoice_number as string,
          companyId: note.companyId,
          status: "paid",
          issueDate: "",
          dueDate: "",
          items: [],
          subtotal: 0,
          taxRate: 0,
          tax: 0,
          total: 0,
          paidAmount: 0,
          createdBy: "",
        }
      : undefined,
  };
}

export default deliveryNoteQueries;
