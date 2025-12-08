import { logger } from "../lib/logger";

// One-off maintenance script: delete all tenant companies except specified names
// Usage: bun run scripts/delete-non-techcorp.ts
// Config:
//  - KEEP_NAMES: comma-separated company names to keep (default: "TechCorp")
//  - DRY_RUN: if set to "true", only logs what would be deleted

const BASE = process.env.BASE_URL || "http://localhost:3001";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@crm.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme123";
const KEEP_NAMES = (process.env.KEEP_NAMES || "TechCorp")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const DRY_RUN = String(process.env.DRY_RUN || "false").toLowerCase() === "true";

async function main() {
  // Login and capture cookie
  const loginRes = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status} ${loginRes.statusText}`);
  }

  const setCookie = loginRes.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error("Missing Set-Cookie header after login");
  }

  const cookieHeader = setCookie
    .split(",")
    .map((c) => c.split(";", 1)[0])
    .join("; ");

  // List tenant companies
  const listRes = await fetch(`${BASE}/api/tenant-admin/companies`, {
    headers: { Cookie: cookieHeader },
  });
  if (!listRes.ok) {
    throw new Error(`List companies failed: ${listRes.status} ${listRes.statusText}`);
  }
  const listJson = (await listRes.json()) as {
    success: boolean;
    data: Array<{ id: string; name: string }>;
  };
  if (!listJson.success) throw new Error("List companies returned success=false");

  const companies = listJson.data;
  const keepSet = new Set(KEEP_NAMES.map((n) => n.toLowerCase()));
  const toDelete = companies.filter((c) => !keepSet.has((c.name || "").toLowerCase()));
  logger.info(
    `Found ${companies.length} companies. Keeping [${KEEP_NAMES.join(", ")}] and deleting ${toDelete.length}.`
  );
  if (DRY_RUN) {
    logger.info("DRY_RUN=true -> will NOT delete. Candidates:");
    toDelete.forEach((c) => logger.info(`- ${c.name} (${c.id})`));
    return;
  }

  for (const c of toDelete) {
    const delRes = await fetch(`${BASE}/api/tenant-admin/companies/${c.id}`, {
      method: "DELETE",
      headers: { Cookie: cookieHeader },
    });
    if (!delRes.ok) {
      const body = await delRes.text();
      logger.error(
        `Failed to delete ${c.name} (${c.id}): ${delRes.status} ${delRes.statusText} ${body}`
      );
    } else {
      logger.info(`Deleted ${c.name} (${c.id})`);
    }
  }

  // Verify remaining
  const verifyRes = await fetch(`${BASE}/api/tenant-admin/companies`, {
    headers: { Cookie: cookieHeader },
  });
  const verifyJson = (await verifyRes.json()) as {
    success: boolean;
    data: Array<{ name: string }>;
  };
  const remainingNames = verifyJson.data.map((c) => c.name);
  logger.info("Remaining tenant companies:");
  remainingNames.forEach((n) => logger.info(`- ${n}`));
}

main().catch((err) => {
  logger.error(err);
  process.exit(1);
});
