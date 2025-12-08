import { beforeEach, describe, expect, it, vi } from "vitest";
import * as authMiddleware from "../../middleware/auth";
import { salesRoutes } from "../../routes/sales";

vi.mock("../../middleware/auth");

describe("Sales Routes - companyId validation", () => {
  const mockAuth = {
    userId: "user-123",
    role: "user" as const,
    sessionId: "session-123",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authMiddleware.verifyAndGetUser).mockResolvedValue(mockAuth);
  });

  const callRoute = async (
    path: string,
    method = "GET",
    options: RequestInit = {},
    query: string = ""
  ): Promise<Response> => {
    const url = new URL(`http://localhost${path}${query}`);
    const request = new Request(url.toString(), { method, ...options });

    const route = salesRoutes.find((r) => r.method === method && r.pattern.test(path));
    if (!route) throw new Error(`No route found for ${method} ${path}`);

    const match = path.match(route.pattern);
    const params: Record<string, string> = {};
    if (match && route.params.length > 0) {
      route.params.forEach((param, index) => {
        params[param] = match[index + 1];
      });
    }

    return route.handler(request, url, params);
  };

  it("GET /api/v1/quotes returns 400 for invalid companyId", async () => {
    const response = await callRoute("/api/v1/quotes", "GET", {}, "?companyId=not-a-uuid");
    const data: any = await response.json();
    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET /api/v1/invoices returns 400 for invalid companyId", async () => {
    const response = await callRoute("/api/v1/invoices", "GET", {}, "?companyId=bad-uuid");
    const data: any = await response.json();
    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET /api/v1/delivery-notes returns 400 for invalid companyId", async () => {
    const response = await callRoute("/api/v1/delivery-notes", "GET", {}, "?companyId=wrong");
    const data: any = await response.json();
    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });
});
