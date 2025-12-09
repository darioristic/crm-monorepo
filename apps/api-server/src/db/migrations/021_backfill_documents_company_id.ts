import { logger } from "../../lib/logger";
import { sql as db } from "../client";

export const name = "021_backfill_documents_company_id";

export async function up(): Promise<void> {
  logger.info(`Running migration: ${name}`);

  // Step 1: Backfill from tag assignments where available
  const _updatedFromTags = await db`
    WITH src AS (
      SELECT d.id as document_id, dta.company_id
      FROM documents d
      JOIN document_tag_assignments dta ON dta.document_id = d.id
      WHERE d.company_id IS NULL
      LIMIT 50000
    )
    UPDATE documents AS d
    SET company_id = src.company_id
    FROM src
    WHERE d.id = src.document_id
  `;
  logger.info(`${name}: Backfilled documents.company_id from tag assignments`);

  // Step 2: Backfill from users table (owner's active company)
  const _updatedFromUsers = await db`
    WITH src AS (
      SELECT d.id as document_id, u.company_id
      FROM documents d
      JOIN users u ON u.id = d.owner_id
      WHERE d.company_id IS NULL AND u.company_id IS NOT NULL
      LIMIT 50000
    )
    UPDATE documents AS d
    SET company_id = src.company_id
    FROM src
    WHERE d.id = src.document_id
  `;
  logger.info(`${name}: Backfilled documents.company_id from users.company_id`);

  // Step 3: Backfill from users_on_company (first membership)
  // Iterate to choose earliest membership deterministically
  const remaining = await db`SELECT id, owner_id FROM documents WHERE company_id IS NULL`;
  for (const row of remaining) {
    const ownerId = row.owner_id as string | null;
    if (!ownerId) continue;
    const membership = await db`
      SELECT company_id FROM users_on_company
      WHERE user_id = ${ownerId}
      ORDER BY created_at ASC
      LIMIT 1
    `;
    if (membership.length > 0 && membership[0].company_id) {
      await db`
        UPDATE documents SET company_id = ${membership[0].company_id}
        WHERE id = ${row.id}
      `;
    }
  }
  logger.info(`${name}: Backfilled documents.company_id from users_on_company where possible`);

  // Optional: ensure index exists
  await db`CREATE INDEX IF NOT EXISTS idx_documents_company_id ON documents(company_id)`;

  logger.info(`✅ Migration ${name} completed`);
}

export async function down(): Promise<void> {
  logger.info(`Rolling back migration: ${name}`);
  // No-op: Backfill is non-destructive; do not unset company_id
  logger.info(`✅ Rollback ${name} completed`);
}
