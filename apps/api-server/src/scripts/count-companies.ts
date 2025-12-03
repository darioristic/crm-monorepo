/**
 * Script to count total companies in the database
 */

import { sql as db } from "../db/client";
import { companyQueries } from "../db/queries/companies";

async function countCompanies() {
	try {
		console.log("🔍 Counting companies in database...");
		
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
		
		console.log("\n📊 Company Statistics:");
		console.log("=" .repeat(50));
		console.log(`Total Companies: ${totalCount}`);
		console.log("\nBreakdown by source:");
		
		if (sourceBreakdown.length === 0) {
			console.log("  - No source data available");
		} else {
			for (const row of sourceBreakdown) {
				const source = row.source || "null/legacy";
				const count = row.count;
				console.log(`  - ${source}: ${count}`);
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
		
		console.log("\n📈 Additional Statistics:");
		console.log(`Companies with active users: ${companiesWithUsers[0]?.count || 0}`);
		console.log(`Companies with members: ${companiesWithMembers[0]?.count || 0}`);
		
		process.exit(0);
	} catch (error) {
		console.error("❌ Error counting companies:", error);
		process.exit(1);
	}
}

// Run the script
countCompanies();

