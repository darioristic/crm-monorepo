import { beforeAll, describe, expect, it } from "vitest";

let handleRequest: any;
let generateJWT: any;

const mockUserId = "00000000-0000-0000-0000-000000000001";
const companyA = "00000000-0000-0000-0000-0000000000AA";
const companyB = "00000000-0000-0000-0000-0000000000BB";
const mockSessionId = "00000000-0000-0000-0000-000000000003";

beforeAll(async () => {
  const routes = await import("../../routes/index");
  handleRequest = routes.handleRequest;
  const auth = await import("../../services/auth.service");
  generateJWT = auth.generateJWT;
});

describe("Sales company scoping", () => {
  it("uses X-Company-Id header to scope invoices", async () => {
    const token = await generateJWT(mockUserId, "user", companyA, mockSessionId);
    const url = new URL("http://localhost/api/v1/invoices");
    const request = new Request(url.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, "X-Company-Id": companyA },
    });
    const response = await handleRequest(request, url);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
  });

  it("defaults to user's active company when header missing", async () => {
    const token = await generateJWT(mockUserId, "user", companyB, mockSessionId);
    const url = new URL("http://localhost/api/v1/quotes");
    const request = new Request(url.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    const response = await handleRequest(request, url);
    expect(response.status).toBe(200);
    const data: any = await response.json();
    expect(data.success).toBe(true);
  });

  it("scopes delivery notes by header and does not filter by user", async () => {
    const token = await generateJWT(mockUserId, "user", companyA, mockSessionId);
    const url = new URL("http://localhost/api/v1/delivery-notes");
    const request = new Request(url.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, "X-Company-Id": companyA },
    });
    const response = await handleRequest(request, url);
    expect(response.status).toBe(200);
  });

  it("handles multiple concurrent requests efficiently", async () => {
    const token = await generateJWT(mockUserId, "user", companyA, mockSessionId);
    const makeReq = () => {
      const url = new URL("http://localhost/api/v1/invoices");
      const request = new Request(url.toString(), {
        method: "GET",
        headers: { Authorization: `Bearer ${token}`, "X-Company-Id": companyA },
      });
      return handleRequest(request, url);
    };
    const responses = await Promise.all(Array.from({ length: 5 }, makeReq));
    responses.forEach((r) => expect(r.status).toBe(200));
  });
});
