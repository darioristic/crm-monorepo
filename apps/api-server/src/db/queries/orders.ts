import type {
    Order,
    CreateOrderRequest,
    UpdateOrderRequest,
    PaginationParams,
    FilterParams,
    ApiResponse,
} from "@crm/types";
import { sql as db } from "../client";
import { successResponse } from "@crm/utils";
import {
	createQueryBuilder,
	sanitizeSortColumn,
	sanitizeSortOrder,
	type QueryParam,
} from "../query-builder";

function mapOrder(row: any): Order {
	return {
		id: row.id,
		orderNumber: row.order_number,
		companyId: row.company_id,
		contactId: row.contact_id,
		quoteId: row.quote_id,
		invoiceId: row.invoice_id,
		status: row.status,
		subtotal: parseFloat(row.subtotal || 0),
		tax: parseFloat(row.tax || 0),
		total: parseFloat(row.total || 0),
		currency: row.currency,
		notes: row.notes,
		createdBy: row.created_by,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export const orderQueries = {
    async findAll(
        companyId: string | null,
        pagination: PaginationParams,
        filters: FilterParams,
    ): Promise<ApiResponse<Order[]>> {
		try {
			const { page = 1, pageSize = 20 } = pagination;

			const safePage = Math.max(1, Math.floor(page));
			const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
			const safeOffset = (safePage - 1) * safePageSize;

			// Koristi query builder za sigurne upite
			const qb = createQueryBuilder("orders");
			// Only filter by companyId if provided (admin can see all)
			if (companyId) {
			qb.addEqualCondition("company_id", companyId);
			}
			qb.addSearchCondition(["order_number"], filters.search);
			qb.addEqualCondition("status", filters.status);

			const { clause: whereClause, values: whereValues } = qb.buildWhereClause();

			// Count query
			const countQuery = `SELECT COUNT(*) FROM orders ${whereClause}`;
			const countResult = await db.unsafe(
				countQuery,
				whereValues as QueryParam[],
			);
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
			console.error("Error in orderQueries.findAll:", error);
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

	async findById(id: string): Promise<Order | null> {
		const result = await db`SELECT * FROM orders WHERE id = ${id}`;
		return result.length > 0 ? mapOrder(result[0]) : null;
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
	): Promise<{ success: boolean; data?: Order; error?: { code: string; message: string } }> {
		try {
			// Generate order number if not provided
			const orderNumber = order.orderNumber || `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

			const result = await db`
        INSERT INTO orders (
          id, order_number, company_id, contact_id, quote_id, invoice_id,
          status, subtotal, tax, total, currency, notes, created_by,
          created_at, updated_at
        ) VALUES (
          gen_random_uuid(), ${orderNumber}, ${order.companyId},
          ${order.contactId || null}, ${order.quoteId || null}, ${order.invoiceId || null},
          ${order.status}, ${order.subtotal}, ${order.tax}, ${order.total},
          ${order.currency}, ${order.notes || null}, ${order.createdBy},
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
			console.error("Error in orderQueries.create:", error);
			return {
				success: false,
				error: {
					code: "DATABASE_ERROR",
					message: error instanceof Error ? error.message : "Failed to create order",
				},
			};
		}
	},

	async update(id: string, order: UpdateOrderRequest): Promise<{ success: boolean; data?: Order; error?: { code: string; message: string } }> {
		try {
			const updates: string[] = [];
			const values: QueryParam[] = [];
			let paramIndex = 1;

			if (order.status !== undefined) {
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
			console.error("Error in orderQueries.update:", error);
			return {
				success: false,
				error: {
					code: "DATABASE_ERROR",
					message: error instanceof Error ? error.message : "Failed to update order",
				},
			};
		}
	},

	async delete(id: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
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
			console.error("Error in orderQueries.delete:", error);
			return {
				success: false,
				error: {
					code: "DATABASE_ERROR",
					message: error instanceof Error ? error.message : "Failed to delete order",
				},
			};
		}
	},
};
