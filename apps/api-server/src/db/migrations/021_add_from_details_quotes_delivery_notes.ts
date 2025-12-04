import { sql as db } from "../client";

export const name = "021_add_from_details_quotes_delivery_notes";

export async function up() {
  await db`
    ALTER TABLE quotes 
    ADD COLUMN IF NOT EXISTS from_details TEXT
  `;

  await db`
    ALTER TABLE delivery_notes 
    ADD COLUMN IF NOT EXISTS from_details TEXT
  `;

  console.log("✅ Migration 021: Added from_details to quotes and delivery_notes");
}

export async function down() {
  await db`ALTER TABLE quotes DROP COLUMN IF EXISTS from_details`;
  await db`ALTER TABLE delivery_notes DROP COLUMN IF EXISTS from_details`;
  console.log("✅ Migration 021: Removed from_details from quotes and delivery_notes");
}
