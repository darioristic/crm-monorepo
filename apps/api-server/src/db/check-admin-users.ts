import { sql as db } from "./client";

async function checkAdminUsers() {
  const admins = await db`
    SELECT id, email, first_name, last_name, company_id 
    FROM users 
    WHERE role = 'admin' 
    ORDER BY created_at ASC
  `;
  
  console.log("\n🔍 Admin korisnici u bazi:\n");
  for (const admin of admins) {
    console.log(`  - ${admin.email} (${admin.first_name} ${admin.last_name})`);
    console.log(`    ID: ${admin.id}`);
    console.log(`    Company ID: ${admin.company_id || 'null'}`);
    
    // Check companies they have access to
    const companies = await db`
      SELECT c.id, c.name, c.source, uoc.role
      FROM users_on_company uoc
      INNER JOIN companies c ON uoc.company_id = c.id
      WHERE uoc.user_id = ${admin.id}
      ORDER BY c.name ASC
    `;
    
    console.log(`    Kompanije (${companies.length}):`);
    companies.forEach((c: any) => {
      console.log(`      - ${c.name} (${c.source || 'legacy'}) - ${c.role}`);
    });
    console.log("");
  }
  
  await db.end();
}

if (import.meta.main) {
  checkAdminUsers()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Error:", error);
      process.exit(1);
    });
}

