import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { tenants } from "./tenants";

export const userRoleEnum = pgEnum("user_role", ["superadmin", "tenant_admin", "crm_user"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }), // null za superadmin
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    role: userRoleEnum("role").notNull().default("crm_user"),
    status: varchar("status", { length: 50 }).default("active"),
    avatarUrl: text("avatar_url"),
    phone: varchar("phone", { length: 50 }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_users_email").on(table.email),
    index("idx_users_tenant_id").on(table.tenantId),
    index("idx_users_role").on(table.role),
  ]
);

// Leads table
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 50 }),
    company: varchar("company", { length: 255 }),
    position: varchar("position", { length: 255 }),
    status: varchar("status", { length: 50 }).notNull().default("new"),
    source: varchar("source", { length: 50 }).notNull().default("website"),
    assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
    value: text("value"), // Using text for decimal compatibility
    notes: text("notes"),
    tags: text("tags").array(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_leads_status").on(table.status),
    index("idx_leads_assigned_to").on(table.assignedTo),
    index("idx_leads_email").on(table.email),
  ]
);

// Contacts table
export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 50 }),
    company: varchar("company", { length: 255 }),
    position: varchar("position", { length: 255 }),
    street: varchar("street", { length: 255 }),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 100 }),
    postalCode: varchar("postal_code", { length: 20 }),
    country: varchar("country", { length: 100 }),
    notes: text("notes"),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_contacts_tenant_company").on(table.tenantId, table.companyId),
    index("idx_contacts_email").on(table.email),
    index("idx_contacts_lead_id").on(table.leadId),
  ]
);

// Deals table
export const deals = pgTable(
  "deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    value: text("value").notNull(), // Using text for decimal compatibility
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    stage: varchar("stage", { length: 50 }).notNull().default("discovery"),
    priority: varchar("priority", { length: 50 }).notNull().default("medium"),
    probability: varchar("probability", { length: 10 }).notNull().default("20"),
    expectedCloseDate: timestamp("expected_close_date", { withTimezone: true }),
    actualCloseDate: timestamp("actual_close_date", { withTimezone: true }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    assignedTo: uuid("assigned_to")
      .notNull()
      .references(() => users.id),
    tags: text("tags").array(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_deals_stage").on(table.stage),
    index("idx_deals_assigned_to").on(table.assignedTo),
  ]
);

// Activities table
export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 50 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    metadata: text("metadata"), // JSON stored as text
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_activities_tenant_company").on(table.tenantId, table.companyId),
    index("idx_activities_entity").on(table.entityType, table.entityId),
    index("idx_activities_user_id").on(table.userId),
  ]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Deal = typeof deals.$inferSelect;
export type NewDeal = typeof deals.$inferInsert;
export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
