import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "../../db/client";
import {
  createTestCompany,
  createTestSession,
  createTestUser,
  getAuthHeaders,
  integrationEnabled,
} from "./helpers";

const API_URL = process.env.API_URL || `http://localhost:${process.env.PORT || "3002"}`;
const describeFn = integrationEnabled ? describe : describe.skip;

describeFn("Companies list returns only customer source when paginated", () => {
  let authHeaders: Record<string, string>;
  let testUser: { email: string; password: string; id?: string };
  let customerCompanyId: string;
  let tenantCompanyId: string;

  beforeAll(async () => {
    testUser = await createTestUser();
    const token = await createTestSession(testUser.id!);
    authHeaders = await getAuthHeaders(token);

    // Create companies within test tenant to satisfy NOT NULL tenant_id
    const tenantCompany = await createTestCompany({
      name: `Tenant Co ${Date.now()}`,
      industry: "Tech",
      address: "1 Tenant St",
      source: "account" as any,
    });
    tenantCompanyId = tenantCompany.id;

    const customerCompany = await createTestCompany({
      name: `Customer Co ${Date.now()}`,
      industry: "Retail",
      address: "2 Customer Ave",
      source: "customer" as any,
    });
    customerCompanyId = customerCompany.id;
  });

  afterAll(async () => {
    await sql`DELETE FROM companies WHERE id = ${tenantCompanyId}`;
    await sql`DELETE FROM companies WHERE id = ${customerCompanyId}`;
  });

  it("GET /api/v1/companies?page=1&pageSize=50 filters to source=customer", async () => {
    const response = await fetch(`${API_URL}/api/v1/companies?page=1&pageSize=50`, {
      method: "GET",
      headers: authHeaders,
    });

    expect(response.status).toBe(200);
    const body: any = await response.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    // Ensure all returned companies are customer source
    for (const c of body.data) {
      expect(c.source).toBe("customer");
    }

    // Ensure our customer company can be present and tenant one excluded
    const ids = body.data.map((c: any) => c.id);
    expect(ids).toContain(customerCompanyId);
    expect(ids).not.toContain(tenantCompanyId);
  });
});
