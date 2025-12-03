import {
	pgTable,
	uuid,
	varchar,
	text,
	timestamp,
	index,
	jsonb,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const locations = pgTable(
	"locations",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		tenantId: uuid("tenant_id")
			.notNull()
			.references(() => tenants.id, { onDelete: "cascade" }),
		name: varchar("name", { length: 255 }).notNull(),
		code: varchar("code", { length: 50 }),
		metadata: jsonb("metadata").$type<Record<string, unknown>>(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_locations_tenant_id").on(table.tenantId),
		index("idx_locations_code").on(table.code),
	],
);

export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;

