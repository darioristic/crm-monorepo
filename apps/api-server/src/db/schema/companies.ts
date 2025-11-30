import { pgTable, uuid, varchar, text, timestamp, index } from "drizzle-orm/pg-core";

export const companies = pgTable(
	"companies",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: varchar("name", { length: 255 }).notNull(),
		industry: varchar("industry", { length: 255 }).notNull(),
		address: text("address").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("idx_companies_name").on(table.name),
		index("idx_companies_industry").on(table.industry),
	]
);

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;

