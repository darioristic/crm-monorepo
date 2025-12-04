import { pgTable, index, foreignKey, uuid, varchar, text, jsonb, timestamp, date, unique, numeric, uniqueIndex, boolean, integer, serial, primaryKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const companyRole = pgEnum("company_role", ['owner', 'member', 'admin'])
export const documentProcessingStatus = pgEnum("document_processing_status", ['pending', 'processing', 'completed', 'failed'])
export const notificationChannel = pgEnum("notification_channel", ['in_app', 'email', 'both'])
export const notificationType = pgEnum("notification_type", ['info', 'success', 'warning', 'error', 'invoice_created', 'invoice_paid', 'invoice_overdue', 'quote_created', 'quote_accepted', 'quote_rejected', 'task_assigned', 'task_completed', 'task_overdue', 'project_created', 'project_completed', 'lead_assigned', 'deal_won', 'deal_lost', 'system', 'mention', 'reminder'])
export const orderStatus = pgEnum("order_status", ['pending', 'processing', 'completed', 'cancelled', 'refunded'])
export const paymentMethod = pgEnum("payment_method", ['cash', 'credit_card', 'debit_card', 'bank_transfer', 'check', 'paypal', 'stripe', 'other'])
export const paymentStatus = pgEnum("payment_status", ['pending', 'completed', 'failed', 'refunded', 'cancelled'])
export const tenantRole = pgEnum("tenant_role", ['admin', 'manager', 'user'])
export const tenantStatus = pgEnum("tenant_status", ['active', 'suspended', 'deleted'])
export const userRole = pgEnum("user_role", ['admin', 'user', 'superadmin', 'tenant_admin', 'crm_user'])


export const auditLogs = pgTable("audit_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	action: varchar({ length: 100 }).notNull(),
	entityType: varchar("entity_type", { length: 50 }).notNull(),
	entityId: uuid("entity_id"),
	ipAddress: varchar("ip_address", { length: 45 }),
	userAgent: text("user_agent"),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_audit_logs_action").using("btree", table.action.asc().nullsLast().op("text_ops")),
	index("idx_audit_logs_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_audit_logs_entity").using("btree", table.entityType.asc().nullsLast().op("text_ops"), table.entityId.asc().nullsLast().op("text_ops")),
	index("idx_audit_logs_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "audit_logs_user_id_fkey"
		}).onDelete("set null"),
]);

export const documents = pgTable("documents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text(),
	title: text(),
	summary: text(),
	content: text(),
	body: text(),
	tag: varchar({ length: 100 }),
	date: date(),
	language: varchar({ length: 10 }),
	pathTokens: text("path_tokens").array(),
	metadata: jsonb().default({}),
	processingStatus: documentProcessingStatus("processing_status").default('pending'),
	companyId: uuid("company_id"),
	ownerId: uuid("owner_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	tenantId: uuid("tenant_id"),
	createdBy: uuid("created_by"),
}, (table) => [
	index("idx_documents_company_date").using("btree", table.companyId.asc().nullsLast().op("uuid_ops"), table.date.desc().nullsLast().op("date_ops")),
	index("idx_documents_company_id").using("btree", table.companyId.asc().nullsLast().op("uuid_ops")),
	index("idx_documents_company_status").using("btree", table.companyId.asc().nullsLast().op("uuid_ops"), table.processingStatus.asc().nullsLast().op("uuid_ops")),
	index("idx_documents_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_documents_created_by").using("btree", table.createdBy.asc().nullsLast().op("uuid_ops")),
	index("idx_documents_date").using("btree", table.date.desc().nullsLast().op("date_ops")),
	index("idx_documents_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
	index("idx_documents_owner_id").using("btree", table.ownerId.asc().nullsLast().op("uuid_ops")),
	index("idx_documents_path_tokens").using("gin", table.pathTokens.asc().nullsLast().op("array_ops")),
	index("idx_documents_processing_status").using("btree", table.processingStatus.asc().nullsLast().op("enum_ops")),
	index("idx_documents_summary_trgm").using("gin", table.summary.asc().nullsLast().op("gin_trgm_ops")),
	index("idx_documents_summary_trgm_ops").using("gin", table.summary.asc().nullsLast().op("gin_trgm_ops")).where(sql`(summary IS NOT NULL)`),
	index("idx_documents_tenant_company").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.companyId.asc().nullsLast().op("uuid_ops")),
	index("idx_documents_title_trgm").using("gin", table.title.asc().nullsLast().op("gin_trgm_ops")),
	index("idx_documents_title_trgm_ops").using("gin", table.title.asc().nullsLast().op("gin_trgm_ops")).where(sql`(title IS NOT NULL)`),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "documents_company_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [users.id],
			name: "documents_owner_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "documents_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "documents_created_by_fkey"
		}).onDelete("restrict"),
]);

export const orders = pgTable("orders", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	orderNumber: varchar("order_number", { length: 50 }).notNull(),
	companyId: uuid("company_id").notNull(),
	contactId: uuid("contact_id"),
	quoteId: uuid("quote_id"),
	invoiceId: uuid("invoice_id"),
	status: orderStatus().default('pending').notNull(),
	subtotal: numeric({ precision: 15, scale:  2 }).default('0').notNull(),
	tax: numeric({ precision: 15, scale:  2 }).default('0').notNull(),
	total: numeric({ precision: 15, scale:  2 }).default('0').notNull(),
	currency: varchar({ length: 3 }).default('EUR').notNull(),
	notes: text(),
	createdBy: uuid("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_orders_company_id").using("btree", table.companyId.asc().nullsLast().op("uuid_ops")),
	index("idx_orders_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_orders_created_by").using("btree", table.createdBy.asc().nullsLast().op("uuid_ops")),
	index("idx_orders_invoice_id").using("btree", table.invoiceId.asc().nullsLast().op("uuid_ops")),
	index("idx_orders_order_number").using("btree", table.orderNumber.asc().nullsLast().op("text_ops")),
	index("idx_orders_quote_id").using("btree", table.quoteId.asc().nullsLast().op("uuid_ops")),
	index("idx_orders_status").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "orders_company_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "orders_contact_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.quoteId],
			foreignColumns: [quotes.id],
			name: "orders_quote_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoices.id],
			name: "orders_invoice_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "orders_created_by_fkey"
		}),
	unique("orders_order_number_key").on(table.orderNumber),
]);

export const orderItems = pgTable("order_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	orderId: uuid("order_id").notNull(),
	productName: varchar("product_name", { length: 255 }).notNull(),
	description: text(),
	quantity: numeric({ precision: 10, scale:  2 }).default('1').notNull(),
	unitPrice: numeric("unit_price", { precision: 15, scale:  2 }).notNull(),
	discount: numeric({ precision: 5, scale:  2 }).default('0').notNull(),
	total: numeric({ precision: 15, scale:  2 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_order_items_order_id").using("btree", table.orderId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "order_items_order_id_fkey"
		}).onDelete("cascade"),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	firstName: varchar("first_name", { length: 100 }).notNull(),
	lastName: varchar("last_name", { length: 100 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	role: userRole().default('user').notNull(),
	companyId: uuid("company_id"),
	status: varchar({ length: 50 }).default('active'),
	avatarUrl: text("avatar_url"),
	phone: varchar({ length: 50 }),
	lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	tenantId: uuid("tenant_id"),
}, (table) => [
	index("idx_users_company_id").using("btree", table.companyId.asc().nullsLast().op("uuid_ops")),
	index("idx_users_company_role").using("btree", table.companyId.asc().nullsLast().op("uuid_ops"), table.role.asc().nullsLast().op("enum_ops")),
	uniqueIndex("idx_users_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("idx_users_email_lower").using("btree", sql`lower((email)::text)`),
	index("idx_users_role").using("btree", table.role.asc().nullsLast().op("enum_ops")),
	index("idx_users_tenant_id").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "users_company_id_companies_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "users_tenant_id_fkey"
		}).onDelete("cascade"),
	unique("users_email_unique").on(table.email),
]);

export const companies = pgTable("companies", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	industry: varchar({ length: 255 }).notNull(),
	address: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	email: varchar({ length: 255 }),
	billingEmail: varchar("billing_email", { length: 255 }),
	phone: varchar({ length: 50 }),
	website: varchar({ length: 255 }),
	contact: varchar({ length: 255 }),
	addressLine1: varchar("address_line_1", { length: 255 }),
	addressLine2: varchar("address_line_2", { length: 255 }),
	city: varchar({ length: 100 }),
	state: varchar({ length: 100 }),
	zip: varchar({ length: 20 }),
	country: varchar({ length: 100 }),
	countryCode: varchar("country_code", { length: 10 }),
	vatNumber: varchar("vat_number", { length: 50 }),
	note: text(),
	token: varchar({ length: 255 }).default('),
	// TODO: failed to parse database type 'tsvector'
	fts: unknown("fts").generatedAlwaysAs(sql`to_tsvector('english'::regconfig, (((((((((((((((((((COALESCE(name, ''::character varying))::text || ' '::text) || (COALESCE(contact, ''::character varying))::text) || ' '::text) || (COALESCE(phone, ''::character varying))::text) || ' '::text) || (COALESCE(email, ''::character varying))::text) || ' '::text) || (COALESCE(address_line_1, ''::character varying))::text) || ' '::text) || (COALESCE(address_line_2, ''::character varying))::text) || ' '::text) || (COALESCE(city, ''::character varying))::text) || ' '::text) || (COALESCE(state, ''::character varying))::text) || ' '::text) || (COALESCE(zip, ''::character varying))::text) || ' '::text) || (COALESCE(country, ''::character varying))::text))`),
	companyNumber: varchar("company_number", { length: 50 }),
	logoUrl: text("logo_url"),
	source: varchar({ length: 50 }).default('account').notNull(),
	tenantId: uuid("tenant_id"),
	locationId: uuid("location_id"),
	metadata: jsonb(),
}, (table) => [
	index("companies_fts_idx").using("gin", table.fts.asc().nullsLast().op("tsvector_ops")),
	index("idx_companies_company_id_tenant_id").using("btree", table.id.asc().nullsLast().op("uuid_ops"), table.tenantId.asc().nullsLast().op("uuid_ops")),
	index("idx_companies_country").using("btree", table.country.asc().nullsLast().op("text_ops")),
	index("idx_companies_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("idx_companies_industry").using("btree", table.industry.asc().nullsLast().op("text_ops")),
	index("idx_companies_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
	index("idx_companies_source").using("btree", table.source.asc().nullsLast().op("text_ops")),
	index("idx_companies_tenant_id").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	index("idx_companies_vat_number").using("btree", table.vatNumber.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "companies_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.locationId],
			foreignColumns: [locations.id],
			name: "companies_location_id_fkey"
		}).onDelete("set null"),
]);

export const activities = pgTable("activities", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	type: varchar({ length: 50 }).notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	userId: uuid("user_id").notNull(),
	entityType: varchar("entity_type", { length: 50 }).notNull(),
	entityId: uuid("entity_id").notNull(),
	metadata: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	tenantId: uuid("tenant_id"),
	companyId: uuid("company_id"),
}, (table) => [
	index("idx_activities_entity").using("btree", table.entityType.asc().nullsLast().op("uuid_ops"), table.entityId.asc().nullsLast().op("uuid_ops")),
	index("idx_activities_tenant_company").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.companyId.asc().nullsLast().op("uuid_ops")),
	index("idx_activities_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "activities_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "activities_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "activities_company_id_fkey"
		}).onDelete("cascade"),
]);

export const leads = pgTable("leads", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	phone: varchar({ length: 50 }),
	company: varchar({ length: 255 }),
	position: varchar({ length: 255 }),
	status: varchar({ length: 50 }).default('new').notNull(),
	source: varchar({ length: 50 }).default('website').notNull(),
	assignedTo: uuid("assigned_to"),
	value: text(),
	notes: text(),
	tags: text().array(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_leads_assigned_to").using("btree", table.assignedTo.asc().nullsLast().op("uuid_ops")),
	index("idx_leads_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("idx_leads_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.assignedTo],
			foreignColumns: [users.id],
			name: "leads_assigned_to_users_id_fk"
		}).onDelete("set null"),
]);

export const deals = pgTable("deals", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	value: text().notNull(),
	currency: varchar({ length: 3 }).default('USD').notNull(),
	stage: varchar({ length: 50 }).default('discovery').notNull(),
	priority: varchar({ length: 50 }).default('medium').notNull(),
	probability: varchar({ length: 10 }).default('20').notNull(),
	expectedCloseDate: timestamp("expected_close_date", { withTimezone: true, mode: 'string' }),
	actualCloseDate: timestamp("actual_close_date", { withTimezone: true, mode: 'string' }),
	contactId: uuid("contact_id"),
	leadId: uuid("lead_id"),
	assignedTo: uuid("assigned_to").notNull(),
	tags: text().array(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_deals_assigned_stage").using("btree", table.assignedTo.asc().nullsLast().op("text_ops"), table.stage.asc().nullsLast().op("text_ops")),
	index("idx_deals_assigned_to").using("btree", table.assignedTo.asc().nullsLast().op("uuid_ops")),
	index("idx_deals_contact_stage").using("btree", table.contactId.asc().nullsLast().op("uuid_ops"), table.stage.asc().nullsLast().op("uuid_ops")),
	index("idx_deals_stage").using("btree", table.stage.asc().nullsLast().op("text_ops")),
	index("idx_deals_stage_value").using("btree", table.stage.asc().nullsLast().op("text_ops"), table.value.desc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "deals_contact_id_contacts_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [leads.id],
			name: "deals_lead_id_leads_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.assignedTo],
			foreignColumns: [users.id],
			name: "deals_assigned_to_users_id_fk"
		}),
]);

export const projects = pgTable("projects", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	status: varchar({ length: 50 }).default('planning').notNull(),
	startDate: timestamp("start_date", { withTimezone: true, mode: 'string' }),
	endDate: timestamp("end_date", { withTimezone: true, mode: 'string' }),
	budget: text(),
	currency: varchar({ length: 3 }),
	clientId: uuid("client_id"),
	dealId: uuid("deal_id"),
	managerId: uuid("manager_id").notNull(),
	teamMembers: uuid("team_members").array(),
	tags: text().array(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_projects_manager_id").using("btree", table.managerId.asc().nullsLast().op("uuid_ops")),
	index("idx_projects_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [contacts.id],
			name: "projects_client_id_contacts_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.dealId],
			foreignColumns: [deals.id],
			name: "projects_deal_id_deals_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.managerId],
			foreignColumns: [users.id],
			name: "projects_manager_id_users_id_fk"
		}),
]);

export const tasks = pgTable("tasks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	status: varchar({ length: 50 }).default('todo').notNull(),
	priority: varchar({ length: 50 }).default('medium').notNull(),
	projectId: uuid("project_id").notNull(),
	milestoneId: uuid("milestone_id"),
	assignedTo: uuid("assigned_to"),
	dueDate: timestamp("due_date", { withTimezone: true, mode: 'string' }),
	estimatedHours: text("estimated_hours"),
	actualHours: text("actual_hours"),
	parentTaskId: uuid("parent_task_id"),
	tags: text().array(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_tasks_assigned_to").using("btree", table.assignedTo.asc().nullsLast().op("uuid_ops")),
	index("idx_tasks_milestone_id").using("btree", table.milestoneId.asc().nullsLast().op("uuid_ops")),
	index("idx_tasks_project_id").using("btree", table.projectId.asc().nullsLast().op("uuid_ops")),
	index("idx_tasks_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "tasks_project_id_projects_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.milestoneId],
			foreignColumns: [milestones.id],
			name: "tasks_milestone_id_milestones_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.assignedTo],
			foreignColumns: [users.id],
			name: "tasks_assigned_to_users_id_fk"
		}).onDelete("set null"),
]);

export const authCredentials = pgTable("auth_credentials", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	passwordHash: varchar("password_hash", { length: 255 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_auth_credentials_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "auth_credentials_user_id_fkey"
		}).onDelete("cascade"),
	unique("auth_credentials_user_id_key").on(table.userId),
]);

export const refreshTokens = pgTable("refresh_tokens", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	tokenHash: varchar("token_hash", { length: 255 }).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_refresh_tokens_expires_at").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_refresh_tokens_token_hash").using("btree", table.tokenHash.asc().nullsLast().op("text_ops")),
	index("idx_refresh_tokens_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "refresh_tokens_user_id_fkey"
		}).onDelete("cascade"),
	unique("refresh_tokens_token_hash_key").on(table.tokenHash),
]);

export const invoiceItems = pgTable("invoice_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	invoiceId: uuid("invoice_id").notNull(),
	productName: varchar("product_name", { length: 255 }).notNull(),
	description: text(),
	quantity: text().default('1').notNull(),
	unitPrice: text("unit_price").notNull(),
	discount: text().default('0').notNull(),
	total: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	unit: varchar({ length: 50 }).default('pcs').notNull(),
	vatRate: text("vat_rate").default('20').notNull(),
}, (table) => [
	index("idx_invoice_items_invoice_id").using("btree", table.invoiceId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoices.id],
			name: "invoice_items_invoice_id_invoices_id_fk"
		}).onDelete("cascade"),
]);

export const quotes = pgTable("quotes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	quoteNumber: varchar("quote_number", { length: 50 }).notNull(),
	companyId: uuid("company_id").notNull(),
	contactId: uuid("contact_id"),
	status: varchar({ length: 50 }).default('draft').notNull(),
	issueDate: timestamp("issue_date", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	validUntil: timestamp("valid_until", { withTimezone: true, mode: 'string' }).notNull(),
	subtotal: text().default('0').notNull(),
	taxRate: text("tax_rate").default('0').notNull(),
	tax: text().default('0').notNull(),
	total: text().default('0').notNull(),
	notes: text(),
	terms: text(),
	createdBy: uuid("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_quotes_company_id").using("btree", table.companyId.asc().nullsLast().op("uuid_ops")),
	index("idx_quotes_company_status").using("btree", table.companyId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("uuid_ops")),
	index("idx_quotes_created_by").using("btree", table.createdBy.asc().nullsLast().op("uuid_ops")),
	index("idx_quotes_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_quotes_status_created_at").using("btree", table.status.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "quotes_company_id_companies_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "quotes_contact_id_contacts_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "quotes_created_by_users_id_fk"
		}),
	unique("quotes_quote_number_unique").on(table.quoteNumber),
]);

export const quoteItems = pgTable("quote_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	quoteId: uuid("quote_id").notNull(),
	productName: varchar("product_name", { length: 255 }).notNull(),
	description: text(),
	quantity: text().default('1').notNull(),
	unitPrice: text("unit_price").notNull(),
	discount: text().default('0').notNull(),
	total: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_quote_items_quote_id").using("btree", table.quoteId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.quoteId],
			foreignColumns: [quotes.id],
			name: "quote_items_quote_id_quotes_id_fk"
		}).onDelete("cascade"),
]);

export const deliveryNotes = pgTable("delivery_notes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	deliveryNumber: varchar("delivery_number", { length: 50 }).notNull(),
	invoiceId: uuid("invoice_id"),
	companyId: uuid("company_id").notNull(),
	contactId: uuid("contact_id"),
	status: varchar({ length: 50 }).default('pending').notNull(),
	shipDate: timestamp("ship_date", { withTimezone: true, mode: 'string' }),
	deliveryDate: timestamp("delivery_date", { withTimezone: true, mode: 'string' }),
	shippingAddress: text("shipping_address").notNull(),
	trackingNumber: varchar("tracking_number", { length: 100 }),
	carrier: varchar({ length: 100 }),
	notes: text(),
	createdBy: uuid("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	customerDetails: text("customer_details"),
	terms: text(),
	taxRate: numeric("tax_rate", { precision: 5, scale:  2 }).default('0').notNull(),
	subtotal: numeric({ precision: 10, scale:  2 }).default('0').notNull(),
	tax: numeric({ precision: 10, scale:  2 }).default('0').notNull(),
	total: numeric({ precision: 10, scale:  2 }).default('0').notNull(),
}, (table) => [
	index("idx_delivery_notes_company_id").using("btree", table.companyId.asc().nullsLast().op("uuid_ops")),
	index("idx_delivery_notes_created_by").using("btree", table.createdBy.asc().nullsLast().op("uuid_ops")),
	index("idx_delivery_notes_invoice_id").using("btree", table.invoiceId.asc().nullsLast().op("uuid_ops")),
	index("idx_delivery_notes_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoices.id],
			name: "delivery_notes_invoice_id_invoices_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "delivery_notes_company_id_companies_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "delivery_notes_contact_id_contacts_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "delivery_notes_created_by_users_id_fk"
		}),
	unique("delivery_notes_delivery_number_unique").on(table.deliveryNumber),
]);

export const invoices = pgTable("invoices", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(),
	quoteId: uuid("quote_id"),
	companyId: uuid("company_id").notNull(),
	contactId: uuid("contact_id"),
	status: varchar({ length: 50 }).default('draft').notNull(),
	issueDate: timestamp("issue_date", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	dueDate: timestamp("due_date", { withTimezone: true, mode: 'string' }).notNull(),
	subtotal: text().default('0').notNull(),
	taxRate: text("tax_rate").default('0').notNull(),
	tax: text().default('0').notNull(),
	total: text().default('0').notNull(),
	paidAmount: text("paid_amount").default('0').notNull(),
	notes: text(),
	terms: text(),
	createdBy: uuid("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	grossTotal: text("gross_total").default('0').notNull(),
	discount: text().default('0').notNull(),
	vatRate: text("vat_rate").default('20').notNull(),
	currency: varchar({ length: 10 }).default('EUR').notNull(),
	fromDetails: text("from_details"),
	customerDetails: text("customer_details"),
	logoUrl: text("logo_url"),
	templateSettings: text("template_settings"),
	token: varchar({ length: 100 }),
	viewedAt: timestamp("viewed_at", { withTimezone: true, mode: 'string' }),
	sentAt: timestamp("sent_at", { withTimezone: true, mode: 'string' }),
	paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_invoices_company_created_at").using("btree", table.companyId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("idx_invoices_company_id").using("btree", table.companyId.asc().nullsLast().op("uuid_ops")),
	index("idx_invoices_company_status").using("btree", table.companyId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("uuid_ops")),
	index("idx_invoices_created_by").using("btree", table.createdBy.asc().nullsLast().op("uuid_ops")),
	index("idx_invoices_invoice_number_lower").using("btree", sql`lower((invoice_number)::text)`),
	index("idx_invoices_quote_id").using("btree", table.quoteId.asc().nullsLast().op("uuid_ops")),
	index("idx_invoices_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_invoices_status_created_at").using("btree", table.status.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_invoices_token").using("btree", table.token.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.quoteId],
			foreignColumns: [quotes.id],
			name: "invoices_quote_id_quotes_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "invoices_company_id_companies_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "invoices_contact_id_contacts_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "invoices_created_by_users_id_fk"
		}),
	unique("invoices_invoice_number_unique").on(table.invoiceNumber),
	unique("invoices_token_key").on(table.token),
]);

export const tenants = pgTable("tenants", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	slug: varchar({ length: 255 }).notNull(),
	status: tenantStatus().default('active').notNull(),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_tenants_deleted_at").using("btree", table.deletedAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_tenants_slug").using("btree", table.slug.asc().nullsLast().op("text_ops")),
	index("idx_tenants_status").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	unique("tenants_slug_key").on(table.slug),
]);

export const locations = pgTable("locations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	name: varchar({ length: 255 }).notNull(),
	code: varchar({ length: 50 }),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_locations_code").using("btree", table.code.asc().nullsLast().op("text_ops")),
	index("idx_locations_tenant_id").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "locations_tenant_id_fkey"
		}).onDelete("cascade"),
]);

export const companyTags = pgTable("company_tags", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	tagId: uuid("tag_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_company_tags_company_id").using("btree", table.companyId.asc().nullsLast().op("uuid_ops")),
	index("idx_company_tags_tag_id").using("btree", table.tagId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "company_tags_company_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tagId],
			foreignColumns: [tags.id],
			name: "company_tags_tag_id_fkey"
		}).onDelete("cascade"),
	unique("company_tags_company_id_tag_id_key").on(table.companyId, table.tagId),
]);

export const tags = pgTable("tags", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	color: varchar({ length: 50 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_tags_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
]);

export const products = pgTable("products", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	sku: varchar({ length: 100 }),
	description: text(),
	unitPrice: text("unit_price").default('0').notNull(),
	costPrice: text("cost_price"),
	currency: varchar({ length: 3 }).default('EUR').notNull(),
	unit: varchar({ length: 50 }).default('pcs').notNull(),
	taxRate: text("tax_rate").default('0').notNull(),
	categoryId: uuid("category_id"),
	stockQuantity: text("stock_quantity"),
	minStockLevel: text("min_stock_level"),
	isActive: boolean("is_active").default(true).notNull(),
	isService: boolean("is_service").default(false).notNull(),
	metadata: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	usageCount: integer("usage_count").default(0).notNull(),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_products_category_id").using("btree", table.categoryId.asc().nullsLast().op("uuid_ops")),
	index("idx_products_is_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("idx_products_last_used_at").using("btree", table.lastUsedAt.desc().nullsLast().op("timestamptz_ops")),
	index("idx_products_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
	index("idx_products_sku").using("btree", table.sku.asc().nullsLast().op("text_ops")),
	index("idx_products_usage_count").using("btree", table.usageCount.desc().nullsFirst().op("int4_ops")),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [productCategories.id],
			name: "products_category_id_product_categories_id_fk"
		}).onDelete("set null"),
	unique("products_sku_unique").on(table.sku),
]);

export const productCategories = pgTable("product_categories", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	parentId: uuid("parent_id"),
	sortOrder: integer("sort_order").default(0).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_product_categories_is_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("idx_product_categories_parent_id").using("btree", table.parentId.asc().nullsLast().op("uuid_ops")),
]);

export const notifications = pgTable("notifications", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	type: notificationType().default('info').notNull(),
	channel: notificationChannel().default('in_app').notNull(),
	title: varchar({ length: 255 }).notNull(),
	message: text().notNull(),
	link: varchar({ length: 500 }),
	entityType: varchar("entity_type", { length: 50 }),
	entityId: uuid("entity_id"),
	isRead: boolean("is_read").default(false).notNull(),
	readAt: timestamp("read_at", { withTimezone: true, mode: 'string' }),
	emailSent: boolean("email_sent").default(false).notNull(),
	emailSentAt: timestamp("email_sent_at", { withTimezone: true, mode: 'string' }),
	metadata: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_notifications_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_notifications_entity").using("btree", table.entityType.asc().nullsLast().op("uuid_ops"), table.entityId.asc().nullsLast().op("text_ops")),
	index("idx_notifications_is_read").using("btree", table.isRead.asc().nullsLast().op("bool_ops")),
	index("idx_notifications_type").using("btree", table.type.asc().nullsLast().op("enum_ops")),
	index("idx_notifications_type_created").using("btree", table.type.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_notifications_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	index("idx_notifications_user_read_created").using("btree", table.userId.asc().nullsLast().op("timestamptz_ops"), table.isRead.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "notifications_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const migrations = pgTable("_migrations", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	executedAt: timestamp("executed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("_migrations_name_key").on(table.name),
]);

export const usersOnCompany = pgTable("users_on_company", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	companyId: uuid("company_id").notNull(),
	role: companyRole().default('member').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_users_on_company_company_id").using("btree", table.companyId.asc().nullsLast().op("uuid_ops")),
	index("idx_users_on_company_company_role").using("btree", table.companyId.asc().nullsLast().op("uuid_ops"), table.role.asc().nullsLast().op("enum_ops")),
	index("idx_users_on_company_role").using("btree", table.role.asc().nullsLast().op("enum_ops")),
	index("idx_users_on_company_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "users_on_company_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "users_on_company_company_id_fkey"
		}).onDelete("cascade"),
	unique("users_on_company_user_id_company_id_key").on(table.userId, table.companyId),
]);

export const userTenantRoles = pgTable("user_tenant_roles", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	tenantId: uuid("tenant_id").notNull(),
	role: tenantRole().default('user').notNull(),
	permissions: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_user_tenant_roles_tenant_id").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	index("idx_user_tenant_roles_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	index("idx_user_tenant_roles_user_tenant").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.tenantId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_tenant_roles_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "user_tenant_roles_tenant_id_fkey"
		}).onDelete("cascade"),
]);

export const documentTags = pgTable("document_tags", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	slug: varchar({ length: 255 }).notNull(),
	companyId: uuid("company_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_document_tags_company_id").using("btree", table.companyId.asc().nullsLast().op("uuid_ops")),
	index("idx_document_tags_slug").using("btree", table.slug.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "document_tags_company_id_fkey"
		}).onDelete("cascade"),
	unique("document_tags_slug_company_id_key").on(table.slug, table.companyId),
]);

export const milestones = pgTable("milestones", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	projectId: uuid("project_id").notNull(),
	status: varchar({ length: 50 }).default('pending').notNull(),
	dueDate: timestamp("due_date", { withTimezone: true, mode: 'string' }).notNull(),
	completedDate: timestamp("completed_date", { withTimezone: true, mode: 'string' }),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_milestones_due_date").using("btree", table.dueDate.asc().nullsLast().op("timestamptz_ops")),
	index("idx_milestones_project_id").using("btree", table.projectId.asc().nullsLast().op("uuid_ops")),
	index("idx_milestones_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "milestones_project_id_projects_id_fk"
		}).onDelete("cascade"),
]);

export const contacts = pgTable("contacts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	firstName: varchar("first_name", { length: 100 }).notNull(),
	lastName: varchar("last_name", { length: 100 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	phone: varchar({ length: 50 }),
	company: varchar({ length: 255 }),
	position: varchar({ length: 255 }),
	street: varchar({ length: 255 }),
	city: varchar({ length: 100 }),
	state: varchar({ length: 100 }),
	postalCode: varchar("postal_code", { length: 20 }),
	country: varchar({ length: 100 }),
	notes: text(),
	leadId: uuid("lead_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	tenantId: uuid("tenant_id"),
	companyId: uuid("company_id"),
}, (table) => [
	index("idx_contacts_company_name").using("btree", table.company.asc().nullsLast().op("text_ops"), table.lastName.asc().nullsLast().op("text_ops"), table.firstName.asc().nullsLast().op("text_ops")),
	index("idx_contacts_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("idx_contacts_email_lower").using("btree", sql`lower((email)::text)`),
	index("idx_contacts_lead_id").using("btree", table.leadId.asc().nullsLast().op("uuid_ops")),
	index("idx_contacts_tenant_company").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.companyId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [leads.id],
			name: "contacts_lead_id_leads_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "contacts_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "contacts_company_id_fkey"
		}).onDelete("cascade"),
]);

export const payments = pgTable("payments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	invoiceId: uuid("invoice_id").notNull(),
	amount: text().notNull(),
	currency: varchar({ length: 3 }).default('EUR').notNull(),
	paymentMethod: paymentMethod("payment_method").default('bank_transfer').notNull(),
	status: paymentStatus().default('completed').notNull(),
	paymentDate: timestamp("payment_date", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	reference: varchar({ length: 255 }),
	transactionId: varchar("transaction_id", { length: 255 }),
	notes: text(),
	metadata: text(),
	recordedBy: uuid("recorded_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_payments_date_status").using("btree", table.paymentDate.desc().nullsFirst().op("enum_ops"), table.status.asc().nullsLast().op("enum_ops")),
	index("idx_payments_invoice_id").using("btree", table.invoiceId.asc().nullsLast().op("uuid_ops")),
	index("idx_payments_invoice_status").using("btree", table.invoiceId.asc().nullsLast().op("enum_ops"), table.status.asc().nullsLast().op("uuid_ops")),
	index("idx_payments_payment_date").using("btree", table.paymentDate.asc().nullsLast().op("timestamptz_ops")),
	index("idx_payments_recorded_by").using("btree", table.recordedBy.asc().nullsLast().op("uuid_ops")),
	index("idx_payments_reference").using("btree", table.reference.asc().nullsLast().op("text_ops")),
	index("idx_payments_status").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoices.id],
			name: "payments_invoice_id_invoices_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.recordedBy],
			foreignColumns: [users.id],
			name: "payments_recorded_by_users_id_fk"
		}),
]);

export const deliveryNoteItems = pgTable("delivery_note_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	deliveryNoteId: uuid("delivery_note_id").notNull(),
	productName: varchar("product_name", { length: 255 }).notNull(),
	description: text(),
	quantity: text().default('1').notNull(),
	unit: varchar({ length: 50 }).default('pcs').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	unitPrice: numeric("unit_price", { precision: 10, scale:  2 }).default('0').notNull(),
	discount: numeric({ precision: 5, scale:  2 }).default('0').notNull(),
}, (table) => [
	index("idx_delivery_note_items_delivery_note_id").using("btree", table.deliveryNoteId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.deliveryNoteId],
			foreignColumns: [deliveryNotes.id],
			name: "delivery_note_items_delivery_note_id_delivery_notes_id_fk"
		}).onDelete("cascade"),
]);

export const documentTagAssignments = pgTable("document_tag_assignments", {
	documentId: uuid("document_id").notNull(),
	tagId: uuid("tag_id").notNull(),
	companyId: uuid("company_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_document_tag_assignments_company_id").using("btree", table.companyId.asc().nullsLast().op("uuid_ops")),
	index("idx_document_tag_assignments_tag_id").using("btree", table.tagId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "document_tag_assignments_document_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tagId],
			foreignColumns: [documentTags.id],
			name: "document_tag_assignments_tag_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "document_tag_assignments_company_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.documentId, table.tagId], name: "document_tag_assignments_pkey"}),
]);
