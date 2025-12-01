import { pgTable, uuid, varchar, text, timestamp, index } from "drizzle-orm/pg-core";

export const companies = pgTable(
	"companies",
	{
		id: uuid("id").primaryKey().defaultRandom(),
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
		// Additional
		note: text("note"),
		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("idx_companies_name").on(table.name),
		index("idx_companies_industry").on(table.industry),
		index("idx_companies_country").on(table.country),
	]
);

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
