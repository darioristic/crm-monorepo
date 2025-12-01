import { z } from "zod";

// ============================================
// Common Validators
// ============================================

export const uuidSchema = z.string().uuid("Invalid UUID format");

export const emailSchema = z.string().email("Invalid email format").toLowerCase().trim();

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be less than 128 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

export const simplePasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be less than 128 characters");

export const dateSchema = z.string().datetime({ message: "Invalid date format" });

export const optionalDateSchema = z.string().datetime().optional().nullable();

export const positiveNumberSchema = z.number().positive("Must be a positive number");

export const nonNegativeNumberSchema = z.number().nonnegative("Must be zero or positive");

export const currencySchema = z.string().length(3, "Currency must be a 3-letter code").toUpperCase();

export const phoneSchema = z
  .string()
  .regex(/^[+]?[\d\s\-()]{6,20}$/, "Invalid phone number format")
  .optional()
  .nullable();

// ============================================
// Pagination & Filtering
// ============================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export const filterSchema = z.object({
  search: z.string().max(200).optional(),
  status: z.string().optional(),
  companyId: uuidSchema.optional(),
  userId: uuidSchema.optional(),
  projectId: uuidSchema.optional(),
  assignedTo: uuidSchema.optional(),
});

export const dateRangeSchema = z.object({
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});

// ============================================
// Auth Schemas
// ============================================

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100).trim(),
  lastName: z.string().min(1, "Last name is required").max(100).trim(),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(["admin", "user"]).optional().default("user"),
  companyId: uuidSchema.optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});

// ============================================
// User Schemas
// ============================================

export const createUserSchema = z.object({
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  email: emailSchema,
  role: z.enum(["admin", "user"]).default("user"),
  companyId: uuidSchema.optional().nullable(),
  status: z.enum(["active", "inactive", "pending"]).optional().default("active"),
  avatarUrl: z.string().url().optional().nullable(),
  phone: phoneSchema,
});

export const updateUserSchema = createUserSchema.partial();

// ============================================
// Company Schemas
// ============================================

export const createCompanySchema = z.object({
  name: z.string().min(1, "Company name is required").max(255).trim(),
  industry: z.string().min(1, "Industry is required").max(255).trim(),
  address: z.string().min(1, "Address is required").trim(),
});

export const updateCompanySchema = createCompanySchema.partial();

// ============================================
// Lead Schemas
// ============================================

export const leadStatusSchema = z.enum(["new", "contacted", "qualified", "proposal", "won", "lost"]);
export const leadSourceSchema = z.enum(["website", "referral", "linkedin", "cold_call", "advertisement", "other"]);

export const createLeadSchema = z.object({
  name: z.string().min(1, "Name is required").max(255).trim(),
  email: emailSchema,
  phone: phoneSchema,
  company: z.string().max(255).optional().nullable(),
  position: z.string().max(255).optional().nullable(),
  status: leadStatusSchema.optional().default("new"),
  source: leadSourceSchema.optional().default("website"),
  assignedTo: uuidSchema.optional().nullable(),
  value: nonNegativeNumberSchema.optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const updateLeadSchema = createLeadSchema.partial();

// ============================================
// Contact Schemas
// ============================================

export const createContactSchema = z.object({
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  email: emailSchema,
  phone: phoneSchema,
  company: z.string().max(255).optional().nullable(),
  position: z.string().max(255).optional().nullable(),
  street: z.string().max(255).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  leadId: uuidSchema.optional().nullable(),
});

export const updateContactSchema = createContactSchema.partial();

// ============================================
// Deal Schemas
// ============================================

export const dealStageSchema = z.enum([
  "discovery",
  "proposal",
  "negotiation",
  "contract",
  "closed_won",
  "closed_lost",
]);

export const dealPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

export const createDealSchema = z.object({
  title: z.string().min(1, "Title is required").max(255).trim(),
  description: z.string().max(5000).optional().nullable(),
  value: positiveNumberSchema,
  currency: currencySchema.optional().default("USD"),
  stage: dealStageSchema.optional().default("discovery"),
  priority: dealPrioritySchema.optional().default("medium"),
  probability: z.number().int().min(0).max(100).optional().default(20),
  expectedCloseDate: optionalDateSchema,
  contactId: uuidSchema.optional().nullable(),
  leadId: uuidSchema.optional().nullable(),
  assignedTo: uuidSchema,
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const updateDealSchema = createDealSchema.partial().omit({ assignedTo: true }).extend({
  assignedTo: uuidSchema.optional(),
  actualCloseDate: optionalDateSchema,
});

// ============================================
// Quote Schemas
// ============================================

export const quoteStatusSchema = z.enum(["draft", "sent", "accepted", "rejected", "expired"]);

export const quoteItemSchema = z.object({
  id: uuidSchema.optional(),
  productName: z.string().min(1, "Product name is required").max(255).trim(),
  description: z.string().max(1000).optional().nullable(),
  quantity: positiveNumberSchema,
  unitPrice: nonNegativeNumberSchema,
  discount: z.number().min(0).max(100).optional().default(0),
});

export const createQuoteSchema = z.object({
  companyId: uuidSchema,
  contactId: uuidSchema.optional().nullable(),
  status: quoteStatusSchema.optional().default("draft"),
  issueDate: dateSchema.optional(),
  validUntil: dateSchema,
  taxRate: z.number().min(0).max(100).optional().default(0),
  notes: z.string().max(5000).optional().nullable(),
  terms: z.string().max(5000).optional().nullable(),
  items: z.array(quoteItemSchema).min(1, "At least one item is required"),
  createdBy: uuidSchema,
});

export const updateQuoteSchema = createQuoteSchema.partial().omit({ createdBy: true });

// ============================================
// Invoice Schemas
// ============================================

export const invoiceStatusSchema = z.enum(["draft", "sent", "paid", "partial", "overdue", "cancelled"]);

export const invoiceItemSchema = z.object({
  id: uuidSchema.optional(),
  productName: z.string().min(1, "Product name is required").max(255).trim(),
  description: z.string().max(1000).optional().nullable(),
  quantity: positiveNumberSchema,
  unitPrice: nonNegativeNumberSchema,
  discount: z.number().min(0).max(100).optional().default(0),
});

export const createInvoiceSchema = z.object({
  quoteId: uuidSchema.optional().nullable(),
  companyId: uuidSchema,
  contactId: uuidSchema.optional().nullable(),
  status: invoiceStatusSchema.optional().default("draft"),
  issueDate: dateSchema.optional(),
  dueDate: dateSchema,
  taxRate: z.number().min(0).max(100).optional().default(0),
  notes: z.string().max(5000).optional().nullable(),
  terms: z.string().max(5000).optional().nullable(),
  items: z.array(invoiceItemSchema).min(1, "At least one item is required"),
  createdBy: uuidSchema,
});

export const updateInvoiceSchema = createInvoiceSchema.partial().omit({ createdBy: true });

export const recordPaymentSchema = z.object({
  amount: positiveNumberSchema,
});

// ============================================
// Delivery Note Schemas
// ============================================

export const deliveryStatusSchema = z.enum(["pending", "in_transit", "delivered", "returned"]);

export const deliveryItemSchema = z.object({
  id: uuidSchema.optional(),
  productName: z.string().min(1, "Product name is required").max(255).trim(),
  description: z.string().max(1000).optional().nullable(),
  quantity: positiveNumberSchema,
  unit: z.string().max(50).optional().default("pcs"),
});

export const createDeliveryNoteSchema = z.object({
  invoiceId: uuidSchema.optional().nullable(),
  companyId: uuidSchema,
  contactId: uuidSchema.optional().nullable(),
  status: deliveryStatusSchema.optional().default("pending"),
  shipDate: optionalDateSchema,
  deliveryDate: optionalDateSchema,
  shippingAddress: z.string().min(1, "Shipping address is required").max(500).trim(),
  trackingNumber: z.string().max(100).optional().nullable(),
  carrier: z.string().max(100).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  items: z.array(deliveryItemSchema).min(1, "At least one item is required"),
  createdBy: uuidSchema,
});

export const updateDeliveryNoteSchema = createDeliveryNoteSchema.partial().omit({ createdBy: true });

// ============================================
// Project Schemas
// ============================================

export const projectStatusSchema = z.enum(["planning", "in_progress", "on_hold", "completed", "cancelled"]);

export const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(255).trim(),
  description: z.string().max(5000).optional().nullable(),
  status: projectStatusSchema.optional().default("planning"),
  startDate: optionalDateSchema,
  endDate: optionalDateSchema,
  budget: nonNegativeNumberSchema.optional().nullable(),
  currency: currencySchema.optional(),
  clientId: uuidSchema.optional().nullable(),
  dealId: uuidSchema.optional().nullable(),
  managerId: uuidSchema,
  teamMembers: z.array(uuidSchema).optional().default([]),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const updateProjectSchema = createProjectSchema.partial().omit({ managerId: true }).extend({
  managerId: uuidSchema.optional(),
});

// ============================================
// Task Schemas
// ============================================

export const taskStatusSchema = z.enum(["todo", "in_progress", "review", "done"]);
export const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(255).trim(),
  description: z.string().max(5000).optional().nullable(),
  status: taskStatusSchema.optional().default("todo"),
  priority: taskPrioritySchema.optional().default("medium"),
  projectId: uuidSchema,
  milestoneId: uuidSchema.optional().nullable(),
  assignedTo: uuidSchema.optional().nullable(),
  dueDate: optionalDateSchema,
  estimatedHours: nonNegativeNumberSchema.optional().nullable(),
  actualHours: nonNegativeNumberSchema.optional().nullable(),
  parentTaskId: uuidSchema.optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const updateTaskSchema = createTaskSchema.partial().omit({ projectId: true });

// ============================================
// Milestone Schemas
// ============================================

export const milestoneStatusSchema = z.enum(["pending", "in_progress", "completed", "delayed"]);

export const createMilestoneSchema = z.object({
  name: z.string().min(1, "Name is required").max(255).trim(),
  description: z.string().max(5000).optional().nullable(),
  projectId: uuidSchema,
  status: milestoneStatusSchema.optional().default("pending"),
  dueDate: dateSchema,
});

export const updateMilestoneSchema = createMilestoneSchema.partial().omit({ projectId: true });

// ============================================
// Product Schemas
// ============================================

export const createProductCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(255).trim(),
  description: z.string().max(1000).optional().nullable(),
  parentId: uuidSchema.optional().nullable(),
  sortOrder: z.number().int().nonnegative().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const updateProductCategorySchema = createProductCategorySchema.partial();

export const createProductSchema = z.object({
  name: z.string().min(1, "Name is required").max(255).trim(),
  sku: z.string().max(100).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  unitPrice: nonNegativeNumberSchema,
  costPrice: nonNegativeNumberSchema.optional().nullable(),
  currency: currencySchema.optional().default("EUR"),
  unit: z.string().max(50).optional().default("pcs"),
  taxRate: z.number().min(0).max(100).optional().default(0),
  categoryId: uuidSchema.optional().nullable(),
  stockQuantity: nonNegativeNumberSchema.optional().nullable(),
  minStockLevel: nonNegativeNumberSchema.optional().nullable(),
  isActive: z.boolean().optional().default(true),
  isService: z.boolean().optional().default(false),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export const updateProductSchema = createProductSchema.partial();

export const updateStockSchema = z.object({
  quantity: z.number(),
});

// ============================================
// Notification Schemas
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
  type: notificationTypeSchema.optional().default("info"),
  channel: notificationChannelSchema.optional().default("in_app"),
  title: z.string().min(1, "Title is required").max(255).trim(),
  message: z.string().min(1, "Message is required").max(5000).trim(),
  link: z.string().url().max(500).optional().nullable(),
  entityType: z.string().max(50).optional().nullable(),
  entityId: uuidSchema.optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

// ============================================
// Payment Schemas
// ============================================

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

export const paymentStatusSchema = z.enum(["pending", "completed", "failed", "refunded", "cancelled"]);

export const createPaymentSchema = z.object({
  invoiceId: uuidSchema,
  amount: positiveNumberSchema,
  currency: currencySchema.optional().default("EUR"),
  paymentMethod: paymentMethodSchema.optional().default("bank_transfer"),
  status: paymentStatusSchema.optional().default("completed"),
  paymentDate: dateSchema.optional(),
  reference: z.string().max(255).optional().nullable(),
  transactionId: z.string().max(255).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
  recordedBy: uuidSchema,
});

export const updatePaymentSchema = createPaymentSchema.partial().omit({ invoiceId: true, recordedBy: true });

// ============================================
// Invoice Template Schema
// ============================================

export const invoiceTemplateSchema = z.object({
  logoUrl: z.string().url().optional().nullable(),
  title: z.string().max(100).optional().default("Invoice"),
  fromLabel: z.string().max(50).optional().default("From"),
  customerLabel: z.string().max(50).optional().default("Bill To"),
  invoiceNoLabel: z.string().max(50).optional().default("Invoice No"),
  issueDateLabel: z.string().max(50).optional().default("Issue Date"),
  dueDateLabel: z.string().max(50).optional().default("Due Date"),
  descriptionLabel: z.string().max(50).optional().default("Description"),
  priceLabel: z.string().max(50).optional().default("Price"),
  quantityLabel: z.string().max(50).optional().default("Qty"),
  totalLabel: z.string().max(50).optional().default("Total"),
  subtotalLabel: z.string().max(50).optional().default("Subtotal"),
  vatLabel: z.string().max(50).optional().default("VAT"),
  taxLabel: z.string().max(50).optional().default("Tax"),
  discountLabel: z.string().max(50).optional().default("Discount"),
  paymentLabel: z.string().max(50).optional().default("Payment Details"),
  noteLabel: z.string().max(50).optional().default("Notes"),
  currency: currencySchema.optional().default("EUR"),
  dateFormat: z.string().max(20).optional().default("dd/MM/yyyy"),
  includeVat: z.boolean().optional().default(true),
  includeTax: z.boolean().optional().default(false),
  includeDiscount: z.boolean().optional().default(false),
  includeDecimals: z.boolean().optional().default(true),
  includeQr: z.boolean().optional().default(false),
  vatRate: z.number().min(0).max(100).optional().default(20),
  taxRate: z.number().min(0).max(100).optional().default(0),
  pageSize: z.enum(["a4", "letter"]).optional().default("a4"),
  locale: z.string().max(10).optional().default("sr-RS"),
  timezone: z.string().max(50).optional().default("Europe/Belgrade"),
  paymentDetails: z.string().max(1000).optional().nullable(),
  fromDetails: z.string().max(1000).optional().nullable(),
  noteDetails: z.string().max(1000).optional().nullable(),
});

// ============================================
// Type Exports
// ============================================

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type CreateDealInput = z.infer<typeof createDealSchema>;
export type UpdateDealInput = z.infer<typeof updateDealSchema>;
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type CreateDeliveryNoteInput = z.infer<typeof createDeliveryNoteSchema>;
export type UpdateDeliveryNoteInput = z.infer<typeof updateDeliveryNoteSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
export type InvoiceTemplateInput = z.infer<typeof invoiceTemplateSchema>;

