import type {
  DeliveryNote,
  DeliveryNoteItem,
  DeliveryNoteWithRelations,
  PaginationParams,
  FilterParams,
  DeliveryNoteStatus,
} from "@crm/types";
import db from "../client";

// ============================================
// Delivery Note Queries
// ============================================

export const deliveryNoteQueries = {
  async findAll(
    pagination: PaginationParams,
    filters: FilterParams
  ): Promise<{ data: DeliveryNote[]; total: number }> {
    const { page = 1, pageSize = 20 } = pagination;
    const offset = (page - 1) * pageSize;

    let whereClause = "";
    const conditions: string[] = [];

    if (filters.search) {
      conditions.push(`(delivery_number ILIKE '%${filters.search}%')`);
    }
    if (filters.status) {
      conditions.push(`status = '${filters.status}'`);
    }

    if (conditions.length > 0) {
      whereClause = `WHERE ${conditions.join(" AND ")}`;
    }

    const countResult = await db.unsafe(
      `SELECT COUNT(*) FROM delivery_notes ${whereClause}`
    );
    const total = parseInt(countResult[0].count, 10);

    const sortBy = pagination.sortBy || "created_at";
    const sortOrder = pagination.sortOrder || "desc";

    const data = await db.unsafe(
      `SELECT * FROM delivery_notes ${whereClause}
       ORDER BY ${sortBy} ${sortOrder}
       LIMIT ${pageSize} OFFSET ${offset}`
    );

    // Fetch items for each delivery note
    const notesWithItems = await Promise.all(
      data.map(async (row: Record<string, unknown>) => {
        const items = await db`
          SELECT * FROM delivery_note_items WHERE delivery_note_id = ${row.id as string}
        `;
        return mapDeliveryNote(row, items);
      })
    );

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
        notes, created_by, created_at, updated_at
      ) VALUES (
        ${note.id}, ${note.deliveryNumber}, ${note.invoiceId || null},
        ${note.companyId}, ${note.contactId || null}, ${note.status},
        ${note.shipDate || null}, ${note.deliveryDate || null}, ${note.shippingAddress},
        ${note.trackingNumber || null}, ${note.carrier || null},
        ${note.notes || null}, ${note.createdBy}, ${note.createdAt}, ${note.updatedAt}
      )
      RETURNING *
    `;

    // Insert items
    const insertedItems: DeliveryNoteItem[] = [];
    for (const item of items) {
      const itemResult = await db`
        INSERT INTO delivery_note_items (delivery_note_id, product_name, description, quantity, unit)
        VALUES (${note.id}, ${item.productName}, ${item.description || null}, ${item.quantity}, ${item.unit})
        RETURNING *
      `;
      insertedItems.push(mapDeliveryNoteItem(itemResult[0]));
    }

    return mapDeliveryNote(result[0], insertedItems.map((i) => ({ ...i })));
  },

  async update(
    id: string,
    data: Partial<DeliveryNote>,
    items?: Omit<DeliveryNoteItem, "deliveryNoteId">[]
  ): Promise<DeliveryNote> {
    const result = await db`
      UPDATE delivery_notes SET
        invoice_id = COALESCE(${data.invoiceId}, invoice_id),
        company_id = COALESCE(${data.companyId}, company_id),
        contact_id = COALESCE(${data.contactId}, contact_id),
        status = COALESCE(${data.status}, status),
        ship_date = COALESCE(${data.shipDate}, ship_date),
        delivery_date = COALESCE(${data.deliveryDate}, delivery_date),
        shipping_address = COALESCE(${data.shippingAddress}, shipping_address),
        tracking_number = COALESCE(${data.trackingNumber}, tracking_number),
        carrier = COALESCE(${data.carrier}, carrier),
        notes = COALESCE(${data.notes}, notes),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    // Update items if provided
    if (items) {
      await db`DELETE FROM delivery_note_items WHERE delivery_note_id = ${id}`;
      for (const item of items) {
        await db`
          INSERT INTO delivery_note_items (id, delivery_note_id, product_name, description, quantity, unit)
          VALUES (${item.id || db`gen_random_uuid()`}, ${id}, ${item.productName}, ${item.description || null}, ${item.quantity}, ${item.unit})
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
    return parseInt(result[0].count, 10);
  },

  async generateNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const result = await db`
      SELECT COUNT(*) FROM delivery_notes WHERE EXTRACT(YEAR FROM created_at) = ${year}
    `;
    const count = parseInt(result[0].count, 10) + 1;
    return `DEL-${year}-${String(count).padStart(5, "0")}`;
  },

  async findByCompany(companyId: string): Promise<DeliveryNote[]> {
    const result = await db`
      SELECT * FROM delivery_notes WHERE company_id = ${companyId} ORDER BY created_at DESC
    `;
    return Promise.all(
      result.map(async (row) => {
        const items = await db`SELECT * FROM delivery_note_items WHERE delivery_note_id = ${row.id}`;
        return mapDeliveryNote(row, items);
      })
    );
  },

  async findByStatus(status: DeliveryNoteStatus): Promise<DeliveryNote[]> {
    const result = await db`
      SELECT * FROM delivery_notes WHERE status = ${status} ORDER BY created_at DESC
    `;
    return Promise.all(
      result.map(async (row) => {
        const items = await db`SELECT * FROM delivery_note_items WHERE delivery_note_id = ${row.id}`;
        return mapDeliveryNote(row, items);
      })
    );
  },

  async findByInvoice(invoiceId: string): Promise<DeliveryNote[]> {
    const result = await db`
      SELECT * FROM delivery_notes WHERE invoice_id = ${invoiceId} ORDER BY created_at DESC
    `;
    return Promise.all(
      result.map(async (row) => {
        const items = await db`SELECT * FROM delivery_note_items WHERE delivery_note_id = ${row.id}`;
        return mapDeliveryNote(row, items);
      })
    );
  },

  async markDelivered(id: string): Promise<DeliveryNote> {
    return deliveryNoteQueries.update(id, {
      status: "delivered",
      deliveryDate: new Date().toISOString(),
    });
  },

  async getPending(): Promise<DeliveryNote[]> {
    const result = await db`
      SELECT * FROM delivery_notes
      WHERE status = 'pending'
      ORDER BY created_at ASC
    `;
    return Promise.all(
      result.map(async (row) => {
        const items = await db`SELECT * FROM delivery_note_items WHERE delivery_note_id = ${row.id}`;
        return mapDeliveryNote(row, items);
      })
    );
  },

  async getInTransit(): Promise<DeliveryNote[]> {
    const result = await db`
      SELECT * FROM delivery_notes
      WHERE status = 'in_transit'
      ORDER BY ship_date ASC
    `;
    return Promise.all(
      result.map(async (row) => {
        const items = await db`SELECT * FROM delivery_note_items WHERE delivery_note_id = ${row.id}`;
        return mapDeliveryNote(row, items);
      })
    );
  },
};

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
  };
}

function mapDeliveryNote(row: Record<string, unknown>, items: unknown[]): DeliveryNote {
  return {
    id: row.id as string,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
    deliveryNumber: row.delivery_number as string,
    invoiceId: row.invoice_id as string | undefined,
    companyId: row.company_id as string,
    contactId: row.contact_id as string | undefined,
    status: row.status as DeliveryNoteStatus,
    shipDate: row.ship_date ? (row.ship_date as Date).toISOString() : undefined,
    deliveryDate: row.delivery_date ? (row.delivery_date as Date).toISOString() : undefined,
    items: (items as Record<string, unknown>[]).map(mapDeliveryNoteItem),
    shippingAddress: row.shipping_address as string,
    trackingNumber: row.tracking_number as string | undefined,
    carrier: row.carrier as string | undefined,
    notes: row.notes as string | undefined,
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

