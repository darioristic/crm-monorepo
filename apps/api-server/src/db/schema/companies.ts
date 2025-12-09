import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { locations } from "./locations";
import { tenants } from "./tenants";

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").references(() => locations.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 255 }).notNull(),
    industry: varchar("industry", { length: 255 }).notNull(),
    address: text("address").notNull(),
    // Contact information
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    website: varchar("website", { length: 255 }),
    contact: varchar("contact", { length: 255 }),
    // Address details
    city: varchar("city", { length: 100 }),
    zip: varchar("zip", { length: 20 }),
    country: varchar("country", { length: 100 }),
    countryCode: varchar("country_code", { length: 10 }),
    // Business identifiers
    vatNumber: varchar("vat_number", { length: 50 }),
    companyNumber: varchar("company_number", { length: 50 }),
    // Branding
    logoUrl: text("logo_url"),
    // Source (account/customer) for operational splits
    source: varchar("source", { length: 50 }),
    // Company type (seller/customer) for business role classification
    companyType: varchar("company_type", { length: 50 }),
    // Additional
    note: text("note"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_companies_tenant_id").on(table.tenantId),
    index("idx_companies_company_id_tenant_id").on(table.id, table.tenantId),
    index("idx_companies_name").on(table.name),
    index("idx_companies_industry").on(table.industry),
    index("idx_companies_country").on(table.country),
  ]
);

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;

// Physical separation tables for tenant vs customer companies (1:1 with companies.id)
export const tenantCompanies = pgTable(
  "tenant_companies",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => companies.id, {
        onDelete: "cascade",
      }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_tenant_companies_id").on(table.id)]
);

export const customerCompanies = pgTable(
  "customer_companies",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => companies.id, {
        onDelete: "cascade",
      }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_customer_companies_id").on(table.id)]
);

export type TenantCompanyRef = typeof tenantCompanies.$inferSelect;
export type CustomerCompanyRef = typeof customerCompanies.$inferSelect;

// Fully separated tenant accounts table (independent of companies)
export const tenantAccounts = pgTable(
  "tenant_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").references(() => locations.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 255 }).notNull(),
    industry: varchar("industry", { length: 255 }).notNull(),
    address: text("address").notNull(),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    website: varchar("website", { length: 255 }),
    contact: varchar("contact", { length: 255 }),
    city: varchar("city", { length: 100 }),
    zip: varchar("zip", { length: 20 }),
    country: varchar("country", { length: 100 }),
    countryCode: varchar("country_code", { length: 10 }),
    vatNumber: varchar("vat_number", { length: 50 }),
    companyNumber: varchar("company_number", { length: 50 }),
    logoUrl: text("logo_url"),
    note: text("note"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_tenant_accounts_tenant_id").on(table.tenantId),
    index("idx_tenant_accounts_name").on(table.name),
    index("idx_tenant_accounts_industry").on(table.industry),
  ]
);

export type TenantAccount = typeof tenantAccounts.$inferSelect;
export type NewTenantAccount = typeof tenantAccounts.$inferInsert;
