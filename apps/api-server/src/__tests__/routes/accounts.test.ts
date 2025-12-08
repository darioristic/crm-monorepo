import { beforeAll, describe, expect, it } from "vitest";

let handleRequest: any;
let generateJWT: any;

const mockUserId = "00000000-0000-0000-0000-000000000001";
const mockCompanyId = "00000000-0000-0000-0000-000000000002";
const mockSessionId = "00000000-0000-0000-0000-000000000003";

beforeAll(async () => {
  const routes = await import("../../routes/index");
  handleRequest = routes.handleRequest;
  const auth = await import("../../services/auth.service");
  generateJWT = auth.generateJWT;
});

describe("Accounts routes", () => {
  it("GET /api/v1/accounts/search returns application/json", async () => {
    const token = await generateJWT(mockUserId, "user", mockCompanyId, mockSessionId);
    const url = new URL(`http://localhost/api/v1/accounts/search?q=&limit=5`);
    const request = new Request(url.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    const response = await handleRequest(request, url);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    const body: any = await response.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});
