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
} from "@crm/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_URL}${endpoint}`;

  const defaultHeaders: HeadersInit = {
    "Content-Type": "application/json",
  };

  try {
    const response = await fetch(url, {
      ...options,
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
    request<DeliveryNote[]>(`/api/v1/delivery-notes${buildQueryString(params)}`),

  getById: (id: string) => request<DeliveryNote>(`/api/v1/delivery-notes/${id}`),

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
    request<CompanyReport[]>(`/api/v1/reports/companies${buildQueryString(params)}`),

  getQuotes: (params: FilterParams & PaginationParams = {}) =>
    request<QuoteReport[]>(`/api/v1/reports/quotes${buildQueryString(params)}`),

  getInvoices: (params: FilterParams & PaginationParams = {}) =>
    request<InvoiceReport[]>(`/api/v1/reports/invoices${buildQueryString(params)}`),

  getDeliveryNotes: (params: FilterParams & PaginationParams = {}) =>
    request<DeliveryNoteReport[]>(`/api/v1/reports/delivery-notes${buildQueryString(params)}`),

  getProjects: (params: FilterParams & PaginationParams = {}) =>
    request<ProjectReport[]>(`/api/v1/reports/projects${buildQueryString(params)}`),

  getTasks: (params: FilterParams & PaginationParams = {}) =>
    request<TaskReport[]>(`/api/v1/reports/tasks${buildQueryString(params)}`),

  getMilestones: (params: FilterParams & PaginationParams = {}) =>
    request<MilestoneReport[]>(`/api/v1/reports/milestones${buildQueryString(params)}`),

  getSalesSummary: (params: FilterParams = {}) =>
    request<SalesSummary>(`/api/v1/reports/sales/summary${buildQueryString(params)}`),

  getProjectSummary: (params: FilterParams = {}) =>
    request<ProjectSummary>(`/api/v1/reports/projects/summary${buildQueryString(params)}`),
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
    request<RevenuePoint[]>(`/api/v1/analytics/sales/revenue${buildQueryString(params)}`),

  getRevenueByCompany: (params: AnalyticsParams = {}) =>
    request<CompanyRevenue[]>(`/api/v1/analytics/sales/by-company${buildQueryString(params)}`),

  getTopCustomers: (params: AnalyticsParams = {}) =>
    request<TopCustomer[]>(`/api/v1/analytics/sales/top-customers${buildQueryString(params)}`),

  getConversionFunnel: (params: AnalyticsParams = {}) =>
    request<ConversionFunnel>(`/api/v1/analytics/sales/conversion-funnel${buildQueryString(params)}`),

  getInvoiceStatusBreakdown: (params: AnalyticsParams = {}) =>
    request<InvoiceStatusBreakdown[]>(`/api/v1/analytics/sales/invoice-status${buildQueryString(params)}`),

  // Project Analytics
  getTaskStatsOverTime: (params: AnalyticsParams = {}) =>
    request<TaskStatPoint[]>(`/api/v1/analytics/projects/task-stats${buildQueryString(params)}`),

  getMilestoneBreakdown: (params: AnalyticsParams = {}) =>
    request<MilestoneBreakdown[]>(`/api/v1/analytics/projects/milestone-breakdown${buildQueryString(params)}`),

  getTasksByPriority: (params: AnalyticsParams = {}) =>
    request<TaskPriorityStats[]>(`/api/v1/analytics/projects/tasks-by-priority${buildQueryString(params)}`),

  getProjectDurationStats: () =>
    request<ProjectDurationStats>(`/api/v1/analytics/projects/duration-stats`),
};

export { request, buildQueryString };
