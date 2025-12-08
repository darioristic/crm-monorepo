// ============================================
// Base Types
// ============================================

export type UUID = string;
export type Timestamp = string; // ISO 8601 format

export interface BaseEntity {
  id: UUID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// Company Types
// ============================================

export interface Company extends BaseEntity {
  name: string;
  industry: string;
  address: string;
  // Contact information
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  contact?: string | null;
  // Address details
  city?: string | null;
  zip?: string | null;
  country?: string | null;
  countryCode?: string | null;
  // Business identifiers
  vatNumber?: string | null;
  companyNumber?: string | null;
  // Branding
  logoUrl?: string | null;
  // Additional
  note?: string | null;
  isFavorite?: boolean;
  // Source: 'account' = account companies (companies that use the app), 'customer' = customer companies (clients created through forms)
  source?: "account" | "customer";
}

// Enhanced Company type with additional fields (inspired by midday-main)
export interface EnhancedCompany extends Company {
  billingEmail?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  state?: string | null;
  token?: string;
  invoiceCount?: number;
  projectCount?: number;
  tags?: CompanyTag[];
}

export interface CompanyTag {
  id: UUID;
  name: string;
}

// Upsert Company params
export interface UpsertCompanyParams {
  id?: string;
  name: string;
  email?: string | null;
  billingEmail?: string | null;
  phone?: string | null;
  website?: string | null;
  contact?: string | null;
  industry?: string;
  address?: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  countryCode?: string | null;
  vatNumber?: string | null;
  note?: string | null;
  tags?: CompanyTag[];
}

// ============================================
// User & Auth Types
// ============================================

export type UserRole = "superadmin" | "tenant_admin" | "crm_user" | "admin" | "user";
export type UserStatus = "active" | "inactive" | "pending";

export interface User extends BaseEntity {
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  companyId?: UUID; // FK to Companies
  status?: UserStatus;
  avatarUrl?: string;
  phone?: string;
  lastLoginAt?: Timestamp;
}

export interface UserWithCompany extends User {
  company?: Company;
}

export interface AuthSession {
  userId: UUID;
  accessToken: string;
  refreshToken: string;
  expiresAt: Timestamp;
}

// ============================================
// CRM Types - Leads & Contacts
// ============================================

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

export type LeadSource =
  | "website"
  | "referral"
  | "cold_call"
  | "email"
  | "social_media"
  | "advertisement"
  | "other";

export interface Lead extends BaseEntity {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  position?: string;
  status: LeadStatus;
  source: LeadSource;
  assignedTo?: UUID;
  value?: number;
  notes?: string;
  tags?: string[];
}

export interface Contact extends BaseEntity {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  position?: string;
  address?: Address;
  notes?: string;
  leadId?: UUID;
  jmbg?: string;
  isFavorite?: boolean;
}

export interface CustomerOrganization extends BaseEntity {
  name: string;
  email?: string | null;
  phone?: string | null;
  pib?: string | null;
  companyNumber?: string | null;
  contactPerson?: string | null;
  isFavorite?: boolean;
  /** Multi-tenant isolation */
  tenantId?: UUID;
  /** Roles of the organization in the CRM/ERP */
  roles?: OrganizationRole[];
  /** Lifecycle status */
  status?: OrganizationStatus;
  /** Simple tag system */
  tags?: string[];
  /** Free-form notes */
  note?: string | null;
}

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

// ============================================
// Organization Roles & Status
// ============================================

export type OrganizationRole = "customer" | "partner" | "vendor" | "supplier" | "prospect";

export type OrganizationStatus = "lead" | "active" | "inactive";

// Many-to-many mapping of contacts to organizations
export interface ContactOrganizationLink {
  contactId: UUID;
  organizationId: UUID;
  // Optional role of the contact within the organization
  role?: string | null;
  createdAt?: Timestamp;
}

// ============================================
// Sales Types - Deals & Pipeline
// ============================================

export type DealStage =
  | "discovery"
  | "proposal"
  | "negotiation"
  | "contract"
  | "closed_won"
  | "closed_lost";

export type DealPriority = "low" | "medium" | "high" | "urgent";

export interface Deal extends BaseEntity {
  title: string;
  description?: string;
  value: number;
  currency: string;
  stage: DealStage;
  priority: DealPriority;
  probability: number; // 0-100
  expectedCloseDate?: Timestamp;
  actualCloseDate?: Timestamp;
  contactId?: UUID;
  leadId?: UUID;
  assignedTo: UUID;
  tags?: string[];
}

export interface Pipeline extends BaseEntity {
  name: string;
  description?: string;
  stages: PipelineStage[];
  isDefault: boolean;
}

export interface PipelineStage {
  id: UUID;
  name: string;
  order: number;
  probability: number;
  color?: string;
}

// ============================================
// Sales Module - Quotes, Invoices, Delivery Notes
// ============================================

// Quote (Ponuda)
export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

export interface QuoteItem {
  id: UUID;
  quoteId: UUID;
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

export interface Quote extends BaseEntity {
  quoteNumber: string;
  companyId: UUID;
  contactId?: UUID;
  status: QuoteStatus;
  issueDate: Timestamp;
  validUntil: Timestamp;
  items: QuoteItem[];
  subtotal: number;
  taxRate: number;
  tax: number;
  total: number;
  notes?: string;
  terms?: string;
  /** Seller/From details as JSON object */
  fromDetails?: unknown;
  createdBy: UUID;
}

export interface QuoteWithRelations extends Quote {
  company?: Company;
  contact?: Contact;
}

// Invoice (Faktura)
export type InvoiceStatus = "draft" | "sent" | "paid" | "partial" | "overdue" | "cancelled";

export interface InvoiceItem {
  id: UUID;
  invoiceId: UUID;
  productName: string;
  description?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  discount: number;
  vatRate?: number;
  total: number;
}

export interface Invoice extends BaseEntity {
  invoiceNumber: string;
  quoteId?: UUID;
  companyId: UUID;
  contactId?: UUID;
  status: InvoiceStatus;
  issueDate: Timestamp;
  dueDate: Timestamp;
  items: InvoiceItem[];
  /** Gross total before discount (sum of all items) */
  grossTotal?: number;
  /** Subtotal after discount is applied */
  subtotal: number;
  /** Discount amount applied to the invoice */
  discount?: number;
  taxRate: number;
  vatRate?: number;
  tax: number;
  total: number;
  paidAmount: number;
  currency?: string;
  notes?: string;
  terms?: string;
  /** Seller/From details as JSON object */
  fromDetails?: unknown;
  /** Customer/Bill to details as JSON object */
  customerDetails?: unknown;
  /** Logo URL or base64 data */
  logoUrl?: string;
  /** Template settings as JSON object */
  templateSettings?: unknown;
  createdBy: UUID;
}

export interface InvoiceWithRelations extends Invoice {
  company?: Company;
  contact?: Contact;
  quote?: Quote;
}

// Delivery Note (Otpremnica)
export type DeliveryNoteStatus = "pending" | "in_transit" | "delivered" | "returned";

export interface DeliveryNoteItem {
  id: UUID;
  deliveryNoteId: UUID;
  productName: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number;
  total?: number;
}

export interface DeliveryNote extends BaseEntity {
  deliveryNumber: string;
  invoiceId?: UUID;
  companyId: UUID;
  contactId?: UUID;
  status: DeliveryNoteStatus;
  shipDate?: Timestamp;
  deliveryDate?: Timestamp;
  items: DeliveryNoteItem[];
  shippingAddress: string;
  trackingNumber?: string;
  carrier?: string;
  taxRate: number;
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
  terms?: string;
  /** Seller/From details as JSON object */
  fromDetails?: unknown;
  /** Customer/Bill to details as JSON object */
  customerDetails?: unknown;
  createdBy: UUID;
}

export interface DeliveryNoteWithRelations extends DeliveryNote {
  company?: Company;
  contact?: Contact;
  invoice?: Invoice;
}

// Order (Narudžba)
export type OrderStatus = "pending" | "processing" | "completed" | "cancelled" | "refunded";

export interface Order extends BaseEntity {
  orderNumber: string;
  companyId: UUID;
  contactId?: UUID | null;
  quoteId?: UUID | null;
  invoiceId?: UUID | null;
  status: OrderStatus;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  notes?: string | null;
  /** Seller/From details as JSON object */
  fromDetails?: unknown;
  /** Customer/Bill to details as JSON object */
  customerDetails?: unknown;
  createdBy: UUID;
}

export interface OrderWithRelations extends Order {
  company?: Company;
  contact?: Contact;
  quote?: Quote;
  invoice?: Invoice;
}

// ============================================
// Project Types
// ============================================

export type ProjectStatus = "planning" | "in_progress" | "on_hold" | "completed" | "cancelled";

export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Project extends BaseEntity {
  name: string;
  description?: string;
  status: ProjectStatus;
  startDate?: Timestamp;
  endDate?: Timestamp;
  budget?: number;
  currency?: string;
  clientId?: UUID;
  dealId?: UUID;
  managerId: UUID;
  teamMembers: UUID[];
  tags?: string[];
}

export interface Task extends BaseEntity {
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  projectId: UUID;
  milestoneId?: UUID;
  assignedTo?: UUID;
  dueDate?: Timestamp;
  estimatedHours?: number;
  actualHours?: number;
  parentTaskId?: UUID;
  tags?: string[];
}

// Milestone
export type MilestoneStatus = "pending" | "in_progress" | "completed" | "delayed";

export interface Milestone extends BaseEntity {
  name: string;
  description?: string;
  projectId: UUID;
  status: MilestoneStatus;
  dueDate: Timestamp;
  completedDate?: Timestamp;
  order: number;
}

export interface MilestoneWithTasks extends Milestone {
  tasks?: Task[];
  completedTasks?: number;
  totalTasks?: number;
}

// ============================================
// Activity & Notes
// ============================================

export type ActivityType =
  | "call"
  | "email"
  | "meeting"
  | "note"
  | "task"
  | "deal_update"
  | "status_change";

export interface Activity extends BaseEntity {
  type: ActivityType;
  title: string;
  description?: string;
  userId: UUID;
  entityType: "lead" | "contact" | "deal" | "project";
  entityId: UUID;
  metadata?: Record<string, unknown>;
}

// ============================================
// Product Catalog Types
// ============================================

export interface ProductCategory extends BaseEntity {
  name: string;
  description?: string;
  parentId?: UUID;
  sortOrder: number;
  isActive: boolean;
}

export interface ProductCategoryWithChildren extends ProductCategory {
  children?: ProductCategory[];
  productCount?: number;
}

export interface Product extends BaseEntity {
  name: string;
  sku?: string;
  description?: string;
  unitPrice: number;
  costPrice?: number;
  currency: string;
  unit: string;
  taxRate: number;
  categoryId?: UUID;
  stockQuantity?: number;
  minStockLevel?: number;
  isActive: boolean;
  isService: boolean;
  metadata?: Record<string, unknown>;
  // Smart product tracking fields (like midday-main)
  usageCount?: number;
  lastUsedAt?: Timestamp;
}

export interface ProductWithCategory extends Product {
  category?: ProductCategory;
}

// ============================================
// Notification Types
// ============================================

export type NotificationType =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "invoice_created"
  | "invoice_paid"
  | "invoice_overdue"
  | "quote_created"
  | "quote_accepted"
  | "quote_rejected"
  | "task_assigned"
  | "task_completed"
  | "task_overdue"
  | "project_created"
  | "project_completed"
  | "lead_assigned"
  | "deal_won"
  | "deal_lost"
  | "system"
  | "mention"
  | "reminder";

export type NotificationChannel = "in_app" | "email" | "both";

export interface Notification {
  id: UUID;
  userId: UUID;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  message: string;
  link?: string;
  entityType?: string;
  entityId?: UUID;
  isRead: boolean;
  readAt?: Timestamp;
  emailSent: boolean;
  emailSentAt?: Timestamp;
  metadata?: Record<string, unknown>;
  createdAt: Timestamp;
}

export interface NotificationPreferences {
  userId: UUID;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  types: Partial<Record<NotificationType, NotificationChannel>>;
}

// ============================================
// Payment Types
// ============================================

export type PaymentMethod =
  | "cash"
  | "credit_card"
  | "debit_card"
  | "bank_transfer"
  | "check"
  | "paypal"
  | "stripe"
  | "other";

export type PaymentStatus = "pending" | "completed" | "failed" | "refunded" | "cancelled";

export interface Payment {
  id: UUID;
  invoiceId: UUID;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  paymentDate: Timestamp;
  reference?: string;
  transactionId?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  recordedBy: UUID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PaymentWithInvoice extends Payment {
  invoice?: Invoice;
}

export interface PaymentSummary {
  totalPaid: number;
  totalPending: number;
  totalRefunded: number;
  paymentCount: number;
  currency: string;
}

// ============================================
// API Types
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ResponseMeta {
  page?: number;
  pageSize?: number;
  totalCount?: number;
  totalPages?: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface FilterParams {
  search?: string;
  status?: string;
  assignedTo?: UUID;
  dateFrom?: Timestamp;
  dateTo?: Timestamp;
  tags?: string[];
  /** Company source filter */
  source?: "account" | "customer";
  /** Tenant scoping */
  tenantId?: UUID;
}

// ============================================
// Request/Response Types
// ============================================

export type CreateCompanyRequest = Omit<Company, keyof BaseEntity>;
export type UpdateCompanyRequest = Partial<CreateCompanyRequest>;

export type CreateUserRequest = Omit<User, keyof BaseEntity | "lastLoginAt" | "status">;
export type UpdateUserRequest = Partial<CreateUserRequest>;

export type CreateLeadRequest = Omit<Lead, keyof BaseEntity>;
export type UpdateLeadRequest = Partial<CreateLeadRequest>;

export type CreateContactRequest = Omit<Contact, keyof BaseEntity>;
export type UpdateContactRequest = Partial<CreateContactRequest>;

export type CreateDealRequest = Omit<Deal, keyof BaseEntity>;
export type UpdateDealRequest = Partial<CreateDealRequest>;

export type CreateProjectRequest = Omit<Project, keyof BaseEntity>;
export type UpdateProjectRequest = Partial<CreateProjectRequest>;

export type CreateTaskRequest = Omit<Task, keyof BaseEntity>;
export type UpdateTaskRequest = Partial<CreateTaskRequest>;

export type CreateMilestoneRequest = Omit<Milestone, keyof BaseEntity | "order">;
export type UpdateMilestoneRequest = Partial<CreateMilestoneRequest>;

// Sales Module Request Types
export type CreateQuoteRequest = Omit<Quote, keyof BaseEntity | "quoteNumber" | "items"> & {
  items: Omit<QuoteItem, "id" | "quoteId">[];
  sellerCompanyId?: UUID;
};
export type UpdateQuoteRequest = Partial<Omit<CreateQuoteRequest, "items">> & {
  items?: Omit<QuoteItem, "quoteId">[];
};

export type CreateInvoiceRequest = Omit<
  Invoice,
  keyof BaseEntity | "invoiceNumber" | "items" | "paidAmount"
> & {
  items: Omit<InvoiceItem, "id" | "invoiceId">[];
  sellerCompanyId?: UUID;
};
export type UpdateInvoiceRequest = Partial<Omit<CreateInvoiceRequest, "items">> & {
  items?: Omit<InvoiceItem, "invoiceId">[];
};

export type CreateDeliveryNoteRequest = Omit<
  DeliveryNote,
  keyof BaseEntity | "deliveryNumber" | "items"
> & {
  items: Omit<DeliveryNoteItem, "id" | "deliveryNoteId">[];
  sellerCompanyId?: UUID;
};
export type UpdateDeliveryNoteRequest = Partial<Omit<CreateDeliveryNoteRequest, "items">> & {
  items?: Omit<DeliveryNoteItem, "deliveryNoteId">[];
};

export type CreateOrderRequest = Omit<Order, keyof BaseEntity | "orderNumber"> & {
  sellerCompanyId?: UUID;
  items?: Array<{
    productName: string;
    description?: string | null;
    quantity: number;
    unitPrice: number;
    discount?: number;
    total: number;
  }>;
};
export type UpdateOrderRequest = Partial<CreateOrderRequest>;

// Product Catalog Request Types
export type CreateProductCategoryRequest = Omit<ProductCategory, keyof BaseEntity | "sortOrder">;
export type UpdateProductCategoryRequest = Partial<CreateProductCategoryRequest>;

export type CreateProductRequest = Omit<Product, keyof BaseEntity>;
export type UpdateProductRequest = Partial<CreateProductRequest>;

// Notification Request Types
export interface CreateNotificationRequest {
  userId: UUID;
  type: NotificationType;
  channel?: NotificationChannel;
  title: string;
  message: string;
  link?: string;
  entityType?: string;
  entityId?: UUID;
  metadata?: Record<string, unknown>;
}

export interface BulkCreateNotificationRequest {
  userIds: UUID[];
  type: NotificationType;
  channel?: NotificationChannel;
  title: string;
  message: string;
  link?: string;
  entityType?: string;
  entityId?: UUID;
  metadata?: Record<string, unknown>;
}

// Payment Request Types
export interface CreatePaymentRequest {
  invoiceId: UUID;
  amount: number;
  currency?: string;
  paymentMethod: PaymentMethod;
  paymentDate?: Timestamp;
  reference?: string;
  transactionId?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdatePaymentRequest {
  status?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  reference?: string;
  transactionId?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

// ============================================
// Report Types
// ============================================

export interface ReportFilters extends FilterParams {
  companyId?: UUID;
  userId?: UUID;
  projectId?: UUID;
  industry?: string;
  role?: string;
}

export interface DateRangeFilter {
  startDate?: Timestamp;
  endDate?: Timestamp;
}

export interface UserReport extends User {
  companyName?: string;
  totalProjects?: number;
  totalTasks?: number;
}

export interface CompanyReport extends Company {
  totalUsers?: number;
  totalQuotes?: number;
  totalInvoices?: number;
  totalRevenue?: number;
}

export interface QuoteReport extends Quote {
  companyName?: string;
  createdByName?: string;
}

export interface InvoiceReport extends Invoice {
  companyName?: string;
  createdByName?: string;
  outstandingAmount?: number;
}

export interface DeliveryNoteReport extends DeliveryNote {
  companyName?: string;
  invoiceNumber?: string;
}

export interface ProjectReport extends Project {
  managerName?: string;
  taskCount?: number;
  completedTaskCount?: number;
  progressPercent?: number;
  milestoneCount?: number;
  completedMilestoneCount?: number;
}

export interface TaskReport extends Task {
  projectName?: string;
  milestoneName?: string;
  assignedToName?: string;
}

export interface MilestoneReport extends Milestone {
  projectName?: string;
  taskCount?: number;
  completedTaskCount?: number;
  progressPercent?: number;
}

// Summary/Dashboard Types
export interface SalesSummary {
  totalQuotes: number;
  totalQuoteValue: number;
  pendingQuotes: number;
  acceptedQuotes: number;
  totalInvoices: number;
  totalInvoiceValue: number;
  paidInvoices: number;
  unpaidAmount: number;
  overdueInvoices: number;
}

export interface ProjectSummary {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  totalMilestones: number;
  completedMilestones: number;
}

// ============================================
// Analytics Types
// ============================================

// Revenue Analytics
export interface RevenuePoint {
  date: string;
  revenue: number;
  invoiceCount: number;
}

export interface CompanyRevenue {
  companyId: UUID;
  companyName: string;
  revenue: number;
  invoiceCount: number;
  industry?: string;
}

export interface TopCustomer {
  companyId: UUID;
  companyName: string;
  industry?: string;
  totalRevenue: number;
  paidRevenue: number;
  invoiceCount: number;
  quoteCount: number;
  conversionRate: number;
}

export interface ConversionFunnel {
  totalQuotes: number;
  sentQuotes: number;
  acceptedQuotes: number;
  convertedToInvoice: number;
  paidInvoices: number;
  conversionRate: number;
  avgDaysToConvert: number;
}

export interface InvoiceStatusBreakdown {
  status: InvoiceStatus;
  count: number;
  totalValue: number;
}

// Project Analytics
export interface TaskStatPoint {
  date: string;
  created: number;
  completed: number;
  pending: number;
}

export interface MilestoneBreakdown {
  status: MilestoneStatus;
  count: number;
  percentage: number;
}

export interface TaskPriorityStats {
  priority: TaskPriority;
  count: number;
  completedCount: number;
  percentage: number;
}

export interface ProjectDurationStats {
  avgDurationDays: number;
  minDurationDays: number;
  maxDurationDays: number;
  onTimePercentage: number;
}

// Analytics Filter Types
export interface AnalyticsDateRange {
  from: Timestamp;
  to: Timestamp;
}

export interface SalesAnalyticsFilters {
  dateRange?: AnalyticsDateRange;
  companyId?: UUID;
  status?: InvoiceStatus | QuoteStatus;
}

export interface ProjectAnalyticsFilters {
  dateRange?: AnalyticsDateRange;
  projectId?: UUID;
  status?: ProjectStatus | TaskStatus;
  userId?: UUID;
}
