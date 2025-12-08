import { sql as db } from "../db/client";
import { createCompany } from "../db/queries/companies-members";
import { logger } from "../lib/logger";
import { provisioningService } from "../system/provisioning/provisioning.service";

type TenantSpec = {
  name: string;
  slug: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPassword: string;
  companyName: string;
  industry: string;
  address: string;
};

async function ensureUniqueSlug(slug: string): Promise<string> {
  const existing = await db`SELECT id FROM tenants WHERE slug = ${slug} LIMIT 1`;
  if (existing.length === 0) return slug;
  let i = 1;
  while (true) {
    const candidate = `${slug}-${i}`;
    const check = await db`SELECT id FROM tenants WHERE slug = ${candidate} LIMIT 1`;
    if (check.length === 0) return candidate;
    i++;
  }
}

async function provisionTenantAndCompany(spec: TenantSpec) {
  const uniqueSlug = await ensureUniqueSlug(spec.slug);
  const result = await provisioningService.provision({
    name: spec.name,
    slug: uniqueSlug,
    adminEmail: spec.adminEmail,
    adminPassword: spec.adminPassword,
    adminFirstName: spec.adminFirstName,
    adminLastName: spec.adminLastName,
    metadata: {},
  });

  if (!result.success || !result.data) {
    throw new Error(result.error?.message || "Provisioning failed");
  }

  const adminUserId = result.data.adminUserId;

  const companyId = await createCompany({
    name: spec.companyName,
    industry: spec.industry,
    address: spec.address,
    userId: adminUserId,
    source: "account",
    switchCompany: true,
  });

  return { tenantId: result.data.tenantId, adminUserId, companyId };
}

async function main() {
  const specs: TenantSpec[] = [
    {
      name: "Tenant Alpha",
      slug: "tenant-alpha",
      adminFirstName: "Alpha",
      adminLastName: "Admin",
      adminEmail: "admin@tenant-alpha.local",
      adminPassword: "AlphaAdmin123!",
      companyName: "Alpha Account Company",
      industry: "Technology",
      address: "101 Alpha Way, Tech City",
    },
    {
      name: "Tenant Beta",
      slug: "tenant-beta",
      adminFirstName: "Beta",
      adminLastName: "Admin",
      adminEmail: "admin@tenant-beta.local",
      adminPassword: "BetaAdmin123!",
      companyName: "Beta Account Company",
      industry: "Finance",
      address: "202 Beta Blvd, Money Town",
    },
    {
      name: "Tenant Gamma",
      slug: "tenant-gamma",
      adminFirstName: "Gamma",
      adminLastName: "Admin",
      adminEmail: "admin@tenant-gamma.local",
      adminPassword: "GammaAdmin123!",
      companyName: "Gamma Account Company",
      industry: "Healthcare",
      address: "303 Gamma Ave, Health City",
    },
  ];

  const results = [] as Array<{ tenantId: string; adminUserId: string; companyId: string }>;

  for (const spec of specs) {
    const r = await provisionTenantAndCompany(spec);
    results.push(r);
  }

  for (const r of results) {
    logger.info(JSON.stringify(r));
  }
}

if (import.meta.main) {
  main()
    .then(async () => {
      await db.end();
      process.exit(0);
    })
    .catch(async (err) => {
      logger.error(String(err?.message || err));
      await db.end();
      process.exit(1);
    });
}
