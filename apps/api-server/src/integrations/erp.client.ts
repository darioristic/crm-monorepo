import type { Invoice, Quote, Company } from "@crm/types";
import { cache } from "../cache/redis";

// ============================================
// ERP/Bookkeeping Configuration
// ============================================

interface ERPConfig {
	baseUrl: string;
	apiKey: string;
	apiSecret: string;
	timeout: number;
	retries: number;
}

const erpConfig: ERPConfig = {
	baseUrl: process.env.ERP_BASE_URL || "https://api.erp.example.com/v1",
	apiKey: process.env.ERP_API_KEY || "",
	apiSecret: process.env.ERP_API_SECRET || "",
	timeout: parseInt(process.env.ERP_TIMEOUT || "30000", 10),
	retries: parseInt(process.env.ERP_RETRIES || "3", 10),
};

// ============================================
// ERP Types
// ============================================

interface ERPCustomer {
	id: string;
	externalId?: string;
	name: string;
	email?: string;
	phone?: string;
	address?: string;
	taxId?: string;
	createdAt: string;
	updatedAt: string;
}

interface ERPInvoice {
	id: string;
	externalId?: string;
	customerId: string;
	invoiceNumber: string;
	status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
	issueDate: string;
	dueDate: string;
	lineItems: ERPLineItem[];
	subtotal: number;
	taxAmount: number;
	total: number;
	paidAmount: number;
	currency: string;
	notes?: string;
	createdAt: string;
	updatedAt: string;
}

interface ERPLineItem {
	description: string;
	quantity: number;
	unitPrice: number;
	taxRate: number;
	total: number;
}

interface ERPPayment {
	id: string;
	invoiceId: string;
	amount: number;
	paymentDate: string;
	paymentMethod: string;
	reference?: string;
	createdAt: string;
}

interface ERPQuote {
	id: string;
	externalId?: string;
	customerId: string;
	quoteNumber: string;
	status: "draft" | "sent" | "accepted" | "rejected" | "expired";
	validUntil: string;
	lineItems: ERPLineItem[];
	subtotal: number;
	taxAmount: number;
	total: number;
	createdAt: string;
	updatedAt: string;
}

interface ERPResponse<T> {
	success: boolean;
	data?: T;
	error?: {
		code: string;
		message: string;
	};
	meta?: {
		page?: number;
		pageSize?: number;
		total?: number;
	};
}

interface SyncResult {
	success: boolean;
	synced: number;
	failed: number;
	errors: Array<{ id: string; error: string }>;
}

// ============================================
// ERP Client
// ============================================

class ERPClient {
	private config: ERPConfig;
	private enabled: boolean;

	constructor() {
		this.config = erpConfig;
		this.enabled = !!this.config.apiKey && !!this.config.apiSecret;

		if (!this.enabled) {
			console.log(
				"🔌 ERP integration disabled (no API credentials configured)",
			);
		}
	}

	// ============================================
	// HTTP Methods
	// ============================================

	private async request<T>(
		method: string,
		endpoint: string,
		body?: unknown,
		retryCount = 0,
	): Promise<ERPResponse<T>> {
		if (!this.enabled) {
			console.log(`🔌 [DEV] ERP ${method} ${endpoint}`);
			return { success: true, data: undefined };
		}

		try {
			const url = `${this.config.baseUrl}${endpoint}`;
			const headers: Record<string, string> = {
				"Content-Type": "application/json",
				"X-API-Key": this.config.apiKey,
				"X-API-Secret": this.config.apiSecret,
				"X-Request-ID": `crm-${Date.now()}-${Math.random().toString(36).substring(7)}`,
			};

			const controller = new AbortController();
			const timeoutId = setTimeout(
				() => controller.abort(),
				this.config.timeout,
			);

			const response = await fetch(url, {
				method,
				headers,
				body: body ? JSON.stringify(body) : undefined,
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				const error = await response
					.json()
					.catch(() => ({ message: response.statusText }));
				throw new Error(error.message || `HTTP ${response.status}`);
			}

			const data = await response.json();
			return { success: true, data };
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error(`ERP request failed: ${method} ${endpoint}`, errorMessage);

			// Retry logic
			if (retryCount < this.config.retries && this.isRetryableError(error)) {
				console.log(
					`Retrying ERP request (${retryCount + 1}/${this.config.retries})...`,
				);
				await this.delay(1000 * (retryCount + 1)); // Exponential backoff
				return this.request<T>(method, endpoint, body, retryCount + 1);
			}

			return {
				success: false,
				error: { code: "ERP_ERROR", message: errorMessage },
			};
		}
	}

	private isRetryableError(error: unknown): boolean {
		if (error instanceof Error) {
			const message = error.message.toLowerCase();
			return (
				message.includes("timeout") ||
				message.includes("network") ||
				message.includes("connection") ||
				message.includes("503") ||
				message.includes("502") ||
				message.includes("504")
			);
		}
		return false;
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	// ============================================
	// Customer Operations
	// ============================================

	async createCustomer(company: Company): Promise<ERPResponse<ERPCustomer>> {
		const lockKey = `erp-customer-${company.id}`;
		const lock = await cache.acquireLock(lockKey, 30);

		if (!lock) {
			return {
				success: false,
				error: { code: "LOCKED", message: "Operation in progress" },
			};
		}

		try {
			const result = await this.request<ERPCustomer>("POST", "/customers", {
				externalId: company.id,
				name: company.name,
				address: company.address,
			});

			if (result.success && result.data) {
				// Cache the mapping
				await cache.set(`erp:customer:${company.id}`, result.data.id, 86400);
			}

			return result;
		} finally {
			await cache.releaseLock(lockKey, lock);
		}
	}

	async getCustomer(customerId: string): Promise<ERPResponse<ERPCustomer>> {
		// Check cache first
		const cached = await cache.get<ERPCustomer>(
			`erp:customer:detail:${customerId}`,
		);
		if (cached) {
			return { success: true, data: cached };
		}

		const result = await this.request<ERPCustomer>(
			"GET",
			`/customers/${customerId}`,
		);

		if (result.success && result.data) {
			await cache.set(`erp:customer:detail:${customerId}`, result.data, 3600);
		}

		return result;
	}

	async updateCustomer(
		customerId: string,
		company: Partial<Company>,
	): Promise<ERPResponse<ERPCustomer>> {
		const result = await this.request<ERPCustomer>(
			"PUT",
			`/customers/${customerId}`,
			{
				name: company.name,
				address: company.address,
			},
		);

		if (result.success) {
			await cache.del(`erp:customer:detail:${customerId}`);
		}

		return result;
	}

	async findCustomerByExternalId(companyId: string): Promise<string | null> {
		// Check cache
		const cached = await cache.get<string>(`erp:customer:${companyId}`);
		if (cached) return cached;

		const result = await this.request<ERPCustomer[]>(
			"GET",
			`/customers?externalId=${companyId}`,
		);

		if (result.success && result.data && result.data.length > 0) {
			const erpCustomerId = result.data[0].id;
			await cache.set(`erp:customer:${companyId}`, erpCustomerId, 86400);
			return erpCustomerId;
		}

		return null;
	}

	// ============================================
	// Invoice Operations
	// ============================================

	async createInvoice(
		invoice: Invoice,
		erpCustomerId: string,
	): Promise<ERPResponse<ERPInvoice>> {
		const lockKey = `erp-invoice-${invoice.id}`;
		const lock = await cache.acquireLock(lockKey, 60);

		if (!lock) {
			return {
				success: false,
				error: { code: "LOCKED", message: "Operation in progress" },
			};
		}

		try {
			const result = await this.request<ERPInvoice>("POST", "/invoices", {
				externalId: invoice.id,
				customerId: erpCustomerId,
				invoiceNumber: invoice.invoiceNumber,
				status: this.mapInvoiceStatus(invoice.status),
				issueDate: invoice.issueDate,
				dueDate: invoice.dueDate,
				lineItems: invoice.items.map((item) => ({
					description: item.productName,
					quantity: item.quantity,
					unitPrice: item.unitPrice,
					taxRate: invoice.taxRate,
					total: item.total,
				})),
				subtotal: invoice.subtotal,
				taxAmount: invoice.tax,
				total: invoice.total,
				paidAmount: invoice.paidAmount,
				currency: "USD",
				notes: invoice.notes,
			});

			if (result.success && result.data) {
				await cache.set(`erp:invoice:${invoice.id}`, result.data.id, 86400);
			}

			return result;
		} finally {
			await cache.releaseLock(lockKey, lock);
		}
	}

	async getInvoice(erpInvoiceId: string): Promise<ERPResponse<ERPInvoice>> {
		const cached = await cache.get<ERPInvoice>(
			`erp:invoice:detail:${erpInvoiceId}`,
		);
		if (cached) {
			return { success: true, data: cached };
		}

		const result = await this.request<ERPInvoice>(
			"GET",
			`/invoices/${erpInvoiceId}`,
		);

		if (result.success && result.data) {
			await cache.set(`erp:invoice:detail:${erpInvoiceId}`, result.data, 1800);
		}

		return result;
	}

	async updateInvoice(
		erpInvoiceId: string,
		updates: Partial<Invoice>,
	): Promise<ERPResponse<ERPInvoice>> {
		const result = await this.request<ERPInvoice>(
			"PUT",
			`/invoices/${erpInvoiceId}`,
			{
				status: updates.status
					? this.mapInvoiceStatus(updates.status)
					: undefined,
				paidAmount: updates.paidAmount,
				notes: updates.notes,
			},
		);

		if (result.success) {
			await cache.del(`erp:invoice:detail:${erpInvoiceId}`);
		}

		return result;
	}

	async recordPayment(
		erpInvoiceId: string,
		amount: number,
		paymentMethod = "bank_transfer",
		reference?: string,
	): Promise<ERPResponse<ERPPayment>> {
		return this.request<ERPPayment>(
			"POST",
			`/invoices/${erpInvoiceId}/payments`,
			{
				amount,
				paymentDate: new Date().toISOString(),
				paymentMethod,
				reference,
			},
		);
	}

	async findInvoiceByExternalId(invoiceId: string): Promise<string | null> {
		const cached = await cache.get<string>(`erp:invoice:${invoiceId}`);
		if (cached) return cached;

		const result = await this.request<ERPInvoice[]>(
			"GET",
			`/invoices?externalId=${invoiceId}`,
		);

		if (result.success && result.data && result.data.length > 0) {
			const erpInvoiceId = result.data[0].id;
			await cache.set(`erp:invoice:${invoiceId}`, erpInvoiceId, 86400);
			return erpInvoiceId;
		}

		return null;
	}

	// ============================================
	// Quote Operations
	// ============================================

	async createQuote(
		quote: Quote,
		erpCustomerId: string,
	): Promise<ERPResponse<ERPQuote>> {
		const lockKey = `erp-quote-${quote.id}`;
		const lock = await cache.acquireLock(lockKey, 60);

		if (!lock) {
			return {
				success: false,
				error: { code: "LOCKED", message: "Operation in progress" },
			};
		}

		try {
			const result = await this.request<ERPQuote>("POST", "/quotes", {
				externalId: quote.id,
				customerId: erpCustomerId,
				quoteNumber: quote.quoteNumber,
				status: this.mapQuoteStatus(quote.status),
				validUntil: quote.validUntil,
				lineItems: quote.items.map((item) => ({
					description: item.productName,
					quantity: item.quantity,
					unitPrice: item.unitPrice,
					taxRate: quote.taxRate,
					total: item.total,
				})),
				subtotal: quote.subtotal,
				taxAmount: quote.tax,
				total: quote.total,
			});

			if (result.success && result.data) {
				await cache.set(`erp:quote:${quote.id}`, result.data.id, 86400);
			}

			return result;
		} finally {
			await cache.releaseLock(lockKey, lock);
		}
	}

	async updateQuote(
		erpQuoteId: string,
		updates: Partial<Quote>,
	): Promise<ERPResponse<ERPQuote>> {
		const result = await this.request<ERPQuote>(
			"PUT",
			`/quotes/${erpQuoteId}`,
			{
				status: updates.status
					? this.mapQuoteStatus(updates.status)
					: undefined,
				validUntil: updates.validUntil,
			},
		);

		if (result.success) {
			await cache.del(`erp:quote:detail:${erpQuoteId}`);
		}

		return result;
	}

	// ============================================
	// Sync Operations
	// ============================================

	async syncInvoices(invoices: Invoice[]): Promise<SyncResult> {
		const result: SyncResult = {
			success: true,
			synced: 0,
			failed: 0,
			errors: [],
		};

		for (const invoice of invoices) {
			try {
				// Find or create customer
				const erpCustomerId = await this.findCustomerByExternalId(
					invoice.companyId,
				);

				if (!erpCustomerId) {
					// Customer doesn't exist in ERP, skip (or create if needed)
					result.failed++;
					result.errors.push({
						id: invoice.id,
						error: "Customer not found in ERP",
					});
					continue;
				}

				// Find or create invoice
				const erpInvoiceId = await this.findInvoiceByExternalId(invoice.id);

				if (erpInvoiceId) {
					// Update existing
					await this.updateInvoice(erpInvoiceId, invoice);
				} else {
					// Create new
					const createResult = await this.createInvoice(invoice, erpCustomerId);
					if (!createResult.success) {
						throw new Error(
							createResult.error?.message || "Failed to create invoice",
						);
					}
				}

				result.synced++;
			} catch (error) {
				result.failed++;
				result.errors.push({
					id: invoice.id,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		result.success = result.failed === 0;
		return result;
	}

	async syncQuotes(quotes: Quote[]): Promise<SyncResult> {
		const result: SyncResult = {
			success: true,
			synced: 0,
			failed: 0,
			errors: [],
		};

		for (const quote of quotes) {
			try {
				const erpCustomerId = await this.findCustomerByExternalId(
					quote.companyId,
				);

				if (!erpCustomerId) {
					result.failed++;
					result.errors.push({
						id: quote.id,
						error: "Customer not found in ERP",
					});
					continue;
				}

				const cached = await cache.get<string>(`erp:quote:${quote.id}`);

				if (cached) {
					await this.updateQuote(cached, quote);
				} else {
					const createResult = await this.createQuote(quote, erpCustomerId);
					if (!createResult.success) {
						throw new Error(
							createResult.error?.message || "Failed to create quote",
						);
					}
				}

				result.synced++;
			} catch (error) {
				result.failed++;
				result.errors.push({
					id: quote.id,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		result.success = result.failed === 0;
		return result;
	}

	// ============================================
	// Helper Methods
	// ============================================

	private mapInvoiceStatus(status: Invoice["status"]): ERPInvoice["status"] {
		const statusMap: Record<Invoice["status"], ERPInvoice["status"]> = {
			draft: "draft",
			sent: "sent",
			paid: "paid",
			partial: "sent", // ERP might not have partial, map to sent
			overdue: "overdue",
			cancelled: "cancelled",
		};
		return statusMap[status] || "draft";
	}

	private mapQuoteStatus(status: Quote["status"]): ERPQuote["status"] {
		const statusMap: Record<Quote["status"], ERPQuote["status"]> = {
			draft: "draft",
			sent: "sent",
			accepted: "accepted",
			rejected: "rejected",
			expired: "expired",
		};
		return statusMap[status] || "draft";
	}

	// Check if ERP integration is enabled
	isEnabled(): boolean {
		return this.enabled;
	}

	// Health check
	async healthCheck(): Promise<{ connected: boolean; latency?: number }> {
		if (!this.enabled) {
			return { connected: false };
		}

		const start = Date.now();
		try {
			const result = await this.request<{ status: string }>("GET", "/health");
			return {
				connected: result.success,
				latency: Date.now() - start,
			};
		} catch {
			return { connected: false };
		}
	}
}

export const erpClient = new ERPClient();
export default erpClient;
