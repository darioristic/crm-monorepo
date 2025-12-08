import { beforeAll, describe, expect, it } from "vitest";
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

describeFn("Invoices API Integration Tests", () => {
  let testUser: { email: string; password: string; id?: string };
  let testCompany: { id: string; name: string };
  let authHeaders: Record<string, string>;
  let sessionToken: string;

  beforeAll(async () => {
    testUser = await createTestUser();
    testCompany = await createTestCompany();
    sessionToken = await createTestSession(testUser.id!);
    authHeaders = await getAuthHeaders(sessionToken);
  });

  it("should list invoices", async () => {
    const response = await fetch(`${API_URL}/api/v1/invoices`, {
      method: "GET",
      headers: authHeaders,
    });

    expect(response.status).toBe(200);
    const data: any = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });

  it("should create a new invoice", async () => {
    const invoiceData = {
      companyId: testCompany.id,
      createdBy: testUser.id,
      currency: "USD",
      status: "draft",
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      items: [
        {
          productName: "Test Service",
          description: "Integration test item",
          quantity: 2,
          unitPrice: 250,
          discount: 0,
        },
      ],
    };

    const response = await fetch(`${API_URL}/api/v1/invoices`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(invoiceData),
    });

    expect(response.status).toBe(201);
    const data: any = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty("id");
    expect(data.data.total).toBeDefined();

    // Cleanup
    if (data.data?.id) {
      await sql`DELETE FROM invoices WHERE id = ${data.data.id}`;
    }
  });

  it("should get invoice by ID", async () => {
    // Create an invoice first
    const createResponse = await fetch(`${API_URL}/api/v1/invoices`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        companyId: testCompany.id,
        createdBy: testUser.id,
        currency: "USD",
        status: "draft",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        items: [{ productName: "Item A", quantity: 1, unitPrice: 100, discount: 0 }],
      }),
    });

    const createData: any = await createResponse.json();
    const invoiceId = createData.data.id;

    // Get the invoice
    const response = await fetch(`${API_URL}/api/v1/invoices/${invoiceId}`, {
      method: "GET",
      headers: { ...authHeaders, "x-company-id": testCompany.id },
    });
    const dbgBody = await response.text();
    expect(response.status).toBe(200);
    const data: any = JSON.parse(dbgBody);
    expect(data.success).toBe(true);
    expect(data.data.id).toBe(invoiceId);

    // Cleanup
    await sql`DELETE FROM invoices WHERE id = ${invoiceId}`;
  });

  it("should update invoice", async () => {
    // Create an invoice first
    const createResponse = await fetch(`${API_URL}/api/v1/invoices`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        companyId: testCompany.id,
        createdBy: testUser.id,
        currency: "USD",
        status: "draft",
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        items: [{ productName: "Item B", quantity: 3, unitPrice: 50, discount: 0 }],
      }),
    });

    const createData: any = await createResponse.json();
    const invoiceId = createData.data.id;

    // Update the invoice
    const response = await fetch(`${API_URL}/api/v1/invoices/${invoiceId}`, {
      method: "PUT",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
        "x-company-id": testCompany.id,
      },
      body: JSON.stringify({
        status: "sent",
      }),
    });
    const dbgBody2 = await response.text();
    expect(response.status).toBe(200);
    const data: any = JSON.parse(dbgBody2);
    expect(data.success).toBe(true);
    expect(data.data.total).toBeDefined();
    expect(data.data.status).toBe("sent");

    // Cleanup
    await sql`DELETE FROM invoices WHERE id = ${invoiceId}`;
  });

  it("should get overdue invoices", async () => {
    const response = await fetch(`${API_URL}/api/v1/invoices/overdue`, {
      method: "GET",
      headers: authHeaders,
    });

    expect(response.status).toBe(200);
    const data: any = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });
});
