import { describe, expect, it } from "vitest";
import { sql } from "../../db/client";
import { createTestSession, createTestUser, integrationEnabled } from "./helpers";

const API_URL = process.env.API_URL || `http://localhost:${process.env.PORT || "3002"}`;
const describeFn = integrationEnabled ? describe : describe.skip;

describeFn("Customer company edit by tenant_admin", () => {
  it("tenant_admin može da izmeni sva polja osim naziva", async () => {
    const sarah = await createTestUser({
      email: `sarah.johnson+int-${Date.now()}@techcorp.com`,
      password: "changeme123",
    });
    await sql`UPDATE users SET role = 'tenant_admin' WHERE id = ${sarah.id as string}`;
    const token = await createTestSession(sarah.id!);
    const authHeader = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const createResp = await fetch(`${API_URL}/api/v1/companies`, {
      method: "POST",
      headers: authHeader,
      body: JSON.stringify({
        name: "Comtrade Sistem Integracija DOO",
        industry: "IT Services",
        address: "Savski Nasip 7, Beograd",
        source: "customer",
        switchCompany: false,
      }),
    });

    expect(createResp.status).toBe(201);
    const created: any = await createResp.json();
    expect(created.success).toBe(true);
    const companyId = created.data.id as string;

    const updateResp = await fetch(`${API_URL}/api/v1/companies/${companyId}`, {
      method: "PUT",
      headers: authHeader,
      body: JSON.stringify({
        industry: "System Integration",
        address: "Nemanjina 4, Beograd",
        email: "contact@comtrade.rs",
        phone: "+381 11 555 123",
        website: "https://www.comtrade.rs",
        contact: "Operativni Kontakt",
        city: "Beograd",
        zip: "11000",
        country: "Serbia",
        countryCode: "RS",
        vatNumber: "109999999",
        companyNumber: "066666666",
        note: "Ažurirano kroz integracioni test",
      }),
    });

    const updateBodyText = await updateResp.text();
    if (updateResp.status !== 200) {
    }
    expect(updateResp.status).toBe(200);
    const updated: any = JSON.parse(updateBodyText);
    expect(updated.success).toBe(true);
    expect(updated.data.name).toBe("Comtrade Sistem Integracija DOO");
    expect(updated.data.email).toBe("contact@comtrade.rs");

    const getResp = await fetch(`${API_URL}/api/v1/companies/${companyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(getResp.status).toBe(200);
    const getData: any = await getResp.json();
    const c = getData.data;
    expect(c.name).toBe("Comtrade Sistem Integracija DOO");
    expect(c.industry).toBe("System Integration");
    expect(c.address).toBe("Nemanjina 4, Beograd");
    expect(c.email).toBe("contact@comtrade.rs");
    expect(c.phone).toBe("+381 11 555 123");
    expect(c.website).toBe("https://www.comtrade.rs");
    expect(c.contact).toBe("Operativni Kontakt");
    expect(c.city).toBe("Beograd");
    expect(c.zip).toBe("11000");
    expect(c.country).toBe("Serbia");
    expect(c.countryCode).toBe("RS");
    expect(c.vatNumber).toBe("109999999");
    expect(c.companyNumber).toBe("066666666");
    expect(c.note).toBe("Ažurirano kroz integracioni test");
    expect(c.source).toBe("customer");
  });
});
