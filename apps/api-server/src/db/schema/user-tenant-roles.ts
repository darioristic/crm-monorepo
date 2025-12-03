import {
	pgTable,
	uuid,
	varchar,
	timestamp,
	index,
	pgEnum,
	jsonb,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { tenants } from "./tenants";

export const tenantRoleEnum = pgEnum("tenant_role", ["admin", "manager", "user"]);

export const userTenantRoles = pgTable(
	"user_tenant_roles",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		tenantId: uuid("tenant_id")
			.notNull()
			.references(() => tenants.id, { onDelete: "cascade" }),
		role: tenantRoleEnum("role").notNull().default("user"),
		permissions: jsonb("permissions").$type<Record<string, unknown>>(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_user_tenant_roles_user_id").on(table.userId),
		index("idx_user_tenant_roles_tenant_id").on(table.tenantId),
		index("idx_user_tenant_roles_user_tenant").on(table.userId, table.tenantId),
	],
);

export type UserTenantRole = typeof userTenantRoles.$inferSelect;
export type NewUserTenantRole = typeof userTenantRoles.$inferInsert;

