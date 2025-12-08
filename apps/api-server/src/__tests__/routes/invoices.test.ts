import { errorResponse, successResponse } from "@crm/utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleRequest } from "../../routes/index";
import { generateJWT } from "../../services/auth.service";

const hoisted = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

vi.mock("../../cache/redis", () => ({
  cache: {
    getSession: hoisted.mockGetSession,
  },
}));

vi.mock("../../db/queries/companies-members", () => ({
  hasCompanyAccess: vi.fn(async () => true),
}));

vi.mock("../../services/sales.service", () => ({
  salesService: {
    getInvoices: vi.fn(async (_companyId: string | null) => successResponse([{ id: "i1" }])),
  },
}));

describe("Invoices Route - JSON Responses", () => {
  const mockUserId = "550e8400-e29b-41d4-a716-446655440000";
  const mockSessionId = "660e8400-e29b-41d4-a716-446655440001";
  const mockCompanyId = "3c95616a-f94e-4faf-abb4-2241e2c742fd";

  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.mockGetSession.mockResolvedValue({
      userId: mockUserId,
      userRole: "user",
      companyId: mockCompanyId,
      email: "user@example.com",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  });

  it("GET /api/v1/invoices returns application/json on success", async () => {
    const token = await generateJWT(mockUserId, "user", mockCompanyId, mockSessionId);
    const url = new URL(
      `http://localhost/api/v1/invoices?companyId=${mockCompanyId}&page=1&pageSize=20`
    );
    const request = new Request(url.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    const response = await handleRequest(request, url);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    const body: any = await response.json();
    expect(body.success).toBe(true);
  });

  it("GET /api/v1/invoices returns application/json on server error", async () => {
    const token = await generateJWT(mockUserId, "user", mockCompanyId, mockSessionId);
    const { salesService } = await import("../../services/sales.service");
    (salesService.getInvoices as any).mockResolvedValueOnce(
      errorResponse("INTERNAL_ERROR", "Failure")
    );

    const url = new URL(`http://localhost/api/v1/invoices?companyId=${mockCompanyId}`);
    const request = new Request(url.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    const response = await handleRequest(request, url);
    expect(response.status).toBe(500);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    const body: any = await response.json();
    expect(body.success).toBe(false);
  });
});
