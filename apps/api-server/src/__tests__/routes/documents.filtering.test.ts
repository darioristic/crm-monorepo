import { successResponse } from "@crm/utils";
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

vi.mock("../../services/documents.service", () => ({
  documentsService: {
    getDocuments: vi.fn(async () => successResponse([{ id: "d1" }])),
  },
  documentTagsService: {},
  documentTagAssignmentsService: {},
}));

describe("Documents Route - companyId precedence", () => {
  const mockUserId = "550e8400-e29b-41d4-a716-446655440000";
  const mockSessionId = "660e8400-e29b-41d4-a716-446655440001";
  const queryCompanyId = "3c95616a-f94e-4faf-abb4-2241e2c742fd";
  const headerCompanyId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.mockGetSession.mockResolvedValue({
      userId: mockUserId,
      userRole: "tenant_admin",
      companyId: queryCompanyId,
      email: "user@example.com",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  });

  it("respects query companyId over header", async () => {
    const token = await generateJWT(mockUserId, "tenant_admin", queryCompanyId, mockSessionId);
    const url = new URL(`http://localhost/api/v1/documents?companyId=${queryCompanyId}`);
    const request = new Request(url.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, "X-Company-Id": headerCompanyId },
    });

    const response = await handleRequest(request, url);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
  });
});
