import { sql as db } from "../client";

export const name = "022_add_from_details_orders";

export async function up() {
  await db`
    ALTER TABLE orders 
    ADD COLUMN IF NOT EXISTS from_details TEXT
  `;
  console.log("✅ Migration 022: Added from_details to orders");
}

export async function down() {
  await db`ALTER TABLE orders DROP COLUMN IF EXISTS from_details`;
  console.log("✅ Migration 022: Removed from_details from orders");
}
