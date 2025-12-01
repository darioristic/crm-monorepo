import type {
	User,
	Company,
	CreateUserRequest,
	UpdateUserRequest,
	CreateCompanyRequest,
	UpdateCompanyRequest,
	Quote,
	Invoice,
	DeliveryNote,
	Project,
	Task,
	Milestone,
	CreateQuoteRequest,
	UpdateQuoteRequest,
	CreateInvoiceRequest,
	UpdateInvoiceRequest,
	CreateDeliveryNoteRequest,
	UpdateDeliveryNoteRequest,
	CreateProjectRequest,
	UpdateProjectRequest,
	CreateTaskRequest,
	UpdateTaskRequest,
	CreateMilestoneRequest,
	UpdateMilestoneRequest,
	SalesSummary,
	ProjectSummary,
	UserReport,
	CompanyReport,
	QuoteReport,
	InvoiceReport,
	DeliveryNoteReport,
	ProjectReport,
	TaskReport,
	MilestoneReport,
	RevenuePoint,
	CompanyRevenue,
	TopCustomer,
	ConversionFunnel,
	InvoiceStatusBreakdown,
	TaskStatPoint,
	MilestoneBreakdown,
	TaskPriorityStats,
	ProjectDurationStats,
	AnalyticsDateRange,
	Product,
	ProductWithCategory,
	ProductCategory,
	ProductCategoryWithChildren,
	CreateProductRequest,
	UpdateProductRequest,
	CreateProductCategoryRequest,
	UpdateProductCategoryRequest,
	Notification,
	CreateNotificationRequest,
	Payment,
	PaymentWithInvoice,
	PaymentSummary,
	CreatePaymentRequest,
	UpdatePaymentRequest,
} from "@crm/types";

// Use empty string for client-side requests (will use proxy via rewrites)
// Use full URL for server-side requests
const API_URL =
	typeof window === "undefined"
		? process.env.API_URL || "http://localhost:3001"
		: "";

export type ApiResponse<T> = {
	success: boolean;
	data?: T;
	error?: {
		code: string;
		message: string;
	};
	meta?: {
		page: number;
		pageSize: number;
		totalCount: number;
		totalPages: number;
	};
};

export type PaginationParams = {
	page?: number;
	pageSize?: number;
};

export type FilterParams = {
	search?: string;
	status?: string;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
	[key: string]: string | number | undefined;
};

async function request<T>(
	endpoint: string,
	options: RequestInit = {},
): Promise<ApiResponse<T>> {
	const url = `${API_URL}${endpoint}`;

	const defaultHeaders: HeadersInit = {
		"Content-Type": "application/json",
	};

	try {
		const response = await fetch(url, {
			...options,
			credentials: "include", // Important: send cookies with requests
			headers: {
				...defaultHeaders,
				...options.headers,
			},
		});

		const data = await response.json();
		return data as ApiResponse<T>;
	} catch (error) {
		console.error("API request failed:", error);
		return {
			success: false,
			error: {
				code: "NETWORK_ERROR",
				message: "Failed to connect to API server",
			},
		};
	}
}

function buildQueryString(params: FilterParams & PaginationParams): string {
	const searchParams = new URLSearchParams();

	Object.entries(params).forEach(([key, value]) => {
		if (value !== undefined && value !== null && value !== "") {
			searchParams.append(key, String(value));
		}
	});

	const query = searchParams.toString();
	return query ? `?${query}` : "";
}

// Users API
export const usersApi = {
	getAll: (params: FilterParams & PaginationParams = {}) =>
		request<User[]>(`/api/v1/users${buildQueryString(params)}`),

	getById: (id: string) => request<User>(`/api/v1/users/${id}`),

	create: (data: CreateUserRequest) =>
		request<User>("/api/v1/users", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	update: (id: string, data: UpdateUserRequest) =>
		request<User>(`/api/v1/users/${id}`, {
			method: "PUT",
			body: JSON.stringify(data),
		}),

	delete: (id: string) =>
		request<void>(`/api/v1/users/${id}`, {
			method: "DELETE",
		}),
};

// Companies API
export const companiesApi = {
	getAll: (params: FilterParams & PaginationParams = {}) =>
		request<Company[]>(`/api/v1/companies${buildQueryString(params)}`),

	getById: (id: string) => request<Company>(`/api/v1/companies/${id}`),

	create: (data: CreateCompanyRequest) =>
		request<Company>("/api/v1/companies", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	update: (id: string, data: UpdateCompanyRequest) =>
		request<Company>(`/api/v1/companies/${id}`, {
			method: "PUT",
			body: JSON.stringify(data),
		}),

	delete: (id: string) =>
		request<void>(`/api/v1/companies/${id}`, {
			method: "DELETE",
		}),
};

// Quotes API
export const quotesApi = {
	getAll: (params: FilterParams & PaginationParams = {}) =>
		request<Quote[]>(`/api/v1/quotes${buildQueryString(params)}`),

	getById: (id: string) => request<Quote>(`/api/v1/quotes/${id}`),

	create: (data: CreateQuoteRequest) =>
		request<Quote>("/api/v1/quotes", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	update: (id: string, data: UpdateQuoteRequest) =>
		request<Quote>(`/api/v1/quotes/${id}`, {
			method: "PUT",
			body: JSON.stringify(data),
		}),

	delete: (id: string) =>
		request<void>(`/api/v1/quotes/${id}`, {
			method: "DELETE",
		}),
};

// Invoices API
export const invoicesApi = {
	getAll: (params: FilterParams & PaginationParams = {}) =>
		request<Invoice[]>(`/api/v1/invoices${buildQueryString(params)}`),

	getById: (id: string) => request<Invoice>(`/api/v1/invoices/${id}`),

	create: (data: CreateInvoiceRequest) =>
		request<Invoice>("/api/v1/invoices", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	update: (id: string, data: UpdateInvoiceRequest) =>
		request<Invoice>(`/api/v1/invoices/${id}`, {
			method: "PUT",
			body: JSON.stringify(data),
		}),

	delete: (id: string) =>
		request<void>(`/api/v1/invoices/${id}`, {
			method: "DELETE",
		}),

	recordPayment: (id: string, amount: number) =>
		request<Invoice>(`/api/v1/invoices/${id}/payment`, {
			method: "POST",
			body: JSON.stringify({ amount }),
		}),
};

// Delivery Notes API
export const deliveryNotesApi = {
	getAll: (params: FilterParams & PaginationParams = {}) =>
		request<DeliveryNote[]>(
			`/api/v1/delivery-notes${buildQueryString(params)}`,
		),

	getById: (id: string) =>
		request<DeliveryNote>(`/api/v1/delivery-notes/${id}`),

	create: (data: CreateDeliveryNoteRequest) =>
		request<DeliveryNote>("/api/v1/delivery-notes", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	update: (id: string, data: UpdateDeliveryNoteRequest) =>
		request<DeliveryNote>(`/api/v1/delivery-notes/${id}`, {
			method: "PUT",
			body: JSON.stringify(data),
		}),

	delete: (id: string) =>
		request<void>(`/api/v1/delivery-notes/${id}`, {
			method: "DELETE",
		}),
};

// Projects API
export const projectsApi = {
	getAll: (params: FilterParams & PaginationParams = {}) =>
		request<Project[]>(`/api/v1/projects${buildQueryString(params)}`),

	getById: (id: string) => request<Project>(`/api/v1/projects/${id}`),

	create: (data: CreateProjectRequest) =>
		request<Project>("/api/v1/projects", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	update: (id: string, data: UpdateProjectRequest) =>
		request<Project>(`/api/v1/projects/${id}`, {
			method: "PUT",
			body: JSON.stringify(data),
		}),

	delete: (id: string) =>
		request<void>(`/api/v1/projects/${id}`, {
			method: "DELETE",
		}),
};

// Tasks API
export const tasksApi = {
	getAll: (params: FilterParams & PaginationParams = {}) =>
		request<Task[]>(`/api/v1/tasks${buildQueryString(params)}`),

	getById: (id: string) => request<Task>(`/api/v1/tasks/${id}`),

	create: (data: CreateTaskRequest) =>
		request<Task>("/api/v1/tasks", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	update: (id: string, data: UpdateTaskRequest) =>
		request<Task>(`/api/v1/tasks/${id}`, {
			method: "PUT",
			body: JSON.stringify(data),
		}),

	delete: (id: string) =>
		request<void>(`/api/v1/tasks/${id}`, {
			method: "DELETE",
		}),
};

// Milestones API
export const milestonesApi = {
	getAll: (params: FilterParams & PaginationParams = {}) =>
		request<Milestone[]>(`/api/v1/milestones${buildQueryString(params)}`),

	getById: (id: string) => request<Milestone>(`/api/v1/milestones/${id}`),

	create: (data: CreateMilestoneRequest) =>
		request<Milestone>("/api/v1/milestones", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	update: (id: string, data: UpdateMilestoneRequest) =>
		request<Milestone>(`/api/v1/milestones/${id}`, {
			method: "PUT",
			body: JSON.stringify(data),
		}),

	delete: (id: string) =>
		request<void>(`/api/v1/milestones/${id}`, {
			method: "DELETE",
		}),

	complete: (id: string) =>
		request<Milestone>(`/api/v1/milestones/${id}/complete`, {
			method: "POST",
		}),
};

// Reports API
export const reportsApi = {
	getUsers: (params: FilterParams & PaginationParams = {}) =>
		request<UserReport[]>(`/api/v1/reports/users${buildQueryString(params)}`),

	getCompanies: (params: FilterParams & PaginationParams = {}) =>
		request<CompanyReport[]>(
			`/api/v1/reports/companies${buildQueryString(params)}`,
		),

	getQuotes: (params: FilterParams & PaginationParams = {}) =>
		request<QuoteReport[]>(`/api/v1/reports/quotes${buildQueryString(params)}`),

	getInvoices: (params: FilterParams & PaginationParams = {}) =>
		request<InvoiceReport[]>(
			`/api/v1/reports/invoices${buildQueryString(params)}`,
		),

	getDeliveryNotes: (params: FilterParams & PaginationParams = {}) =>
		request<DeliveryNoteReport[]>(
			`/api/v1/reports/delivery-notes${buildQueryString(params)}`,
		),

	getProjects: (params: FilterParams & PaginationParams = {}) =>
		request<ProjectReport[]>(
			`/api/v1/reports/projects${buildQueryString(params)}`,
		),

	getTasks: (params: FilterParams & PaginationParams = {}) =>
		request<TaskReport[]>(`/api/v1/reports/tasks${buildQueryString(params)}`),

	getMilestones: (params: FilterParams & PaginationParams = {}) =>
		request<MilestoneReport[]>(
			`/api/v1/reports/milestones${buildQueryString(params)}`,
		),

	getSalesSummary: (params: FilterParams = {}) =>
		request<SalesSummary>(
			`/api/v1/reports/sales/summary${buildQueryString(params)}`,
		),

	getProjectSummary: (params: FilterParams = {}) =>
		request<ProjectSummary>(
			`/api/v1/reports/projects/summary${buildQueryString(params)}`,
		),
};

// Analytics API
export type AnalyticsParams = {
	from?: string;
	to?: string;
	limit?: number;
	projectId?: string;
	companyId?: string;
};

export const analyticsApi = {
	// Sales Analytics
	getRevenueOverTime: (params: AnalyticsParams = {}) =>
		request<RevenuePoint[]>(
			`/api/v1/analytics/sales/revenue${buildQueryString(params)}`,
		),

	getRevenueByCompany: (params: AnalyticsParams = {}) =>
		request<CompanyRevenue[]>(
			`/api/v1/analytics/sales/by-company${buildQueryString(params)}`,
		),

	getTopCustomers: (params: AnalyticsParams = {}) =>
		request<TopCustomer[]>(
			`/api/v1/analytics/sales/top-customers${buildQueryString(params)}`,
		),

	getConversionFunnel: (params: AnalyticsParams = {}) =>
		request<ConversionFunnel>(
			`/api/v1/analytics/sales/conversion-funnel${buildQueryString(params)}`,
		),

	getInvoiceStatusBreakdown: (params: AnalyticsParams = {}) =>
		request<InvoiceStatusBreakdown[]>(
			`/api/v1/analytics/sales/invoice-status${buildQueryString(params)}`,
		),

	// Project Analytics
	getTaskStatsOverTime: (params: AnalyticsParams = {}) =>
		request<TaskStatPoint[]>(
			`/api/v1/analytics/projects/task-stats${buildQueryString(params)}`,
		),

	getMilestoneBreakdown: (params: AnalyticsParams = {}) =>
		request<MilestoneBreakdown[]>(
			`/api/v1/analytics/projects/milestone-breakdown${buildQueryString(params)}`,
		),

	getTasksByPriority: (params: AnalyticsParams = {}) =>
		request<TaskPriorityStats[]>(
			`/api/v1/analytics/projects/tasks-by-priority${buildQueryString(params)}`,
		),

	getProjectDurationStats: () =>
		request<ProjectDurationStats>(`/api/v1/analytics/projects/duration-stats`),
};

// Product Categories API
export const productCategoriesApi = {
	getAll: (params: FilterParams & PaginationParams = {}) =>
		request<ProductCategoryWithChildren[]>(
			`/api/v1/product-categories${buildQueryString(params)}`,
		),

	getById: (id: string) =>
		request<ProductCategory>(`/api/v1/product-categories/${id}`),

	create: (data: CreateProductCategoryRequest) =>
		request<ProductCategory>("/api/v1/product-categories", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	update: (id: string, data: UpdateProductCategoryRequest) =>
		request<ProductCategory>(`/api/v1/product-categories/${id}`, {
			method: "PUT",
			body: JSON.stringify(data),
		}),

	delete: (id: string) =>
		request<void>(`/api/v1/product-categories/${id}`, {
			method: "DELETE",
		}),
};

// Products API
export const productsApi = {
	getAll: (params: FilterParams & PaginationParams = {}) =>
		request<ProductWithCategory[]>(
			`/api/v1/products${buildQueryString(params)}`,
		),

	getById: (id: string) =>
		request<ProductWithCategory>(`/api/v1/products/${id}`),

	getBySku: (sku: string) =>
		request<ProductWithCategory>(`/api/v1/products/sku/${sku}`),

	getLowStock: () =>
		request<ProductWithCategory[]>(`/api/v1/products/low-stock`),

	getPopular: (params: { limit?: number; currency?: string } = {}) =>
		request<ProductWithCategory[]>(
			`/api/v1/products/popular${buildQueryString(params)}`,
		),

	create: (data: CreateProductRequest) =>
		request<Product>("/api/v1/products", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	update: (id: string, data: UpdateProductRequest) =>
		request<Product>(`/api/v1/products/${id}`, {
			method: "PUT",
			body: JSON.stringify(data),
		}),

	delete: (id: string) =>
		request<void>(`/api/v1/products/${id}`, {
			method: "DELETE",
		}),

	updateStock: (id: string, quantity: number) =>
		request<Product>(`/api/v1/products/${id}/stock`, {
			method: "PATCH",
			body: JSON.stringify({ quantity }),
		}),

	/**
	 * Increment usage count when product is selected from autocomplete
	 */
	incrementUsage: (id: string) =>
		request<Product>(`/api/v1/products/${id}/increment-usage`, {
			method: "POST",
		}),

	/**
	 * Save line item as product (smart learning from invoices)
	 * Creates new product or updates existing based on name/currency
	 */
	saveLineItemAsProduct: (data: {
		name: string;
		price?: number | null;
		currency?: string | null;
		unit?: string | null;
		productId?: string;
	}) =>
		request<{ product: Product | null; shouldClearProductId: boolean }>(
			"/api/v1/products/save-line-item",
			{
				method: "POST",
				body: JSON.stringify(data),
			},
		),
};

// Notifications API
export const notificationsApi = {
	getAll: (
		params: FilterParams &
			PaginationParams & {
				isRead?: boolean;
				type?: string;
				entityType?: string;
			} = {},
	) =>
		request<{ notifications: Notification[]; unreadCount: number }>(
			`/api/v1/notifications${buildQueryString(params)}`,
		),

	getById: (id: string) => request<Notification>(`/api/v1/notifications/${id}`),

	getUnreadCount: () =>
		request<{ count: number }>(`/api/v1/notifications/unread-count`),

	create: (data: CreateNotificationRequest) =>
		request<Notification>("/api/v1/notifications", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	markAsRead: (id: string) =>
		request<Notification>(`/api/v1/notifications/${id}/read`, {
			method: "PATCH",
		}),

	markAllAsRead: () =>
		request<{ count: number }>("/api/v1/notifications/mark-all-read", {
			method: "POST",
		}),

	delete: (id: string) =>
		request<void>(`/api/v1/notifications/${id}`, {
			method: "DELETE",
		}),
};

// Payments API
export const paymentsApi = {
	getAll: (
		params: FilterParams &
			PaginationParams & {
				invoiceId?: string;
				paymentMethod?: string;
				dateFrom?: string;
				dateTo?: string;
				recordedBy?: string;
			} = {},
	) =>
		request<PaymentWithInvoice[]>(
			`/api/v1/payments${buildQueryString(params)}`,
		),

	getById: (id: string) =>
		request<PaymentWithInvoice>(`/api/v1/payments/${id}`),

	getByInvoice: (invoiceId: string) =>
		request<Payment[]>(`/api/v1/invoices/${invoiceId}/payments`),

	getInvoiceSummary: (invoiceId: string) =>
		request<PaymentSummary>(`/api/v1/invoices/${invoiceId}/payment-summary`),

	getStats: (params: { dateFrom?: string; dateTo?: string } = {}) =>
		request<PaymentSummary>(
			`/api/v1/payments/stats${buildQueryString(params)}`,
		),

	record: (data: CreatePaymentRequest) =>
		request<Payment>("/api/v1/payments", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	update: (id: string, data: UpdatePaymentRequest) =>
		request<Payment>(`/api/v1/payments/${id}`, {
			method: "PUT",
			body: JSON.stringify(data),
		}),

	refund: (id: string) =>
		request<Payment>(`/api/v1/payments/${id}/refund`, {
			method: "POST",
		}),

	delete: (id: string) =>
		request<void>(`/api/v1/payments/${id}`, {
			method: "DELETE",
		}),
};

// ============================================
// Documents API (Vault)
// ============================================

export type DocumentMetadata = {
	size?: number;
	mimetype?: string;
	originalName?: string;
	[key: string]: unknown;
};

export type DocumentProcessingStatus = "pending" | "processing" | "completed" | "failed";

export type Document = {
	id: string;
	name: string | null;
	title: string | null;
	summary: string | null;
	pathTokens: string[];
	metadata: DocumentMetadata;
	processingStatus: DocumentProcessingStatus;
	companyId: string;
	ownerId: string | null;
	createdAt: string;
	updatedAt: string;
};

export type DocumentTag = {
	id: string;
	name: string;
	slug: string;
	companyId: string;
	createdAt: string;
};

export type DocumentWithTags = Document & {
	documentTagAssignments?: Array<{
		documentTag: DocumentTag;
	}>;
};

export type DocumentsListResult = {
	data: DocumentWithTags[];
	meta: {
		cursor: string | undefined;
		hasPreviousPage: boolean;
		hasNextPage: boolean;
	};
};

export type DocumentsFilterParams = {
	q?: string;
	tags?: string[];
	start?: string;
	end?: string;
	cursor?: string;
	pageSize?: number;
};

export const documentsApi = {
	getAll: (params: DocumentsFilterParams = {}) => {
		const queryParams = new URLSearchParams();
		if (params.q) queryParams.append("q", params.q);
		if (params.tags) {
			for (const tag of params.tags) {
				queryParams.append("tags", tag);
			}
		}
		if (params.start) queryParams.append("start", params.start);
		if (params.end) queryParams.append("end", params.end);
		if (params.cursor) queryParams.append("cursor", params.cursor);
		if (params.pageSize) queryParams.append("pageSize", params.pageSize.toString());
		const query = queryParams.toString();
		return request<DocumentsListResult>(`/api/v1/documents${query ? `?${query}` : ""}`);
	},

	getById: (id: string) => request<DocumentWithTags>(`/api/v1/documents/${id}`),

	getRecent: (limit: number = 5) =>
		request<Document[]>(`/api/v1/documents/recent?limit=${limit}`),

	getCount: () => request<{ count: number }>(`/api/v1/documents/count`),

	upload: async (files: File[]) => {
		const formData = new FormData();
		for (const file of files) {
			formData.append("files", file);
		}

		const url = `${typeof window === "undefined" ? (process.env.API_URL || "http://localhost:3001") : ""}/api/v1/documents/upload`;

		const response = await fetch(url, {
			method: "POST",
			credentials: "include",
			body: formData,
		});

		return response.json() as Promise<ApiResponse<Document[]>>;
	},

	process: (
		documents: Array<{ filePath: string[]; mimetype: string; size: number }>,
	) =>
		request<void>("/api/v1/documents/process", {
			method: "POST",
			body: JSON.stringify(documents),
		}),

	update: (id: string, data: { title?: string; summary?: string }) =>
		request<Document>(`/api/v1/documents/${id}`, {
			method: "PATCH",
			body: JSON.stringify(data),
		}),

	delete: (id: string) =>
		request<{ id: string }>(`/api/v1/documents/${id}`, {
			method: "DELETE",
		}),

	getDownloadUrl: (pathTokens: string[]) =>
		`/api/v1/documents/download/${pathTokens.join("/")}`,

	getSignedUrl: (filePath: string, expireIn?: number) =>
		request<{ signedUrl: string }>("/api/v1/documents/signed-url", {
			method: "POST",
			body: JSON.stringify({ filePath, expireIn }),
		}),
};

// Document Tags API
export const documentTagsApi = {
	getAll: () => request<DocumentTag[]>("/api/v1/document-tags"),

	create: (data: { name: string }) =>
		request<DocumentTag>("/api/v1/document-tags", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	delete: (id: string) =>
		request<{ id: string }>(`/api/v1/document-tags/${id}`, {
			method: "DELETE",
		}),
};

// Document Tag Assignments API
export const documentTagAssignmentsApi = {
	assign: (data: { documentId: string; tagId: string }) =>
		request<{ documentId: string; tagId: string }>(
			"/api/v1/document-tag-assignments",
			{
				method: "POST",
				body: JSON.stringify(data),
			},
		),

	remove: (data: { documentId: string; tagId: string }) =>
		request<{ success: boolean }>("/api/v1/document-tag-assignments", {
			method: "DELETE",
			body: JSON.stringify(data),
		}),
};

export { request, buildQueryString };
