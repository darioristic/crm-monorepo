import type {
  ApiResponse,
  Company,
  CreateOrderRequest,
  FilterParams,
  Order,
  PaginationParams,
  UpdateOrderRequest,
} from "@crm/types";
import { successResponse } from "@crm/utils";
import { logger } from "../../lib/logger";
import { sql as db } from "../client";
import {
  createQueryBuilder,
  type QueryParam,
  sanitizeSortColumn,
  sanitizeSortOrder,
} from "../query-builder";
import { companyQueries } from "./companies";
import { userQueries } from "./users";

const ALLOWED_ORDER_STATUSES = new Set([
  "pending",
  "processing",
  "completed",
  "cancelled",
  "refunded",
]);

function mapOrder(row: Record<string, unknown>): Order {
  let fromDetails = null;
  if (row.from_details) {
    fromDetails =
      typeof row.from_details === "string"
        ? JSON.parse(row.from_details as string)
        : row.from_details;
  }
  let customerDetails = null;
  if (row.customer_details) {
    customerDetails =
      typeof row.customer_details === "string"
        ? JSON.parse(row.customer_details as string)
        : row.customer_details;
  }
  return {
    id: row.id as string,
    orderNumber: row.order_number as string,
    companyId: row.company_id as string,
    contactId: row.contact_id as string,
    quoteId: row.quote_id as string | null,
    invoiceId: row.invoice_id as string | null,
    status: row.status as Order["status"],
    subtotal: parseFloat((row.subtotal as string) || "0"),
    tax: parseFloat((row.tax as string) || "0"),
    total: parseFloat((row.total as string) || "0"),
    currency: row.currency as string,
    notes: row.notes as string | null,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    fromDetails,
    customerDetails,
  };
}

type OrderItemSummary = {
  productName: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
};

export const orderQueries = {
  async findAll(
    companyId: string | null,
    pagination: PaginationParams,
    filters: FilterParams
  ): Promise<ApiResponse<Order[]>> {
    try {
      const { page = 1, pageSize = 20 } = pagination;

      const safePage = Math.max(1, Math.floor(page));
      const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
      const safeOffset = (safePage - 1) * safePageSize;

      // Koristi query builder za sigurne upite
      const qb = createQueryBuilder("orders");
      // Filter by tenant_id (orders created by this tenant)
      // Note: companyId parameter actually represents tenant ID in multi-tenant architecture
      if (companyId) {
        qb.addEqualCondition("tenant_id", companyId);
      }
      qb.addSearchCondition(["order_number"], filters.search);
      qb.addEqualCondition("status", filters.status);
      const createdBy = (filters as { createdBy?: string }).createdBy;
      if (createdBy) {
        qb.addEqualCondition("created_by", createdBy);
      }

      const { clause: whereClause, values: whereValues } = qb.buildWhereClause();

      // Count query
      const countQuery = `SELECT COUNT(*) FROM orders ${whereClause}`;
      const countResult = await db.unsafe(countQuery, whereValues as QueryParam[]);
      const total = parseInt(countResult[0].count, 10);

      // Sort
      const sortBy = sanitizeSortColumn("orders", pagination.sortBy || "created_at");
      const sortOrder = sanitizeSortOrder(pagination.sortOrder || "desc");

      // Select query
      const selectQuery = `
        SELECT * FROM orders
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT $${whereValues.length + 1} OFFSET $${whereValues.length + 2}
      `;

      const data = await db.unsafe(selectQuery, [
        ...whereValues,
        safePageSize,
        safeOffset,
      ] as QueryParam[]);

      const orders = data.map(mapOrder);

      return successResponse(orders, {
        page: safePage,
        pageSize: safePageSize,
        totalCount: total,
        totalPages: Math.ceil(total / safePageSize),
      });
    } catch (error) {
      logger.error({ error }, "Error in orderQueries.findAll");
      return {
        success: false,
        error: {
          code: "DATABASE_ERROR",
          message: error instanceof Error ? error.message : "Failed to fetch orders",
        },
      };
    }
  },

  async findByCompany(companyId: string): Promise<Order[]> {
    const result = await db`
      SELECT * FROM orders
      WHERE company_id = ${companyId}
      ORDER BY created_at DESC
    `;
    return result.map(mapOrder);
  },

  async findById(id: string): Promise<
    | (Order & {
        items?: OrderItemSummary[];
        company?: Company | null;
        companyName?: string | null;
      })
    | null
  > {
    const result = await db`SELECT * FROM orders WHERE id = ${id}`;
    if (result.length === 0) {
      return null;
    }
    const base = mapOrder(result[0]);
    const itemsRows = await db`
            SELECT product_name, description, quantity, unit_price, discount, total
            FROM order_items WHERE order_id = ${id}
        `;
    const items = itemsRows.map((row: Record<string, unknown>) => ({
      productName: row.product_name as string,
      description: (row.description as string) || null,
      quantity:
        typeof row.quantity === "number" ? row.quantity : parseFloat(row.quantity as string),
      unitPrice:
        typeof row.unit_price === "number" ? row.unit_price : parseFloat(row.unit_price as string),
      discount:
        row.discount == null
          ? 0
          : typeof row.discount === "number"
            ? row.discount
            : parseFloat(row.discount as string),
      total: typeof row.total === "number" ? row.total : parseFloat(row.total as string),
    }));
    const company = await companyQueries.findById(base.companyId);
    return { ...base, items, company, companyName: company?.name || null };
  },

  async create(
    order: CreateOrderRequest & { createdBy: string },
    items?: Array<{
      productName: string;
      description?: string | null;
      quantity: number;
      unitPrice: number;
      discount?: number;
      total: number;
    }>
  ): Promise<{
    success: boolean;
    data?: Order;
    error?: { code: string; message: string };
  }> {
    try {
      if (!ALLOWED_ORDER_STATUSES.has(order.status as string)) {
        return {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: `Invalid order status: ${String(order.status)}`,
          },
        };
      }
      // Generate sequential order number
      const orderNumber = await this.generateNumber();

      const userCompanyId =
        order.sellerCompanyId ?? (await userQueries.getUserCompanyId(order.createdBy));
      const sellerCompany = userCompanyId ? await companyQueries.findById(userCompanyId) : null;
      const sellerLines: string[] = [];
      if (sellerCompany?.name) sellerLines.push(sellerCompany.name);
      if (sellerCompany?.address) sellerLines.push(sellerCompany.address);
      const sellerCityLine = [sellerCompany?.city, sellerCompany?.zip, sellerCompany?.country]
        .filter(Boolean)
        .join(", ");
      if (sellerCityLine) sellerLines.push(sellerCityLine);
      if (sellerCompany?.email) sellerLines.push(sellerCompany.email);
      if (sellerCompany?.phone) sellerLines.push(sellerCompany.phone);
      if (sellerCompany?.website) sellerLines.push(sellerCompany.website);
      if (sellerCompany?.vatNumber) sellerLines.push(`PIB: ${sellerCompany.vatNumber}`);
      const builtFromDetails =
        sellerLines.length > 0
          ? {
              type: "doc",
              content: sellerLines.map((line) => ({
                type: "paragraph",
                content: [{ type: "text", text: line }],
              })),
            }
          : null;

      const customerCompany = await companyQueries.findById(order.companyId);
      const customerLines: string[] = [];
      if (customerCompany?.name) customerLines.push(customerCompany.name);
      if (customerCompany?.address) customerLines.push(customerCompany.address);
      const customerCityLine = [
        customerCompany?.city,
        customerCompany?.zip,
        customerCompany?.country,
      ]
        .filter(Boolean)
        .join(", ");
      if (customerCityLine) customerLines.push(customerCityLine);
      if (customerCompany?.email) customerLines.push(customerCompany.email);
      if (customerCompany?.phone) customerLines.push(customerCompany.phone);
      if (customerCompany?.vatNumber) customerLines.push(`PIB: ${customerCompany.vatNumber}`);
      const builtCustomerDetails =
        customerLines.length > 0
          ? {
              type: "doc",
              content: customerLines.map((line) => ({
                type: "paragraph",
                content: [{ type: "text", text: line }],
              })),
            }
          : null;

      // Note: order.sellerCompanyId from service actually contains tenant_id
      const result = await db`
            INSERT INTO orders (
          id, order_number, company_id, tenant_id, contact_id, quote_id, invoice_id,
          status, subtotal, tax, total, currency, notes, from_details, customer_details, created_by,
          created_at, updated_at
        ) VALUES (
          gen_random_uuid(), ${orderNumber}, ${order.companyId}, ${(order as { sellerCompanyId?: string }).sellerCompanyId || null},
          ${order.contactId || null}, ${order.quoteId || null}, ${order.invoiceId || null},
          ${order.status}, ${order.subtotal}, ${order.tax}, ${order.total},
          ${order.currency}, ${order.notes || null}, ${builtFromDetails ? JSON.stringify(builtFromDetails) : null}, ${builtCustomerDetails ? JSON.stringify(builtCustomerDetails) : null}, ${order.createdBy},
          NOW(), NOW()
        )
        RETURNING *
      `;

      const orderId = result[0].id;

      // Insert items if provided
      if (items && items.length > 0) {
        for (const item of items) {
          await db`
            INSERT INTO order_items (order_id, product_name, description, quantity, unit_price, discount, total)
            VALUES (${orderId}, ${item.productName}, ${item.description || null}, ${item.quantity}, ${item.unitPrice}, ${item.discount || 0}, ${item.total})
          `;
        }
      }

      return successResponse(mapOrder(result[0]));
    } catch (error) {
      logger.error({ error }, "Error in orderQueries.create");
      return {
        success: false,
        error: {
          code: "DATABASE_ERROR",
          message: error instanceof Error ? error.message : "Failed to create order",
        },
      };
    }
  },

  async update(
    id: string,
    order: UpdateOrderRequest
  ): Promise<{
    success: boolean;
    data?: Order;
    error?: { code: string; message: string };
  }> {
    try {
      const updates: string[] = [];
      const values: QueryParam[] = [];
      let paramIndex = 1;

      if (order.status !== undefined) {
        if (!ALLOWED_ORDER_STATUSES.has(order.status as string)) {
          return {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: `Invalid order status: ${String(order.status)}`,
            },
          };
        }
        updates.push(`status = $${paramIndex}`);
        values.push(order.status);
        paramIndex++;
      }
      if (order.subtotal !== undefined) {
        updates.push(`subtotal = $${paramIndex}`);
        values.push(order.subtotal);
        paramIndex++;
      }
      if (order.tax !== undefined) {
        updates.push(`tax = $${paramIndex}`);
        values.push(order.tax);
        paramIndex++;
      }
      if (order.total !== undefined) {
        updates.push(`total = $${paramIndex}`);
        values.push(order.total);
        paramIndex++;
      }
      if (order.currency !== undefined) {
        updates.push(`currency = $${paramIndex}`);
        values.push(order.currency);
        paramIndex++;
      }
      if (order.notes !== undefined) {
        updates.push(`notes = $${paramIndex}`);
        values.push(order.notes);
        paramIndex++;
      }
      const fromDetails = (order as { fromDetails?: unknown }).fromDetails;
      if (fromDetails !== undefined) {
        updates.push(`from_details = $${paramIndex}`);
        values.push(fromDetails ? JSON.stringify(fromDetails as unknown) : null);
        paramIndex++;
      }
      const customerDetails = (order as { customerDetails?: unknown }).customerDetails;
      if (customerDetails !== undefined) {
        updates.push(`customer_details = $${paramIndex}`);
        values.push(customerDetails ? JSON.stringify(customerDetails as unknown) : null);
        paramIndex++;
      }
      if (order.contactId !== undefined) {
        updates.push(`contact_id = $${paramIndex}`);
        values.push(order.contactId);
        paramIndex++;
      }
      if (order.quoteId !== undefined) {
        updates.push(`quote_id = $${paramIndex}`);
        values.push(order.quoteId);
        paramIndex++;
      }
      if (order.invoiceId !== undefined) {
        updates.push(`invoice_id = $${paramIndex}`);
        values.push(order.invoiceId);
        paramIndex++;
      }

      if (updates.length === 0) {
        // No updates, just return the existing order
        const existing = await this.findById(id);
        if (!existing) {
          return {
            success: false,
            error: { code: "NOT_FOUND", message: "Order not found" },
          };
        }
        return successResponse(existing);
      }

      updates.push(`updated_at = NOW()`);
      values.push(id);

      const updateQuery = `
        UPDATE orders
        SET ${updates.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await db.unsafe(updateQuery, values as QueryParam[]);

      if (result.length === 0) {
        return {
          success: false,
          error: { code: "NOT_FOUND", message: "Order not found" },
        };
      }

      return successResponse(mapOrder(result[0]));
    } catch (error) {
      logger.error({ error }, "Error in orderQueries.update");
      return {
        success: false,
        error: {
          code: "DATABASE_ERROR",
          message: error instanceof Error ? error.message : "Failed to update order",
        },
      };
    }
  },

  async delete(
    id: string
  ): Promise<{ success: boolean; error?: { code: string; message: string } }> {
    try {
      const result = await db`
        DELETE FROM orders WHERE id = ${id}
      `;

      if (result.count === 0) {
        return {
          success: false,
          error: { code: "NOT_FOUND", message: "Order not found" },
        };
      }

      return { success: true };
    } catch (error) {
      logger.error({ error }, "Error in orderQueries.delete");
      return {
        success: false,
        error: {
          code: "DATABASE_ERROR",
          message: error instanceof Error ? error.message : "Failed to delete order",
        },
      };
    }
  },

  async generateNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const yearPrefix = `ORD-${year}-`;

    // Get all order numbers for this year
    const result = await db`
      SELECT order_number
      FROM orders
      WHERE order_number LIKE ${`${yearPrefix}%`}
        AND LENGTH(order_number) = ${yearPrefix.length + 5}
      ORDER BY order_number DESC
      LIMIT 100
    `;

    let nextNumber = 1;
    if (result.length > 0) {
      // Extract numeric parts and find the maximum
      const numbers = result
        .map((row) => {
          const orderNumber = row.order_number as string;
          const numericPart = orderNumber.substring(yearPrefix.length);
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
      SELECT id FROM orders WHERE order_number = ${generatedNumber} LIMIT 1
    `;

    if (exists.length > 0) {
      nextNumber += 1;
      return `${yearPrefix}${String(nextNumber).padStart(5, "0")}`;
    }

    return generatedNumber;
  },
};
