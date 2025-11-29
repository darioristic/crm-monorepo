import type {
	Payment,
	PaymentWithInvoice,
	PaymentSummary,
	PaymentStatus,
	PaymentMethod,
	CreatePaymentRequest,
	UpdatePaymentRequest,
	PaginationParams,
} from "@crm/types";
import { generateUUID, now } from "@crm/utils";
import db from "../client";

// ============================================
// Payment Queries
// ============================================

export const paymentQueries = {
	async findAll(
		pagination: PaginationParams = {},
		filters: {
			invoiceId?: string;
			status?: PaymentStatus;
			paymentMethod?: PaymentMethod;
			dateFrom?: string;
			dateTo?: string;
			recordedBy?: string;
		} = {},
	): Promise<{ payments: PaymentWithInvoice[]; total: number }> {
		const page = pagination.page || 1;
		const pageSize = pagination.pageSize || 20;
		const offset = (page - 1) * pageSize;

		let whereClause = "WHERE 1=1";

		if (filters.invoiceId) {
			whereClause += ` AND p.invoice_id = '${filters.invoiceId}'`;
		}

		if (filters.status) {
			whereClause += ` AND p.status = '${filters.status}'`;
		}

		if (filters.paymentMethod) {
			whereClause += ` AND p.payment_method = '${filters.paymentMethod}'`;
		}

		if (filters.dateFrom) {
			whereClause += ` AND p.payment_date >= '${filters.dateFrom}'`;
		}

		if (filters.dateTo) {
			whereClause += ` AND p.payment_date <= '${filters.dateTo}'`;
		}

		if (filters.recordedBy) {
			whereClause += ` AND p.recorded_by = '${filters.recordedBy}'`;
		}

		const countResult = await db.unsafe(`
			SELECT COUNT(*) as total FROM payments p ${whereClause}
		`);
		const total = Number(countResult[0]?.total || 0);

		const payments = await db.unsafe(`
			SELECT 
				p.id, p.invoice_id as "invoiceId", p.amount, p.currency,
				p.payment_method as "paymentMethod", p.status,
				p.payment_date as "paymentDate", p.reference, p.transaction_id as "transactionId",
				p.notes, p.metadata, p.recorded_by as "recordedBy",
				p.created_at as "createdAt", p.updated_at as "updatedAt",
				i.invoice_number as "invoiceNumber", i.company_id as "companyId"
			FROM payments p
			LEFT JOIN invoices i ON p.invoice_id = i.id
			${whereClause}
			ORDER BY p.payment_date DESC
			LIMIT ${pageSize} OFFSET ${offset}
		`);

		return { payments: payments.map(mapPayment), total };
	},

	async findById(id: string): Promise<PaymentWithInvoice | null> {
		const result = await db<(Payment & { invoiceNumber?: string; companyId?: string })[]>`
			SELECT 
				p.id, p.invoice_id as "invoiceId", p.amount, p.currency,
				p.payment_method as "paymentMethod", p.status,
				p.payment_date as "paymentDate", p.reference, p.transaction_id as "transactionId",
				p.notes, p.metadata, p.recorded_by as "recordedBy",
				p.created_at as "createdAt", p.updated_at as "updatedAt",
				i.invoice_number as "invoiceNumber", i.company_id as "companyId"
			FROM payments p
			LEFT JOIN invoices i ON p.invoice_id = i.id
			WHERE p.id = ${id}
		`;

		return result[0] ? mapPayment(result[0]) : null;
	},

	async findByInvoice(invoiceId: string): Promise<Payment[]> {
		const result = await db<Payment[]>`
			SELECT 
				id, invoice_id as "invoiceId", amount, currency,
				payment_method as "paymentMethod", status,
				payment_date as "paymentDate", reference, transaction_id as "transactionId",
				notes, metadata, recorded_by as "recordedBy",
				created_at as "createdAt", updated_at as "updatedAt"
			FROM payments
			WHERE invoice_id = ${invoiceId}
			ORDER BY payment_date DESC
		`;

		return result.map(mapPayment);
	},

	async create(data: CreatePaymentRequest, recordedBy: string): Promise<Payment> {
		const id = generateUUID();
		const timestamp = now();

		const result = await db<Payment[]>`
			INSERT INTO payments (
				id, invoice_id, amount, currency, payment_method, status,
				payment_date, reference, transaction_id, notes, metadata,
				recorded_by, created_at, updated_at
			) VALUES (
				${id}, ${data.invoiceId}, ${data.amount}, ${data.currency || "EUR"},
				${data.paymentMethod}::payment_method, 'completed'::payment_status,
				${data.paymentDate || timestamp}, ${data.reference || null},
				${data.transactionId || null}, ${data.notes || null},
				${data.metadata ? JSON.stringify(data.metadata) : null},
				${recordedBy}, ${timestamp}, ${timestamp}
			)
			RETURNING 
				id, invoice_id as "invoiceId", amount, currency,
				payment_method as "paymentMethod", status,
				payment_date as "paymentDate", reference, transaction_id as "transactionId",
				notes, metadata, recorded_by as "recordedBy",
				created_at as "createdAt", updated_at as "updatedAt"
		`;

		return mapPayment(result[0]);
	},

	async update(id: string, data: UpdatePaymentRequest): Promise<Payment | null> {
		const existing = await this.findById(id);
		if (!existing) return null;

		const result = await db<Payment[]>`
			UPDATE payments SET
				status = COALESCE(${data.status || null}::payment_status, status),
				payment_method = COALESCE(${data.paymentMethod || null}::payment_method, payment_method),
				reference = COALESCE(${data.reference || null}, reference),
				transaction_id = COALESCE(${data.transactionId || null}, transaction_id),
				notes = COALESCE(${data.notes || null}, notes),
				metadata = COALESCE(${data.metadata ? JSON.stringify(data.metadata) : null}::jsonb, metadata),
				updated_at = ${now()}
			WHERE id = ${id}
			RETURNING 
				id, invoice_id as "invoiceId", amount, currency,
				payment_method as "paymentMethod", status,
				payment_date as "paymentDate", reference, transaction_id as "transactionId",
				notes, metadata, recorded_by as "recordedBy",
				created_at as "createdAt", updated_at as "updatedAt"
		`;

		return result[0] ? mapPayment(result[0]) : null;
	},

	async delete(id: string): Promise<boolean> {
		const result = await db`
			DELETE FROM payments WHERE id = ${id}
		`;

		return result.count > 0;
	},

	async refund(id: string): Promise<Payment | null> {
		return this.update(id, { status: "refunded" });
	},

	async getInvoicePaymentSummary(invoiceId: string): Promise<PaymentSummary> {
		const result = await db`
			SELECT 
				COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as "totalPaid",
				COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as "totalPending",
				COALESCE(SUM(CASE WHEN status = 'refunded' THEN amount ELSE 0 END), 0) as "totalRefunded",
				COUNT(*) as "paymentCount",
				COALESCE(MAX(currency), 'EUR') as currency
			FROM payments
			WHERE invoice_id = ${invoiceId}
		`;

		return {
			totalPaid: parseFloat(result[0]?.totalPaid || "0"),
			totalPending: parseFloat(result[0]?.totalPending || "0"),
			totalRefunded: parseFloat(result[0]?.totalRefunded || "0"),
			paymentCount: Number(result[0]?.paymentCount || 0),
			currency: result[0]?.currency || "EUR",
		};
	},

	async getPaymentStats(filters: { dateFrom?: string; dateTo?: string } = {}): Promise<{
		totalAmount: number;
		paymentCount: number;
		byMethod: { method: PaymentMethod; amount: number; count: number }[];
		byStatus: { status: PaymentStatus; amount: number; count: number }[];
	}> {
		let whereClause = "WHERE 1=1";

		if (filters.dateFrom) {
			whereClause += ` AND payment_date >= '${filters.dateFrom}'`;
		}

		if (filters.dateTo) {
			whereClause += ` AND payment_date <= '${filters.dateTo}'`;
		}

		const totalsResult = await db.unsafe(`
			SELECT 
				COALESCE(SUM(amount), 0) as "totalAmount",
				COUNT(*) as "paymentCount"
			FROM payments ${whereClause}
		`);

		const byMethodResult = await db.unsafe(`
			SELECT 
				payment_method as method,
				COALESCE(SUM(amount), 0) as amount,
				COUNT(*) as count
			FROM payments ${whereClause}
			GROUP BY payment_method
		`);

		const byStatusResult = await db.unsafe(`
			SELECT 
				status,
				COALESCE(SUM(amount), 0) as amount,
				COUNT(*) as count
			FROM payments ${whereClause}
			GROUP BY status
		`);

		return {
			totalAmount: parseFloat(totalsResult[0]?.totalAmount || "0"),
			paymentCount: Number(totalsResult[0]?.paymentCount || 0),
			byMethod: byMethodResult.map((r: Record<string, unknown>) => ({
				method: r.method as PaymentMethod,
				amount: parseFloat(r.amount as string || "0"),
				count: Number(r.count || 0),
			})),
			byStatus: byStatusResult.map((r: Record<string, unknown>) => ({
				status: r.status as PaymentStatus,
				amount: parseFloat(r.amount as string || "0"),
				count: Number(r.count || 0),
			})),
		};
	},
};

// ============================================
// Mapping Function
// ============================================

function mapPayment(row: Record<string, unknown>): Payment {
	return {
		id: row.id as string,
		invoiceId: row.invoiceId as string,
		amount: typeof row.amount === "string" ? parseFloat(row.amount) : (row.amount as number),
		currency: row.currency as string,
		paymentMethod: row.paymentMethod as PaymentMethod,
		status: row.status as PaymentStatus,
		paymentDate: row.paymentDate instanceof Date 
			? row.paymentDate.toISOString() 
			: row.paymentDate as string,
		reference: row.reference as string | undefined,
		transactionId: row.transactionId as string | undefined,
		notes: row.notes as string | undefined,
		metadata: row.metadata as Record<string, unknown> | undefined,
		recordedBy: row.recordedBy as string,
		createdAt: row.createdAt instanceof Date 
			? row.createdAt.toISOString() 
			: row.createdAt as string,
		updatedAt: row.updatedAt instanceof Date 
			? row.updatedAt.toISOString() 
			: row.updatedAt as string,
	};
}

export default paymentQueries;

