import { generateUUID } from "@crm/utils";
import { describe, expect, it } from "vitest";
import { cache } from "../../cache/redis";
import { sql as db } from "../../db/client";
import { generateJWT } from "../../services/auth.service";

const API_BASE = process.env.API_URL || "http://localhost:3002";

async function getAdminBearerToken(): Promise<string> {
  const rows =
    await db`SELECT id, role, tenant_id as "tenantId", company_id as "companyId" FROM users WHERE email = 'admin@crm.local' LIMIT 1`;
  expect(rows.length).toBe(1);
  const admin = rows[0] as {
    id: string;
    role: "tenant_admin" | "superadmin" | "crm_user";
    tenantId?: string;
    companyId?: string;
  };
  const sessionId = generateUUID();
  await cache.setSession(sessionId, {
    userId: admin.id,
    role: admin.role,
    tenantId: admin.tenantId,
    companyId: admin.companyId,
  });
  const token = await generateJWT(admin.id, admin.role, admin.tenantId, admin.companyId, sessionId);
  return token;
}

async function authFetch(path: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && init.body && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}

describe("Sales tenant flow", () => {
  it("creates quote, invoice, order, delivery note within tenant and lists them", async () => {
    const token = await getAdminBearerToken();

    // Create customer company (target of documents)
    const companyRes = await authFetch("/api/v1/companies", token, {
      method: "POST",
      body: JSON.stringify({
        name: "Test Customer",
        industry: "Consulting",
        address: "Nemanjina 1, Beograd",
        email: "customer@example.rs",
        switchCompany: false,
        source: "customer",
      }),
    });
    const companyJson = (await companyRes.json()) as any;
    expect(companyRes.status).toBe(201);
    expect(companyJson.success).toBe(true);
    const customerCompanyId = companyJson.data?.id as string;
    expect(typeof customerCompanyId).toBe("string");

    // Create quote
    const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const quoteRes = await authFetch("/api/v1/quotes", token, {
      method: "POST",
      body: JSON.stringify({
        companyId: customerCompanyId,
        validUntil,
        items: [{ productName: "Usluga", quantity: 2, unitPrice: 15000 }],
        status: "sent",
      }),
    });
    const quoteJson = (await quoteRes.json()) as any;
    expect(quoteRes.status).toBe(201);
    expect(quoteJson.success).toBe(true);
    const quoteId = quoteJson.data?.id as string;
    expect(typeof quoteId).toBe("string");

    // Create invoice
    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const invRes = await authFetch("/api/v1/invoices", token, {
      method: "POST",
      body: JSON.stringify({
        companyId: customerCompanyId,
        quoteId,
        dueDate,
        items: [{ productName: "Usluga", quantity: 2, unitPrice: 15000, vatRate: 20 }],
        status: "sent",
      }),
    });
    const invJson = (await invRes.json()) as any;
    expect(invRes.status).toBe(201);
    expect(invJson.success).toBe(true);
    const invoiceId = invJson.data?.id as string;
    expect(typeof invoiceId).toBe("string");

    // Create order
    const subtotal = 30000;
    const tax = 0;
    const total = 36000;
    const orderRes = await authFetch("/api/v1/orders", token, {
      method: "POST",
      body: JSON.stringify({
        companyId: customerCompanyId,
        quoteId,
        invoiceId,
        status: "processing",
        subtotal,
        tax,
        total,
        currency: "RSD",
        notes: "Test narudžba",
        items: [
          {
            productName: "Usluga",
            quantity: 2,
            unitPrice: 15000,
            total: 30000,
          },
        ],
      }),
    });
    const orderJson = (await orderRes.json()) as any;
    expect(orderRes.status).toBe(201);
    expect(orderJson.success).toBe(true);
    const orderId = orderJson.data?.id as string;
    expect(typeof orderId).toBe("string");

    // Create delivery note
    const delivRes = await authFetch("/api/v1/delivery-notes", token, {
      method: "POST",
      body: JSON.stringify({
        companyId: customerCompanyId,
        invoiceId,
        status: "in_transit",
        shipDate: new Date().toISOString(),
        shippingAddress: "Beograd, Savska 1",
        items: [
          {
            productName: "Usluga",
            quantity: 2,
            unit: "usluga",
            unitPrice: 15000,
            total: 30000,
          },
        ],
      }),
    });
    const delivJson = (await delivRes.json()) as any;
    expect(delivRes.status).toBe(201);
    expect(delivJson.success).toBe(true);

    // Validate listing by company
    const listQuotes = await authFetch(`/api/v1/quotes?companyId=${customerCompanyId}`, token);
    const qL = (await listQuotes.json()) as any;
    expect(qL.success).toBe(true);
    expect(qL.data.length).toBeGreaterThan(0);

    const listInvoices = await authFetch(`/api/v1/invoices?companyId=${customerCompanyId}`, token);
    const iL = (await listInvoices.json()) as any;
    expect(iL.success).toBe(true);
    expect(iL.data.length).toBeGreaterThan(0);

    const listOrders = await authFetch(`/api/v1/orders?companyId=${customerCompanyId}`, token);
    const oL = (await listOrders.json()) as any;
    expect(oL.success).toBe(true);
    expect(oL.data.length).toBeGreaterThan(0);

    const listDeliv = await authFetch(
      `/api/v1/delivery-notes?companyId=${customerCompanyId}`,
      token
    );
    const dL = (await listDeliv.json()) as any;
    expect(dL.success).toBe(true);
    expect(dL.data.length).toBeGreaterThan(0);
  });
});
