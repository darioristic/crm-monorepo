import { logger } from "../lib/logger";
import { sql as db } from "./client";

async function checkAdminUsers() {
  const admins = await db`
    SELECT id, email, first_name, last_name, company_id 
    FROM users 
    WHERE role = 'admin' 
    ORDER BY created_at ASC
  `;

  logger.info("\n🔍 Admin korisnici u bazi:\n");
  for (const admin of admins) {
    logger.info(`  - ${admin.email} (${admin.first_name} ${admin.last_name})`);
    logger.info(`    ID: ${admin.id}`);
    logger.info(`    Company ID: ${admin.company_id || "null"}`);

    // Check companies they have access to
    const companies = await db`
      SELECT c.id, c.name, c.source, uoc.role
      FROM users_on_company uoc
      INNER JOIN companies c ON uoc.company_id = c.id
      WHERE uoc.user_id = ${admin.id}
      ORDER BY c.name ASC
    `;

    logger.info(`    Kompanije (${companies.length}):`);
    companies.forEach((c) => {
      const company = c as { name: string; source?: string | null; role: string };
      logger.info(`      - ${company.name} (${company.source || "legacy"}) - ${company.role}`);
    });
    logger.info("");
  }

  await db.end();
}

if (import.meta.main) {
  checkAdminUsers()
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error("Error:", error);
      process.exit(1);
    });
}
