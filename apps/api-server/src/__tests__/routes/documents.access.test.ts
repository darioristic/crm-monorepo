import { beforeEach, describe, expect, it, vi } from "vitest";
import * as companiesMembers from "../../db/queries/companies-members";
import * as authMiddleware from "../../middleware/auth";
import { documentRoutes } from "../../routes/documents";

vi.mock("../../middleware/auth");
vi.mock("../../db/queries/companies-members");

describe("Documents Routes - pristup samo članovima kompanije", () => {
  const mockAuth = {
    userId: "user-123",
    role: "crm_user" as const,
    tenantRoles: [],
    sessionId: "session-123",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authMiddleware.verifyAndGetUser).mockResolvedValue(mockAuth);
    vi.mocked(companiesMembers.hasCompanyAccess).mockResolvedValue(false);
  });

  const callRoute = async (
    path: string,
    method = "GET",
    options: RequestInit = {},
    query: string = ""
  ): Promise<Response> => {
    const url = new URL(`http://localhost${path}${query}`);
    const request = new Request(url.toString(), { method, ...options });

    const route = documentRoutes.find((r) => r.method === method && r.pattern.test(path));
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

  it("odbij kada korisnik nije član prosleđene kompanije", async () => {
    const response = await callRoute("/api/v1/documents", "GET", {}, "?companyId=company-abc");
    expect(response.status).toBe(403);
    const data: any = await response.json();
    expect(data.success).toBe(false);
    expect(data.error?.code).toBe("FORBIDDEN");
  });
});
