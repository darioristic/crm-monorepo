import { sql as db } from "../client";

export const name = "018_create_orders_table";

export async function up(): Promise<void> {
	console.log(`Running migration: ${name}`);
	console.log("Creating orders table and order_items table...");

	// Create enum type for order status if it doesn't exist
	await db`
		DO $$ BEGIN
			CREATE TYPE order_status AS ENUM ('pending', 'processing', 'completed', 'cancelled', 'refunded');
		EXCEPTION
			WHEN duplicate_object THEN null;
		END $$
	`;

	// Create orders table
	await db`
		CREATE TABLE IF NOT EXISTS orders (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			order_number VARCHAR(50) UNIQUE NOT NULL,
			company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
			contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
			quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
			invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
			status order_status NOT NULL DEFAULT 'pending',
			subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
			tax DECIMAL(15, 2) NOT NULL DEFAULT 0,
			total DECIMAL(15, 2) NOT NULL DEFAULT 0,
			currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
			notes TEXT,
			created_by UUID NOT NULL REFERENCES users(id),
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`;

	// Create order_items table
	await db`
		CREATE TABLE IF NOT EXISTS order_items (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
			product_name VARCHAR(255) NOT NULL,
			description TEXT,
			quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
			unit_price DECIMAL(15, 2) NOT NULL,
			discount DECIMAL(5, 2) NOT NULL DEFAULT 0,
			total DECIMAL(15, 2) NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`;

	// Create indexes for orders
	await db`CREATE INDEX IF NOT EXISTS idx_orders_company_id ON orders(company_id)`;
	await db`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`;
	await db`CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number)`;
	await db`CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC)`;
	await db`CREATE INDEX IF NOT EXISTS idx_orders_quote_id ON orders(quote_id)`;
	await db`CREATE INDEX IF NOT EXISTS idx_orders_invoice_id ON orders(invoice_id)`;
	await db`CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders(created_by)`;

	// Create indexes for order_items
	await db`CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)`;

	console.log("✅ Orders and order_items tables created successfully");
}

export async function down(): Promise<void> {
	console.log("Dropping orders and order_items tables...");

	await db`DROP TABLE IF EXISTS order_items CASCADE`;
	await db`DROP TABLE IF EXISTS orders CASCADE`;
	await db`DROP TYPE IF EXISTS order_status CASCADE`;

	console.log("✅ Orders and order_items tables dropped");
}

