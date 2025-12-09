import { index, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

/**
 * Tracks the currently active tenant for each user
 * Used for multi-tenant users to remember which tenant they're currently working in
 */
export const userActiveTenant = pgTable(
  "user_active_tenant",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    activeTenantId: uuid("active_tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_user_active_tenant_tenant_id").on(table.activeTenantId)]
);

export type UserActiveTenant = typeof userActiveTenant.$inferSelect;
export type NewUserActiveTenant = typeof userActiveTenant.$inferInsert;
