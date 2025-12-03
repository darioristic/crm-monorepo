/**
 * Detailed analysis of company-user relationships
 * Identifies inconsistencies between users.company_id and users_on_company
 */

import { sql as db } from "../db/client";

async function analyzeCompanies() {
	try {
		console.log("🔍 Detailed Company-User Relationship Analysis");
		console.log("=" .repeat(70));
		
		// 1. Total companies
		const totalCompanies = await db`SELECT COUNT(*) as count FROM companies`;
		console.log(`\n📊 Total Companies: ${totalCompanies[0]?.count || 0}`);
		
		// 2. Companies by source
		const companiesBySource = await db`
			SELECT 
				COALESCE(source, 'null/legacy') as source,
				COUNT(*) as count
			FROM companies
			GROUP BY source
			ORDER BY count DESC
		`;
		console.log("\n📋 Companies by Source:");
		for (const row of companiesBySource) {
			console.log(`  - ${row.source}: ${row.count}`);
		}
		
		// 3. Users with company_id set
		const usersWithCompanyId = await db`
			SELECT 
				COUNT(*) as total_users,
				COUNT(DISTINCT company_id) as unique_companies
			FROM users
			WHERE company_id IS NOT NULL
		`;
		console.log("\n👥 Users with company_id set:");
		console.log(`  - Total users: ${usersWithCompanyId[0]?.total_users || 0}`);
		console.log(`  - Unique companies: ${usersWithCompanyId[0]?.unique_companies || 0}`);
		
		// 4. Users in users_on_company table
		const usersInJoinTable = await db`
			SELECT 
				COUNT(DISTINCT user_id) as total_users,
				COUNT(DISTINCT company_id) as unique_companies,
				COUNT(*) as total_memberships
			FROM users_on_company
		`;
		console.log("\n🔗 Users in users_on_company table:");
		console.log(`  - Total users: ${usersInJoinTable[0]?.total_users || 0}`);
		console.log(`  - Unique companies: ${usersInJoinTable[0]?.unique_companies || 0}`);
		console.log(`  - Total memberships: ${usersInJoinTable[0]?.total_memberships || 0}`);
		
		// 5. Companies with users (via company_id)
		const companiesWithUsers = await db`
			SELECT 
				c.id,
				c.name,
				COUNT(DISTINCT u.id) as user_count
			FROM companies c
			LEFT JOIN users u ON u.company_id = c.id
			GROUP BY c.id, c.name
			HAVING COUNT(DISTINCT u.id) > 0
			ORDER BY user_count DESC
		`;
		console.log(`\n🏢 Companies with users (via users.company_id): ${companiesWithUsers.length}`);
		
		// 6. Companies with members (via users_on_company)
		const companiesWithMembers = await db`
			SELECT 
				c.id,
				c.name,
				COUNT(DISTINCT uoc.user_id) as member_count
			FROM companies c
			LEFT JOIN users_on_company uoc ON uoc.company_id = c.id
			GROUP BY c.id, c.name
			HAVING COUNT(DISTINCT uoc.user_id) > 0
			ORDER BY member_count DESC
		`;
		console.log(`\n👥 Companies with members (via users_on_company): ${companiesWithMembers.length}`);
		
		// 7. Find inconsistencies - users with company_id but not in users_on_company
		const inconsistentUsers = await db`
			SELECT 
				u.id,
				u.email,
				u.first_name,
				u.last_name,
				u.company_id,
				c.name as company_name
			FROM users u
			INNER JOIN companies c ON u.company_id = c.id
			LEFT JOIN users_on_company uoc ON uoc.user_id = u.id AND uoc.company_id = u.company_id
			WHERE u.company_id IS NOT NULL
				AND uoc.user_id IS NULL
			ORDER BY c.name, u.email
			LIMIT 20
		`;
		
		console.log(`\n⚠️  INCONSISTENCY DETECTED:`);
		console.log(`Users with company_id but NOT in users_on_company: ${inconsistentUsers.length}`);
		if (inconsistentUsers.length > 0) {
			console.log("\nFirst 20 examples:");
			for (const user of inconsistentUsers) {
				console.log(`  - ${user.email} (${user.first_name} ${user.last_name}) -> ${user.company_name}`);
			}
		}
		
		// 8. Users in users_on_company but company_id doesn't match
		const mismatchedCompanyId = await db`
			SELECT 
				u.id,
				u.email,
				u.company_id as user_company_id,
				uoc.company_id as join_company_id,
				c1.name as user_company_name,
				c2.name as join_company_name
			FROM users u
			INNER JOIN users_on_company uoc ON uoc.user_id = u.id
			LEFT JOIN companies c1 ON c1.id = u.company_id
			LEFT JOIN companies c2 ON c2.id = uoc.company_id
			WHERE u.company_id IS NOT NULL
				AND u.company_id != uoc.company_id
			LIMIT 20
		`;
		
		console.log(`\n⚠️  MISMATCH DETECTED:`);
		console.log(`Users where company_id != users_on_company.company_id: ${mismatchedCompanyId.length}`);
		if (mismatchedCompanyId.length > 0) {
			console.log("\nFirst 20 examples:");
			for (const user of mismatchedCompanyId) {
				console.log(`  - ${user.email}:`);
				console.log(`    users.company_id: ${user.user_company_id} (${user.user_company_name})`);
				console.log(`    users_on_company.company_id: ${user.join_company_id} (${user.join_company_name})`);
			}
		}
		
		// 9. Companies breakdown - which have both
		const companiesBreakdown = await db`
			SELECT 
				c.id,
				c.name,
				COUNT(DISTINCT u.id) as users_via_company_id,
				COUNT(DISTINCT uoc.user_id) as members_via_join_table,
				CASE 
					WHEN COUNT(DISTINCT u.id) > 0 AND COUNT(DISTINCT uoc.user_id) = 0 THEN 'only_company_id'
					WHEN COUNT(DISTINCT u.id) = 0 AND COUNT(DISTINCT uoc.user_id) > 0 THEN 'only_join_table'
					WHEN COUNT(DISTINCT u.id) > 0 AND COUNT(DISTINCT uoc.user_id) > 0 THEN 'both'
					ELSE 'none'
				END as status
			FROM companies c
			LEFT JOIN users u ON u.company_id = c.id
			LEFT JOIN users_on_company uoc ON uoc.company_id = c.id
			GROUP BY c.id, c.name
			HAVING COUNT(DISTINCT u.id) > 0 OR COUNT(DISTINCT uoc.user_id) > 0
			ORDER BY status, c.name
		`;
		
		console.log(`\n📊 Companies Breakdown:`);
		const statusCounts: Record<string, number> = {};
		for (const company of companiesBreakdown) {
			statusCounts[company.status as string] = (statusCounts[company.status as string] || 0) + 1;
		}
		console.log(`  - Only in users.company_id: ${statusCounts['only_company_id'] || 0}`);
		console.log(`  - Only in users_on_company: ${statusCounts['only_join_table'] || 0}`);
		console.log(`  - In both: ${statusCounts['both'] || 0}`);
		
		// 10. Summary and recommendations
		console.log("\n" + "=" .repeat(70));
		console.log("📝 SUMMARY & RECOMMENDATIONS:");
		console.log("=" .repeat(70));
		
		const totalInconsistent = inconsistentUsers.length;
		const totalMismatched = mismatchedCompanyId.length;
		
		if (totalInconsistent > 0 || totalMismatched > 0) {
			console.log("\n⚠️  ISSUES FOUND:");
			if (totalInconsistent > 0) {
				console.log(`  - ${totalInconsistent} users have company_id but are NOT in users_on_company`);
				console.log("    → These users cannot properly switch between companies");
				console.log("    → They will only see their current company");
			}
			if (totalMismatched > 0) {
				console.log(`  - ${totalMismatched} users have mismatched company_id values`);
				console.log("    → This can cause confusion about which company is active");
			}
			console.log("\n💡 RECOMMENDATION:");
			console.log("  Run a migration script to sync users.company_id with users_on_company");
			console.log("  Ensure all users with company_id are also in users_on_company");
		} else {
			console.log("\n✅ No inconsistencies found! Data is properly synchronized.");
		}
		
		process.exit(0);
	} catch (error) {
		console.error("❌ Error analyzing companies:", error);
		process.exit(1);
	}
}

// Run the analysis
analyzeCompanies();

