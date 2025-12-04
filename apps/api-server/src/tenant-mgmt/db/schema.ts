import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  index,
  jsonb,
} from "drizzle-orm/pg-core";

export const tmTenantStatusEnum = pgEnum("tm_tenant_status", [
  "active",
  "inactive",
  "deleted",
]);

export const tmRoleEnum = pgEnum("tm_role", ["admin", "manager", "viewer"]);

export const tmTenants = pgTable(
  "tm_tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    pib: varchar("pib", { length: 50 }),
    street: varchar("street", { length: 255 }),
    city: varchar("city", { length: 100 }),
    postalCode: varchar("postal_code", { length: 20 }),
    country: varchar("country", { length: 100 }),
    contactEmail: varchar("contact_email", { length: 255 }),
    contactPhone: varchar("contact_phone", { length: 50 }),
    uniqueCode: varchar("unique_code", { length: 64 }).unique(),
    status: tmTenantStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_tm_tenants_status").on(table.status),
    index("idx_tm_tenants_unique_code").on(table.uniqueCode),
  ],
);

export const tmTenantSettings = pgTable(
  "tm_tenant_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tmTenants.id, {
      onDelete: "cascade",
    }),
    config: jsonb("config").$type<Record<string, unknown>>(),
    permissions: jsonb("permissions").$type<Record<string, unknown>>(),
    personalization: jsonb("personalization").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_tm_settings_tenant_id").on(table.tenantId)],
);

export const tmApiKeys = pgTable(
  "tm_api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    keyHash: varchar("key_hash", { length: 128 }).notNull().unique(),
    role: tmRoleEnum("role").notNull().default("admin"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [index("idx_tm_api_keys_role").on(table.role)],
);

export type TmTenant = typeof tmTenants.$inferSelect;
export type NewTmTenant = typeof tmTenants.$inferInsert;
export type TmTenantSettings = typeof tmTenantSettings.$inferSelect;
export type NewTmTenantSettings = typeof tmTenantSettings.$inferInsert;
export type TmApiKey = typeof tmApiKeys.$inferSelect;
export type NewTmApiKey = typeof tmApiKeys.$inferInsert;

