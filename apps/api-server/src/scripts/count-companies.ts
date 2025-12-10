/**
 * Script to count total companies in the database
 */

import { sql as db } from "../db/client";
import { companyQueries } from "../db/queries/companies";
import { logger } from "../lib/logger";

async function countCompanies() {
  try {
    logger.info("🔍 Counting companies in database...");

    // Get total count
    const totalCount = await companyQueries.count();

    // Also get breakdown by source if available
    const sourceBreakdown = await db`
			SELECT 
				source,
				COUNT(*) as count
			FROM companies
			GROUP BY source
			ORDER BY count DESC
		`;

    logger.info("\n📊 Company Statistics:");
    logger.info("=".repeat(50));
    logger.info(`Total Companies: ${totalCount}`);
    logger.info("\nBreakdown by source:");

    if (sourceBreakdown.length === 0) {
      logger.info("  - No source data available");
    } else {
      for (const row of sourceBreakdown) {
        const source = row.source || "null/legacy";
        const count = row.count;
        logger.info(`  - ${source}: ${count}`);
      }
    }

    // Get count of companies with users
    const companiesWithUsers = await db`
			SELECT COUNT(DISTINCT company_id) as count
			FROM users
			WHERE company_id IS NOT NULL
		`;

    const companiesWithMembers = await db`
			SELECT COUNT(DISTINCT company_id) as count
			FROM users_on_company
		`;

    logger.info("\n📈 Additional Statistics:");
    logger.info(`Companies with active users: ${companiesWithUsers[0]?.count || 0}`);
    logger.info(`Companies with members: ${companiesWithMembers[0]?.count || 0}`);

    process.exit(0);
  } catch (error) {
    logger.error({ error }, "❌ Error counting companies");
    process.exit(1);
  }
}

// Run the script
countCompanies();
