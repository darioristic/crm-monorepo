import { logger } from "../../lib/logger";
import { sql as db } from "../client";

export const name = "023_add_customer_details_orders";

export async function up() {
  await db`
    ALTER TABLE orders 
    ADD COLUMN IF NOT EXISTS customer_details TEXT
  `;
  logger.info("✅ Migration 023: Added customer_details to orders");
}

export async function down() {
  await db`ALTER TABLE orders DROP COLUMN IF EXISTS customer_details`;
  logger.info("✅ Migration 023: Removed customer_details from orders");
}
