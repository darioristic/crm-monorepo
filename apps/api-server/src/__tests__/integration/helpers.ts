import type { Company, UserRole } from "@crm/types";
import { cache } from "../../cache/redis";
import { sql } from "../../db/client";
import { authQueries } from "../../db/queries/auth";
import { userQueries } from "../../db/queries/users";
import { generateJWT, hashPassword } from "../../services/auth.service";

export interface TestUser {
  email: string;
  password: string;
  id?: string;
  companyId?: string;
  firstName?: string;
  lastName?: string;
}

async function ensureTestTenant(): Promise<string> {
  const existing = await sql`
    SELECT id FROM tenants WHERE slug = ${"test-tenant"} LIMIT 1
  `;
  if (existing.length > 0) {
    return existing[0].id as string;
  }
  const inserted = await sql`
    INSERT INTO tenants (name, slug, status)
    VALUES (${"Test Tenant"}, ${"test-tenant"}, ${"active"})
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `;
  return inserted[0].id as string;
}

export async function createTestUser(userData: Partial<TestUser> = {}): Promise<TestUser> {
  const email = userData.email || `test-${crypto.randomUUID()}@example.com`;
  const password = userData.password || "TestPassword123!";
  const firstName = userData.firstName || "Test";
  const lastName = userData.lastName || "User";

  // Hash password using the actual auth service
  const hashedPassword = await hashPassword(password);

  const tenantId = await ensureTestTenant();

  // Create user with tenant
  const [user] = await sql`
    INSERT INTO users (first_name, last_name, email, role, company_id, tenant_id, created_at, updated_at)
    VALUES (${firstName}, ${lastName}, ${email}, 'crm_user', ${userData.companyId || null}, ${tenantId}, NOW(), NOW())
    RETURNING id, email, company_id, tenant_id
  `;

  // Ensure user has an active company and membership for permission checks
  let activeCompanyId = user.company_id as string | null;
  if (!activeCompanyId) {
    const [company] = await sql`
      INSERT INTO companies (tenant_id, name, industry, address, source, created_at, updated_at)
      VALUES (${tenantId}, ${`Test Company ${Date.now()}`}, ${"Technology"}, ${"123 Test Street, Test City"}, 'account', NOW(), NOW())
      RETURNING id
    `;
    activeCompanyId = company.id as string;

    // Add membership and set as active company
    await sql`
			INSERT INTO users_on_company (user_id, company_id, role)
			VALUES (${user.id}, ${activeCompanyId}, 'owner')
		`;
    await sql`
			UPDATE users SET company_id = ${activeCompanyId}, updated_at = NOW()
			WHERE id = ${user.id}
		`;
  }

  // Create auth credentials
  await authQueries.createCredentials(user.id, hashedPassword);

  return {
    email: user.email,
    password,
    id: user.id,
    companyId: (activeCompanyId as string) || (user.company_id as string | undefined),
    firstName,
    lastName,
  };
}

export async function createTestCompany(companyData: Partial<Company> = {}): Promise<Company> {
  const name = companyData.name || `Test Company ${Date.now()}`;
  const industry = companyData.industry || "Technology";
  const address = companyData.address || "123 Test Street, Test City";

  const tenantId = await ensureTestTenant();

  const [company] = await sql`
    INSERT INTO companies (tenant_id, name, industry, address, source, created_at, updated_at)
    VALUES (${tenantId}, ${name}, ${industry}, ${address}, ${companyData.source ?? "customer"}, NOW(), NOW())
    RETURNING *
  `;

  return company as Company;
}

export async function createTestSession(userId: string): Promise<string> {
  const user = await userQueries.findById(userId);
  const role: UserRole =
    user?.role === "superadmin" || user?.role === "tenant_admin" || user?.role === "crm_user"
      ? (user.role as UserRole)
      : "crm_user";

  const sessionId = crypto.randomUUID();
  const sessionData = {
    userId,
    userRole: role,
    tenantId: user?.tenantId,
    companyId: user?.companyId,
    email: user?.email || `test-${Date.now()}@example.com`,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };

  await cache.setSession(sessionId, sessionData as unknown as Record<string, unknown>, 3600);

  const token = await generateJWT(userId, role, user?.tenantId, user?.companyId, sessionId);
  return token;
}

export async function getAuthHeaders(sessionToken: string): Promise<Record<string, string>> {
  return {
    Authorization: `Bearer ${sessionToken}`,
    "Content-Type": "application/json",
  };
}

export async function cleanupUser(userId: string): Promise<void> {
  // Delete auth credentials first (foreign key constraint)
  await authQueries.deleteCredentials(userId);
  // Delete user
  await sql`DELETE FROM users WHERE id = ${userId}`;
}

export async function cleanupCompany(companyId: string): Promise<void> {
  // Delete company (cascade will handle related records)
  await sql`DELETE FROM companies WHERE id = ${companyId}`;
}

export const integrationEnabled: boolean = true;
