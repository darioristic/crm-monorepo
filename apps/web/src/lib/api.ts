import type {
  Company,
  CompanyReport,
  CompanyRevenue,
  Contact,
  ConversionFunnel,
  CreateCompanyRequest,
  CreateContactRequest,
  CreateDeliveryNoteRequest,
  CreateInvoiceRequest,
  CreateMilestoneRequest,
  CreateNotificationRequest,
  CreateOrderRequest,
  CreatePaymentRequest,
  CreateProductCategoryRequest,
  CreateProductRequest,
  CreateProjectRequest,
  CreateQuoteRequest,
  CreateTaskRequest,
  CreateUserRequest,
  CustomerOrganization,
  DeliveryNote,
  DeliveryNoteReport,
  Invoice,
  InvoiceReport,
  InvoiceStatusBreakdown,
  Milestone,
  MilestoneBreakdown,
  MilestoneReport,
  Notification,
  Order,
  Payment,
  PaymentSummary,
  PaymentWithInvoice,
  Product,
  ProductCategory,
  ProductCategoryWithChildren,
  ProductWithCategory,
  Project,
  ProjectDurationStats,
  ProjectReport,
  ProjectSummary,
  Quote,
  QuoteReport,
  RevenuePoint,
  SalesSummary,
  Task,
  TaskPriorityStats,
  TaskReport,
  TaskStatPoint,
  TopCustomer,
  UpdateCompanyRequest,
  UpdateContactRequest,
  UpdateDeliveryNoteRequest,
  UpdateInvoiceRequest,
  UpdateMilestoneRequest,
  UpdateOrderRequest,
  UpdatePaymentRequest,
  UpdateProductCategoryRequest,
  UpdateProductRequest,
  UpdateProjectRequest,
  UpdateQuoteRequest,
  UpdateTaskRequest,
  UpdateUserRequest,
  User,
  UserReport,
} from "@crm/types";
import { logger } from "./logger";

// Use empty string for client-side requests (will use proxy via rewrites)
// Use full URL for server-side requests
const API_URL = typeof window === "undefined" ? process.env.API_URL || "http://localhost:3001" : "";

let csrfTokenCache: string | null = null;

function requiresCsrf(method?: string): boolean {
  if (!method) return false;
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  return !safeMethods.includes(method.toUpperCase());
}

async function getCsrfToken(): Promise<string | null> {
  try {
    if (csrfTokenCache) return csrfTokenCache;
    const resp = await fetch(`${API_URL}/api/v1/auth/csrf-token`, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });
    const text = await resp.text();
    const data = JSON.parse(text) as ApiResponse<{ csrfToken: string }>;
    const token = data?.data?.csrfToken;
    if (token) {
      csrfTokenCache = token;
      return token;
    }
    return null;
  } catch {
    return null;
  }
}

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

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const url = `${API_URL}${endpoint}`;

  const defaultHeaders: HeadersInit = options.body ? { "Content-Type": "application/json" } : {};

  let companyHeader: Record<string, string> = {};
  if (typeof window !== "undefined") {
    try {
      const path = window.location?.pathname ?? "";
      const m = path.match(/^\/c\/([^/]+)/);
      if (m?.[1]) {
        companyHeader = { "X-Company-Id": String(m[1]) };
      }
      if (!companyHeader["X-Company-Id"]) {
        const lsCompany = window.localStorage?.getItem("selectedCompanyId");
        if (lsCompany) {
          companyHeader = { "X-Company-Id": lsCompany };
        }
      }
      if (!companyHeader["X-Company-Id"]) {
        const cookie = document.cookie || "";
        const selectedCookie = cookie
          .split(";")
          .map((c) => c.trim())
          .find((c) => c.startsWith("selected_company_id="))
          ?.split("=")[1];
        if (selectedCookie) {
          companyHeader = { "X-Company-Id": String(selectedCookie) };
        }
      }
      if (!companyHeader["X-Company-Id"]) {
        const cookie = document.cookie || "";
        const token = cookie
          .split(";")
          .map((c) => c.trim())
          .find((c) => c.startsWith("access_token="))
          ?.split("=")[1];
        if (token) {
          const parts = token.split(".");
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            if (payload?.companyId) {
              companyHeader = { "X-Company-Id": String(payload.companyId) };
            }
          }
        }
      }
    } catch {}
  } else {
    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      const selectedCookie = cookieStore.get("selected_company_id")?.value;
      if (selectedCookie) {
        companyHeader = { "X-Company-Id": String(selectedCookie) };
      }
      if (!companyHeader["X-Company-Id"]) {
        const token = cookieStore.get("access_token")?.value;
        if (token) {
          const parts = token.split(".");
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
            if (payload?.companyId) {
              companyHeader = { "X-Company-Id": String(payload.companyId) };
            }
          }
        }
      }
    } catch {}
  }

  try {
    const csrfHeader: Record<string, string> = {};
    if (requiresCsrf(options.method)) {
      const token = await getCsrfToken();
      if (token) {
        csrfHeader["X-CSRF-Token"] = token;
      }
    }

    const response = await fetch(url, {
      ...options,
      credentials: "include", // Important: send cookies with requests
      headers: {
        ...defaultHeaders,
        ...companyHeader,
        ...csrfHeader,
        ...options.headers,
      },
    });

    // Check content type - but also try to parse as JSON even if header is missing
    // (Next.js proxy might not forward headers correctly)
    const contentType = response.headers.get("content-type");
    const hasJsonHeader = contentType?.includes("application/json");

    // Handle 401 Unauthorized - try to refresh token and retry ONCE
    if (response.status === 401 && typeof window !== "undefined") {
      try {
        const { refreshToken } = await import("./auth");
        const refreshResult = await refreshToken();

        if (refreshResult.success) {
          // Retry the original request ONCE after successful refresh
          const retryResponse = await fetch(url, {
            ...options,
            credentials: "include",
            headers: {
              ...defaultHeaders,
              ...companyHeader,
              ...options.headers,
            },
          });

          // Try to parse as JSON regardless of content-type header
          try {
            const retryText = await retryResponse.text();
            const retryData = JSON.parse(retryText);
            return retryData as ApiResponse<T>;
          } catch {
            // Not JSON, log error
            const error = new Error("Server returned invalid response format after token refresh");
            logger.error("API returned non-JSON response (retry)", error, {
              status: retryResponse.status,
              contentType: retryResponse.headers.get("content-type"),
              url: endpoint,
            });
            return {
              success: false,
              error: {
                code: "SERVER_ERROR",
                message: "Server returned invalid response format",
              },
            };
          }
        }
      } catch (refreshError) {
        logger.error("Token refresh failed", refreshError);
      }
    }

    // Try to parse as JSON - even if content-type header is missing
    // (Next.js proxy might not forward headers correctly)
    let text = await response.text();

    // Debug: log raw response for convert-to-order requests
    if (endpoint.includes("convert-to-order") || endpoint.includes("convert-to-invoice")) {
    }

    // Try to parse as JSON
    try {
      const data = JSON.parse(text);

      // If parsing succeeded, return the data
      // Log warning if header was missing (for debugging)
      if (!hasJsonHeader) {
        logger.warn("API response parsed as JSON but Content-Type header was missing", {
          status: response.status,
          contentType,
          url: endpoint,
        });
      }

      // If CSRF failed, refresh token and retry once
      if (
        response.status === 403 &&
        data?.error?.code === "CSRF_VALIDATION_FAILED" &&
        requiresCsrf(options.method)
      ) {
        csrfTokenCache = null;
        const newToken = await getCsrfToken();
        const retryResponse = await fetch(url, {
          ...options,
          credentials: "include",
          headers: {
            ...defaultHeaders,
            ...companyHeader,
            ...(newToken ? { "X-CSRF-Token": newToken } : {}),
            ...options.headers,
          },
        });
        text = await retryResponse.text();
        try {
          const retryData = JSON.parse(text);
          return retryData as ApiResponse<T>;
        } catch {
          const errorMessage = `Server returned ${retryResponse.status} ${retryResponse.statusText}. Expected JSON but got ${retryResponse.headers.get("content-type") || "unknown"}`;
          const error = new Error(errorMessage);
          logger.error("API returned non-JSON response (csrf retry)", error, {
            status: retryResponse.status,
            contentType: retryResponse.headers.get("content-type"),
            preview: text.substring(0, 200),
            url: endpoint,
          });
          return {
            success: false,
            error: {
              code: retryResponse.status >= 500 ? "SERVER_ERROR" : "CLIENT_ERROR",
              message: errorMessage,
            },
          };
        }
      }

      return data as ApiResponse<T>;
    } catch (_parseError) {
      // Not JSON - log error with preview
      const errorMessage = `Server returned ${response.status} ${response.statusText}. Expected JSON but got ${contentType || "unknown"}`;
      const error = new Error(errorMessage);

      logger.error("API returned non-JSON response", error, {
        status: response.status,
        contentType,
        preview: text.substring(0, 200),
        url: endpoint,
      });

      return {
        success: false,
        error: {
          code: response.status >= 500 ? "SERVER_ERROR" : "CLIENT_ERROR",
          message: errorMessage,
        },
      };
    }
  } catch (error) {
    // Use warn for network errors to avoid console spam during development if backend is down
    logger.warn("API request failed", { error });
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

// Contacts API
export const contactsApi = {
  getAll: (params: FilterParams & PaginationParams = {}) =>
    request<Contact[]>(`/api/v1/contacts${buildQueryString(params)}`),

  getById: (id: string) => request<Contact>(`/api/v1/contacts/${id}`),

  create: (data: CreateContactRequest) =>
    request<Contact>("/api/v1/contacts", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateContactRequest) =>
    request<Contact>(`/api/v1/contacts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/api/v1/contacts/${id}`, {
      method: "DELETE",
    }),
  favorite: (id: string, favorite: boolean) =>
    request<Contact>(`/api/v1/contacts/${id}/favorite`, {
      method: "POST",
      body: JSON.stringify({ favorite }),
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
  favorite: (id: string, favorite: boolean) =>
    request<Company>(`/api/v1/companies/${id}/favorite`, {
      method: "POST",
      body: JSON.stringify({ favorite }),
    }),
};

// Accounts API (unified customers search)
export const accountsApi = {
  search: (params: {
    q?: string;
    type?: "individual" | "organization";
    limit?: number;
    companyId?: string;
  }) =>
    request<
      Array<{
        type: "individual" | "organization";
        id: string;
        display: string;
        subtitle?: string;
        favorite: boolean;
      }>
    >(`/api/v1/accounts/search${buildQueryString(params as any)}`),
  select: (payload: { type: "individual" | "organization"; id: string; companyId?: string }) =>
    request<{ count: number }>(`/api/v1/accounts/select`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

// Organizations API (Accounts-specific)
export const organizationsApi = {
  getAll: (params: FilterParams & PaginationParams = {}) =>
    request<CustomerOrganization[]>(`/api/v1/organizations${buildQueryString(params)}`),
  getById: (id: string) => request<CustomerOrganization>(`/api/v1/organizations/${id}`),
  create: (data: Partial<CustomerOrganization> & { id: string }) =>
    request<CustomerOrganization>(`/api/v1/organizations`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<CustomerOrganization>) =>
    request<CustomerOrganization>(`/api/v1/organizations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<void>(`/api/v1/organizations/${id}`, {
      method: "DELETE",
    }),
  favorite: (id: string, favorite: boolean) =>
    request<CustomerOrganization>(`/api/v1/organizations/${id}/favorite`, {
      method: "POST",
      body: JSON.stringify({ favorite }),
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

  convertToOrder: (
    id: string,
    customizations?: {
      orderNumber?: string;
      orderDate?: string;
      expectedDeliveryDate?: string;
      notes?: string;
      purchaseOrderNumber?: string;
    }
  ) =>
    request<Order>(`/api/v1/quotes/${id}/convert-to-order`, {
      method: "POST",
      body: JSON.stringify(customizations ? { customizations } : {}),
    }),

  convertToInvoice: (
    id: string,
    customizations?: {
      invoiceNumber?: string;
      issueDate?: string;
      dueDate?: string;
      paymentTerms?: number;
      notes?: string;
    }
  ) =>
    request<{ invoiceId: string }>(`/api/v1/quotes/${id}/convert-to-invoice`, {
      method: "POST",
      body: JSON.stringify(customizations ? { customizations } : {}),
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
      body: JSON.stringify(sanitizeInvoiceCreatePayload(data)),
    }),

  update: (id: string, data: UpdateInvoiceRequest) =>
    request<Invoice>(`/api/v1/invoices/${id}`, {
      method: "PUT",
      body: JSON.stringify(sanitizeInvoiceUpdatePayload(data)),
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

  convertToDeliveryNote: (
    id: string,
    customizations?: {
      deliveryNumber?: string;
      deliveryDate?: string;
      shipDate?: string;
      shippingAddress?: string;
      carrier?: string;
      trackingNumber?: string;
      notes?: string;
    }
  ) =>
    request<{ deliveryNoteId: string }>(`/api/v1/invoices/${id}/convert-to-delivery-note`, {
      method: "POST",
      body: JSON.stringify(customizations ? { customizations } : {}),
    }),
};

function toIso(date: string | undefined | null): string | undefined {
  if (!date) return undefined;
  try {
    if (date.includes("T")) return date;
    const d = new Date(date);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  } catch {
    return undefined;
  }
}

function cleanString(s: string | undefined | null): string | undefined {
  if (s == null) return undefined;
  const t = String(s).trim();
  return t.length === 0 ? undefined : t;
}

function truncateString(s: string | undefined | null, max: number): string | undefined {
  if (s == null) return undefined;
  const t = String(s);
  return t.length > max ? t.slice(0, max) : t;
}

interface SanitizedItem {
  productName: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number;
  vatRate?: number;
  total: number;
}

function sanitizeItems(items: unknown[]): SanitizedItem[] {
  return (items || []).map((item: unknown) => {
    const i = item as Record<string, unknown>;
    return {
      productName: truncateString(cleanString(i.productName as string), 255) || "",
      description: cleanString(i.description as string),
      quantity: typeof i.quantity === "number" ? i.quantity : Number(i.quantity) || 1,
      unit: cleanString(i.unit as string) || "pcs",
      unitPrice: typeof i.unitPrice === "number" ? i.unitPrice : Number(i.unitPrice) || 0,
      discount: typeof i.discount === "number" ? i.discount : Number(i.discount) || 0,
      vatRate: typeof i.vatRate === "number" ? i.vatRate : Number(i.vatRate),
      total:
        typeof i.total === "number"
          ? i.total
          : Number(i.total) || (Number(i.quantity) || 1) * (Number(i.unitPrice) || 0),
    };
  });
}

function sanitizeInvoiceCreatePayload(data: CreateInvoiceRequest): CreateInvoiceRequest {
  const anyData = data as Record<string, unknown>;
  const payload: Record<string, unknown> = {
    ...anyData,
    customerCompanyId: cleanString(anyData.customerCompanyId as string),
    contactId: cleanString(anyData.contactId as string),
    quoteId: cleanString(anyData.quoteId as string),
    status: cleanString(anyData.status as string) || "draft",
    issueDate: toIso(anyData.issueDate as string),
    dueDate: toIso(anyData.dueDate as string),
    notes: cleanString(anyData.notes as string),
    terms: cleanString(anyData.terms as string),
    currency: cleanString(anyData.currency as string),
    logoUrl: cleanString(anyData.logoUrl as string),
    fromDetails: anyData.fromDetails ?? undefined,
    customerDetails: anyData.customerDetails ?? undefined,
    templateSettings: anyData.templateSettings ?? undefined,
    taxRate: typeof anyData.taxRate === "number" ? anyData.taxRate : Number(anyData.taxRate) || 0,
    vatRate: typeof anyData.vatRate === "number" ? anyData.vatRate : Number(anyData.vatRate),
    subtotal: typeof anyData.subtotal === "number" ? anyData.subtotal : Number(anyData.subtotal),
    tax: typeof anyData.tax === "number" ? anyData.tax : Number(anyData.tax),
    total: typeof anyData.total === "number" ? anyData.total : Number(anyData.total),
    items: sanitizeItems((anyData.items as unknown[]) || []),
  };
  delete payload.invoiceNumber;
  return payload as CreateInvoiceRequest;
}

function sanitizeInvoiceUpdatePayload(data: UpdateInvoiceRequest): UpdateInvoiceRequest {
  const anyData = (data || {}) as Record<string, unknown>;
  const payload: Record<string, unknown> = {
    ...anyData,
    customerCompanyId: cleanString(anyData.customerCompanyId as string),
    contactId: cleanString(anyData.contactId as string),
    quoteId: cleanString(anyData.quoteId as string),
    status: cleanString(anyData.status as string),
    issueDate: toIso(anyData.issueDate as string),
    dueDate: toIso(anyData.dueDate as string),
    notes: cleanString(anyData.notes as string),
    terms: cleanString(anyData.terms as string),
    currency: cleanString(anyData.currency as string),
    logoUrl: cleanString(anyData.logoUrl as string),
    fromDetails: anyData.fromDetails ?? undefined,
    customerDetails: anyData.customerDetails ?? undefined,
    templateSettings: anyData.templateSettings ?? undefined,
    items: anyData.items ? sanitizeItems(anyData.items as unknown[]) : undefined,
  };
  delete payload.invoiceNumber;
  return payload as UpdateInvoiceRequest;
}

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

// Orders API
export const ordersApi = {
  getAll: (params: FilterParams & PaginationParams = {}) =>
    request<Order[]>(`/api/v1/orders${buildQueryString(params)}`),

  getById: (id: string) => request<Order>(`/api/v1/orders/${id}`),

  getNextNumber: () => request<{ orderNumber: string }>("/api/v1/orders/next-number"),

  create: (data: CreateOrderRequest) =>
    request<Order>("/api/v1/orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateOrderRequest) =>
    request<Order>(`/api/v1/orders/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/api/v1/orders/${id}`, {
      method: "DELETE",
    }),

  convertToInvoice: (
    id: string,
    customizations?: {
      invoiceNumber?: string;
      issueDate?: string;
      dueDate?: string;
      paymentTerms?: number;
      notes?: string;
      partial?: { percentage?: number; amount?: string };
    }
  ) =>
    request<{ invoiceId: string }>(`/api/v1/orders/${id}/convert-to-invoice`, {
      method: "POST",
      body: JSON.stringify(customizations ? { customizations } : {}),
    }),

  convertToDeliveryNote: (
    id: string,
    customizations?: {
      deliveryNumber?: string;
      deliveryDate?: string;
      shipDate?: string;
      shippingAddress?: string;
      carrier?: string;
      trackingNumber?: string;
      notes?: string;
    }
  ) =>
    request<{ deliveryNoteId: string }>(`/api/v1/orders/${id}/convert-to-delivery-note`, {
      method: "POST",
      body: JSON.stringify(customizations ? { customizations } : {}),
    }),
};

// Workflows API
export const workflowsApi = {
  getDocumentChain: (quoteId: string) =>
    request<{
      quote: any;
      orders: any[];
      invoices: any[];
    }>(`/api/v1/workflows/document-chain/${quoteId}`),
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
    request<ConversionFunnel>(
      `/api/v1/analytics/sales/conversion-funnel${buildQueryString(params)}`
    ),

  getInvoiceStatusBreakdown: (params: AnalyticsParams = {}) =>
    request<InvoiceStatusBreakdown[]>(
      `/api/v1/analytics/sales/invoice-status${buildQueryString(params)}`
    ),

  // Project Analytics
  getTaskStatsOverTime: (params: AnalyticsParams = {}) =>
    request<TaskStatPoint[]>(`/api/v1/analytics/projects/task-stats${buildQueryString(params)}`),

  getMilestoneBreakdown: (params: AnalyticsParams = {}) =>
    request<MilestoneBreakdown[]>(
      `/api/v1/analytics/projects/milestone-breakdown${buildQueryString(params)}`
    ),

  getTasksByPriority: (params: AnalyticsParams = {}) =>
    request<TaskPriorityStats[]>(
      `/api/v1/analytics/projects/tasks-by-priority${buildQueryString(params)}`
    ),

  getProjectDurationStats: () =>
    request<ProjectDurationStats>(`/api/v1/analytics/projects/duration-stats`),
};

// Product Categories API
export const productCategoriesApi = {
  getAll: (params: FilterParams & PaginationParams = {}) =>
    request<ProductCategoryWithChildren[]>(`/api/v1/product-categories${buildQueryString(params)}`),

  getById: (id: string) => request<ProductCategory>(`/api/v1/product-categories/${id}`),

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
    request<ProductWithCategory[]>(`/api/v1/products${buildQueryString(params)}`),

  getById: (id: string) => request<ProductWithCategory>(`/api/v1/products/${id}`),

  getBySku: (sku: string) => request<ProductWithCategory>(`/api/v1/products/sku/${sku}`),

  getLowStock: () => request<ProductWithCategory[]>(`/api/v1/products/low-stock`),

  getPopular: (params: { limit?: number; currency?: string } = {}) =>
    request<ProductWithCategory[]>(`/api/v1/products/popular${buildQueryString(params)}`),

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
      }
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
      } = {}
  ) =>
    request<{ notifications: Notification[]; unreadCount: number }>(
      `/api/v1/notifications${buildQueryString(params)}`
    ),

  getById: (id: string) => request<Notification>(`/api/v1/notifications/${id}`),

  getUnreadCount: () => request<{ count: number }>(`/api/v1/notifications/unread-count`),

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
      } = {}
  ) => request<PaymentWithInvoice[]>(`/api/v1/payments${buildQueryString(params)}`),

  getById: (id: string) => request<PaymentWithInvoice>(`/api/v1/payments/${id}`),

  getByInvoice: (invoiceId: string) => request<Payment[]>(`/api/v1/invoices/${invoiceId}/payments`),

  getInvoiceSummary: (invoiceId: string) =>
    request<PaymentSummary>(`/api/v1/invoices/${invoiceId}/payment-summary`),

  getStats: (params: { dateFrom?: string; dateTo?: string } = {}) =>
    request<PaymentSummary>(`/api/v1/payments/stats${buildQueryString(params)}`),

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

  getRecent: (limit: number = 5) => request<Document[]>(`/api/v1/documents/recent?limit=${limit}`),

  getCount: () => request<{ count: number }>(`/api/v1/documents/count`),

  upload: async (files: File[]) => {
    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }

    const url = `${typeof window === "undefined" ? process.env.API_URL || "http://localhost:3001" : ""}/api/v1/documents/upload`;

    let companyHeader: Record<string, string> = {};
    try {
      if (typeof window !== "undefined") {
        const path = window.location?.pathname ?? "";
        const m = path.match(/^\/c\/([^/]+)/);
        if (m?.[1]) {
          companyHeader = { "X-Company-Id": String(m[1]) };
        }
        if (!companyHeader["X-Company-Id"]) {
          const lsCompany = window.localStorage?.getItem("selectedCompanyId");
          if (lsCompany) {
            companyHeader = { "X-Company-Id": lsCompany };
          }
        }
        if (!companyHeader["X-Company-Id"]) {
          const cookie = document.cookie || "";
          const selectedCookie = cookie
            .split(";")
            .map((c) => c.trim())
            .find((c) => c.startsWith("selected_company_id="))
            ?.split("=")[1];
          if (selectedCookie) {
            companyHeader = { "X-Company-Id": String(selectedCookie) };
          }
        }
        if (!companyHeader["X-Company-Id"]) {
          const cookie = document.cookie || "";
          const token = cookie
            .split(";")
            .map((c) => c.trim())
            .find((c) => c.startsWith("access_token="))
            ?.split("=")[1];
          if (token) {
            const parts = token.split(".");
            if (parts.length === 3) {
              const payload = JSON.parse(atob(parts[1]));
              if (payload?.companyId) {
                companyHeader = { "X-Company-Id": String(payload.companyId) };
              }
            }
          }
        }
      } else {
        const { cookies } = await import("next/headers");
        const cookieStore = await cookies();
        const selectedCookie = cookieStore.get("selected_company_id")?.value;
        if (selectedCookie) {
          companyHeader = { "X-Company-Id": String(selectedCookie) };
        }
        if (!companyHeader["X-Company-Id"]) {
          const token = cookieStore.get("access_token")?.value;
          if (token) {
            const parts = token.split(".");
            if (parts.length === 3) {
              const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
              if (payload?.companyId) {
                companyHeader = { "X-Company-Id": String(payload.companyId) };
              }
            }
          }
        }
      }
    } catch {}

    const csrfHeader: Record<string, string> = {};
    try {
      const token = await getCsrfToken();
      if (token) {
        csrfHeader["X-CSRF-Token"] = token;
      }
    } catch {}

    const response = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { ...companyHeader, ...csrfHeader },
      body: formData,
    });

    return response.json() as Promise<ApiResponse<Document[]>>;
  },

  process: (documents: Array<{ filePath: string[]; mimetype: string; size: number }>) =>
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

  getDownloadUrl: (pathTokens: string[]) => `/api/v1/documents/download/${pathTokens.join("/")}`,

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
    request<{ documentId: string; tagId: string }>("/api/v1/document-tag-assignments", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  remove: (data: { documentId: string; tagId: string }) =>
    request<{ success: boolean }>("/api/v1/document-tag-assignments", {
      method: "DELETE",
      body: JSON.stringify(data),
    }),
};

// Invites API
export const invitesApi = {
  getAll: () =>
    request<
      Array<{
        id: string;
        email: string;
        role: "owner" | "member" | "admin";
        status: string;
        expiresAt: string;
        createdAt: string;
      }>
    >("/api/v1/invites"),

  create: (data: { email: string; role: "owner" | "member" | "admin" }) =>
    request<{
      id: string;
      email: string;
      role: "owner" | "member" | "admin";
      status: string;
      expiresAt: string;
      createdAt: string;
    }>("/api/v1/invites", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/api/v1/invites/${id}`, {
      method: "DELETE",
    }),

  accept: (token: string) =>
    request<void>(`/api/v1/invites/accept/${token}`, {
      method: "POST",
    }),
};

// Tenant Admin API
// ============================================

export type TenantUser = {
  id: string;
  tenantId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  role: "superadmin" | "tenant_admin" | "crm_user";
  status: string | null;
  avatarUrl: string | null;
  phone: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TenantCompany = Company;

export type CreateTenantUserRequest = {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  role?: "tenant_admin" | "crm_user";
  phone?: string;
};

export type UpdateTenantUserRequest = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  role?: "tenant_admin" | "crm_user";
  status?: string;
};

export type CreateTenantCompanyRequest = {
  name: string;
  industry: string;
  address: string;
  locationId?: string;
  email?: string;
  phone?: string;
  website?: string;
  contact?: string;
  city?: string;
  zip?: string;
  country?: string;
  countryCode?: string;
  vatNumber?: string;
  companyNumber?: string;
  logoUrl?: string;
  note?: string;
};

export type UpdateTenantCompanyRequest = Partial<CreateTenantCompanyRequest>;

export const tenantAdminApi = {
  // Users
  users: {
    getAll: () => request<TenantUser[]>("/api/tenant-admin/users"),
    getById: (id: string) => request<TenantUser>(`/api/tenant-admin/users/${id}`),
    create: (data: CreateTenantUserRequest) =>
      request<TenantUser>("/api/tenant-admin/users", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: UpdateTenantUserRequest) =>
      request<TenantUser>(`/api/tenant-admin/users/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ message: string }>(`/api/tenant-admin/users/${id}`, {
        method: "DELETE",
      }),
  },

  // Companies
  companies: {
    getAll: () => request<TenantCompany[]>("/api/tenant-admin/companies"),
    getById: (id: string) => request<TenantCompany>(`/api/tenant-admin/companies/${id}`),
    create: (data: CreateTenantCompanyRequest) =>
      request<TenantCompany>("/api/tenant-admin/companies", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: UpdateTenantCompanyRequest) =>
      request<TenantCompany>(`/api/tenant-admin/companies/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ message: string }>(`/api/tenant-admin/companies/${id}`, {
        method: "DELETE",
      }),
  },
};

export { request, buildQueryString };
