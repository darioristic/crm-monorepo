import {
	pgTable,
	uuid,
	varchar,
	text,
	timestamp,
	integer,
	boolean,
	index,
} from "drizzle-orm/pg-core";

// Product Categories table
export const productCategories = pgTable(
	"product_categories",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: varchar("name", { length: 255 }).notNull(),
		description: text("description"),
		parentId: uuid("parent_id"),
		sortOrder: integer("sort_order").notNull().default(0),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_product_categories_parent_id").on(table.parentId),
		index("idx_product_categories_is_active").on(table.isActive),
	],
);

// Products table
export const products = pgTable(
	"products",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: varchar("name", { length: 255 }).notNull(),
		sku: varchar("sku", { length: 100 }).unique(),
		description: text("description"),
		unitPrice: text("unit_price").notNull().default("0"),
		costPrice: text("cost_price"),
		currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
		unit: varchar("unit", { length: 50 }).notNull().default("pcs"),
		taxRate: text("tax_rate").notNull().default("0"),
		categoryId: uuid("category_id").references(() => productCategories.id, {
			onDelete: "set null",
		}),
		stockQuantity: text("stock_quantity"),
		minStockLevel: text("min_stock_level"),
		isActive: boolean("is_active").notNull().default(true),
		isService: boolean("is_service").notNull().default(false),
		metadata: text("metadata"), // JSON stored as text
		// Smart product tracking fields (like midday-main)
		usageCount: integer("usage_count").notNull().default(0),
		lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_products_sku").on(table.sku),
		index("idx_products_category_id").on(table.categoryId),
		index("idx_products_is_active").on(table.isActive),
		index("idx_products_name").on(table.name),
		index("idx_products_usage_count").on(table.usageCount),
		index("idx_products_last_used_at").on(table.lastUsedAt),
	],
);

export type ProductCategory = typeof productCategories.$inferSelect;
export type NewProductCategory = typeof productCategories.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
