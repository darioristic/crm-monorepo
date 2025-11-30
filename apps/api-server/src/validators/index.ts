/**
 * Centralizovani Zod validatori za sve CRUD operacije
 * 
 * Svaki validator uključuje:
 * - Tipsku validaciju
 * - Sanitizaciju (trim, lowercase gde je potrebno)
 * - Ograničenja dužine
 * - Format validaciju (email, UUID, URL)
 */

import { z } from "zod";

// ============================================
// Pomoćni validatori
// ============================================

/** UUID v4 validator */
export const uuidSchema = z.string().uuid("Invalid UUID format");

/** Email validator sa lowercase normalizacijom */
export const emailSchema = z
  .string()
  .email("Invalid email format")
  .max(255, "Email too long")
  .transform((val) => val.toLowerCase().trim());

/** Opcioni UUID */
export const optionalUuidSchema = uuidSchema.optional();

/** Telefon validator (fleksibilan format) */
export const phoneSchema = z
  .string()
  .max(50, "Phone number too long")
  .regex(/^[+\d\s\-()]+$/, "Invalid phone format")
  .optional();

/** URL validator */
export const urlSchema = z.string().url("Invalid URL format").max(500).optional();

/** Procenat validator (0-100) */
export const percentageSchema = z.number().min(0).max(100);

/** Novčani iznos validator */
export const moneySchema = z.number().min(0, "Amount must be positive");

/** Valuta (3 karaktera) */
export const currencySchema = z.string().length(3, "Currency must be 3 characters").default("EUR");

/** Status validatori */
export const leadStatusSchema = z.enum([
  "new",
  "contacted",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
]);

export const leadSourceSchema = z.enum([
  "website",
  "referral",
  "social",
  "email",
  "event",
  "cold_call",
  "other",
]);

export const dealStageSchema = z.enum([
  "discovery",
  "proposal",
  "negotiation",
  "contract",
  "closed_won",
  "closed_lost",
]);

export const prioritySchema = z.enum(["low", "medium", "high"]);

export const projectStatusSchema = z.enum([
  "planning",
  "active",
  "on_hold",
  "completed",
  "cancelled",
]);

export const taskStatusSchema = z.enum(["todo", "in_progress", "review", "done", "blocked"]);

export const quoteStatusSchema = z.enum(["draft", "sent", "accepted", "rejected", "expired"]);

export const invoiceStatusSchema = z.enum([
  "draft",
  "sent",
  "partial",
  "paid",
  "overdue",
  "cancelled",
]);

export const deliveryNoteStatusSchema = z.enum([
  "pending",
  "in_transit",
  "delivered",
  "cancelled",
]);

export const milestoneStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "completed",
  "delayed",
]);

export const paymentMethodSchema = z.enum([
  "cash",
  "credit_card",
  "debit_card",
  "bank_transfer",
  "check",
  "paypal",
  "stripe",
  "other",
]);

export const paymentStatusSchema = z.enum([
  "pending",
  "completed",
  "failed",
  "refunded",
  "cancelled",
]);

// ============================================
// Company Validators
// ============================================

export const createCompanySchema = z.object({
  name: z.string().min(1, "Name is required").max(255).trim(),
  industry: z.string().min(1, "Industry is required").max(255).trim(),
  address: z.string().min(1, "Address is required").max(1000).trim(),
});

export const updateCompanySchema = createCompanySchema.partial();

// ============================================
// User Validators
// ============================================

export const createUserSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100).trim(),
  lastName: z.string().min(1, "Last name is required").max(100).trim(),
  email: emailSchema,
  role: z.enum(["admin", "user"]).default("user"),
  companyId: optionalUuidSchema,
  status: z.enum(["active", "inactive", "pending"]).default("active"),
  avatarUrl: urlSchema,
  phone: phoneSchema,
});

export const updateUserSchema = createUserSchema.partial();

// ============================================
// Lead Validators
// ============================================

export const createLeadSchema = z.object({
  name: z.string().min(1, "Name is required").max(255).trim(),
  email: emailSchema,
  phone: phoneSchema,
  company: z.string().max(255).trim().optional(),
  position: z.string().max(255).trim().optional(),
  status: leadStatusSchema.default("new"),
  source: leadSourceSchema.default("website"),
  assignedTo: optionalUuidSchema,
  value: moneySchema.optional(),
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const updateLeadSchema = createLeadSchema.partial();

// ============================================
// Contact Validators
// ============================================

export const addressSchema = z
  .object({
    street: z.string().max(500).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    postalCode: z.string().max(20).optional(),
    country: z.string().max(100).optional(),
  })
  .optional();

export const createContactSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100).trim(),
  lastName: z.string().min(1, "Last name is required").max(100).trim(),
  email: emailSchema,
  phone: phoneSchema,
  company: z.string().max(255).trim().optional(),
  position: z.string().max(255).trim().optional(),
  address: addressSchema,
  notes: z.string().max(5000).optional(),
  leadId: optionalUuidSchema,
});

export const updateContactSchema = createContactSchema.partial();

// ============================================
// Deal Validators
// ============================================

export const createDealSchema = z.object({
  title: z.string().min(1, "Title is required").max(255).trim(),
  description: z.string().max(5000).optional(),
  value: moneySchema,
  currency: currencySchema,
  stage: dealStageSchema.default("discovery"),
  priority: prioritySchema.default("medium"),
  probability: percentageSchema.default(20),
  expectedCloseDate: z.string().datetime().optional(),
  contactId: optionalUuidSchema,
  leadId: optionalUuidSchema,
  assignedTo: uuidSchema,
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const updateDealSchema = createDealSchema.partial().extend({
  actualCloseDate: z.string().datetime().optional(),
});

// ============================================
// Project Validators
// ============================================

export const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(255).trim(),
  description: z.string().max(5000).optional(),
  status: projectStatusSchema.default("planning"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  budget: moneySchema.optional(),
  currency: currencySchema.optional(),
  clientId: optionalUuidSchema,
  dealId: optionalUuidSchema,
  managerId: uuidSchema,
  teamMembers: z.array(uuidSchema).default([]),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

// ============================================
// Task Validators
// ============================================

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(255).trim(),
  description: z.string().max(5000).optional(),
  status: taskStatusSchema.default("todo"),
  priority: prioritySchema.default("medium"),
  projectId: uuidSchema,
  milestoneId: optionalUuidSchema,
  assignedTo: optionalUuidSchema,
  dueDate: z.string().datetime().optional(),
  estimatedHours: z.number().min(0).max(10000).optional(),
  actualHours: z.number().min(0).max(10000).optional(),
  parentTaskId: optionalUuidSchema,
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const updateTaskSchema = createTaskSchema.partial();

// ============================================
// Milestone Validators
// ============================================

export const createMilestoneSchema = z.object({
  name: z.string().min(1, "Name is required").max(255).trim(),
  description: z.string().max(2000).optional(),
  projectId: uuidSchema,
  status: milestoneStatusSchema.default("not_started"),
  dueDate: z.string().datetime(),
  completedDate: z.string().datetime().optional(),
});

export const updateMilestoneSchema = createMilestoneSchema.partial().extend({
  order: z.number().int().min(0).optional(),
});

// ============================================
// Quote Item Validators
// ============================================

export const quoteItemSchema = z.object({
  id: optionalUuidSchema,
  productName: z.string().min(1).max(255).trim(),
  description: z.string().max(1000).optional(),
  quantity: z.number().min(0.01, "Quantity must be positive"),
  unitPrice: moneySchema,
  discount: percentageSchema.default(0),
});

export const createQuoteSchema = z.object({
  companyId: uuidSchema,
  contactId: optionalUuidSchema,
  status: quoteStatusSchema.default("draft"),
  issueDate: z.string().datetime().optional(),
  validUntil: z.string().datetime(),
  items: z.array(quoteItemSchema).min(1, "At least one item is required"),
  taxRate: percentageSchema.default(0),
  notes: z.string().max(2000).optional(),
  terms: z.string().max(5000).optional(),
  createdBy: uuidSchema,
});

export const updateQuoteSchema = createQuoteSchema.partial();

// ============================================
// Invoice Item Validators
// ============================================

export const invoiceItemSchema = quoteItemSchema;

export const createInvoiceSchema = z.object({
  quoteId: optionalUuidSchema,
  companyId: uuidSchema,
  contactId: optionalUuidSchema,
  status: invoiceStatusSchema.default("draft"),
  issueDate: z.string().datetime().optional(),
  dueDate: z.string().datetime(),
  items: z.array(invoiceItemSchema).min(1, "At least one item is required"),
  taxRate: percentageSchema.default(0),
  notes: z.string().max(2000).optional(),
  terms: z.string().max(5000).optional(),
  createdBy: uuidSchema,
});

export const updateInvoiceSchema = createInvoiceSchema.partial();

// ============================================
// Delivery Note Item Validators
// ============================================

export const deliveryNoteItemSchema = z.object({
  id: optionalUuidSchema,
  productName: z.string().min(1).max(255).trim(),
  description: z.string().max(1000).optional(),
  quantity: z.number().min(0.01, "Quantity must be positive"),
  unit: z.string().max(20).default("pcs"),
});

export const createDeliveryNoteSchema = z.object({
  invoiceId: optionalUuidSchema,
  companyId: uuidSchema,
  contactId: optionalUuidSchema,
  status: deliveryNoteStatusSchema.default("pending"),
  shipDate: z.string().datetime().optional(),
  deliveryDate: z.string().datetime().optional(),
  shippingAddress: z.string().min(1, "Shipping address is required").max(1000),
  trackingNumber: z.string().max(100).optional(),
  carrier: z.string().max(100).optional(),
  items: z.array(deliveryNoteItemSchema).min(1, "At least one item is required"),
  notes: z.string().max(2000).optional(),
  createdBy: uuidSchema,
});

export const updateDeliveryNoteSchema = createDeliveryNoteSchema.partial();

// ============================================
// Product Validators
// ============================================

export const createProductSchema = z.object({
  name: z.string().min(1, "Name is required").max(255).trim(),
  sku: z.string().max(100).trim().optional(),
  description: z.string().max(5000).optional(),
  unitPrice: moneySchema,
  costPrice: moneySchema.optional(),
  currency: currencySchema,
  unit: z.string().max(20).default("pcs"),
  taxRate: percentageSchema.default(0),
  categoryId: optionalUuidSchema,
  stockQuantity: z.number().int().min(0).optional(),
  minStockLevel: z.number().int().min(0).optional(),
  isActive: z.boolean().default(true),
  isService: z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateProductSchema = createProductSchema.partial();

// ============================================
// Product Category Validators
// ============================================

export const createProductCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(255).trim(),
  description: z.string().max(1000).optional(),
  parentId: optionalUuidSchema,
  isActive: z.boolean().default(true),
});

export const updateProductCategorySchema = createProductCategorySchema.partial();

// ============================================
// Payment Validators
// ============================================

export const createPaymentSchema = z.object({
  invoiceId: uuidSchema,
  amount: moneySchema,
  currency: currencySchema,
  paymentMethod: paymentMethodSchema,
  paymentDate: z.string().datetime().optional(),
  reference: z.string().max(255).optional(),
  transactionId: z.string().max(255).optional(),
  notes: z.string().max(2000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updatePaymentSchema = z.object({
  status: paymentStatusSchema.optional(),
  paymentMethod: paymentMethodSchema.optional(),
  reference: z.string().max(255).optional(),
  transactionId: z.string().max(255).optional(),
  notes: z.string().max(2000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ============================================
// Notification Validators
// ============================================

export const notificationTypeSchema = z.enum([
  "info",
  "success",
  "warning",
  "error",
  "invoice_created",
  "invoice_paid",
  "invoice_overdue",
  "quote_created",
  "quote_accepted",
  "quote_rejected",
  "task_assigned",
  "task_completed",
  "task_overdue",
  "project_created",
  "project_completed",
  "lead_assigned",
  "deal_won",
  "deal_lost",
  "system",
  "mention",
  "reminder",
]);

export const notificationChannelSchema = z.enum(["in_app", "email", "both"]);

export const createNotificationSchema = z.object({
  userId: uuidSchema,
  type: notificationTypeSchema,
  channel: notificationChannelSchema.default("in_app"),
  title: z.string().min(1).max(255).trim(),
  message: z.string().min(1).max(2000),
  link: urlSchema,
  entityType: z.string().max(50).optional(),
  entityId: optionalUuidSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ============================================
// Auth Validators
// ============================================

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export const registerUserSchema = z.object({
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  email: emailSchema,
  password: changePasswordSchema.shape.newPassword,
  role: z.enum(["admin", "user"]).default("user"),
  companyId: optionalUuidSchema,
});

// ============================================
// Pagination & Filter Validators
// ============================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const filterSchema = z.object({
  search: z.string().max(200).optional(),
  status: z.string().max(50).optional(),
  assignedTo: optionalUuidSchema,
  companyId: optionalUuidSchema,
  projectId: optionalUuidSchema,
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

// ============================================
// Validator Helper Function
// ============================================

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; issues: z.ZodIssue[] };

/**
 * Validira podatke korišćenjem Zod sheme
 * @param schema Zod shema
 * @param data Podaci za validaciju
 * @returns ValidationResult
 */
export function validate<T>(schema: z.ZodType<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    error: result.error.issues[0]?.message || "Validation failed",
    issues: result.error.issues,
  };
}

// ============================================
// Type Exports
// ============================================

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type CreateDealInput = z.infer<typeof createDealSchema>;
export type UpdateDealInput = z.infer<typeof updateDealSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type CreateDeliveryNoteInput = z.infer<typeof createDeliveryNoteSchema>;
export type UpdateDeliveryNoteInput = z.infer<typeof updateDeliveryNoteSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateProductCategoryInput = z.infer<typeof createProductCategorySchema>;
export type UpdateProductCategoryInput = z.infer<typeof updateProductCategorySchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type RegisterUserInput = z.infer<typeof registerUserSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type FilterInput = z.infer<typeof filterSchema>;

