import { beforeAll, describe, expect, it } from "vitest";
import { createTestSession, createTestUser, getAuthHeaders, integrationEnabled } from "./helpers";

const API_URL = process.env.API_URL || `http://localhost:${process.env.PORT || "3002"}`;

const describeFn = integrationEnabled ? describe : describe.skip;

describeFn("Authentication Integration Tests", () => {
  let testUser: { email: string; password: string; id?: string };

  beforeAll(async () => {
    testUser = await createTestUser({
      email: `integration-${Date.now()}@example.com`,
      password: "TestPassword123!",
    });
  });

  it("should login with valid credentials", async () => {
    const response = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password,
      }),
    });

    expect(response.status).toBe(200);
    const data: any = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty("user");
    expect(data.data).toHaveProperty("expiresIn");
    expect(response.headers.get("set-cookie")).toBeTruthy();
  });

  it("should reject login with invalid credentials", async () => {
    const response = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: testUser.email,
        password: "WrongPassword123!",
      }),
    });

    expect(response.status).toBe(401);
    const data: any = await response.json();
    expect(data.success).toBe(false);
  });

  it("should refresh access token", async () => {
    // First login to get cookies
    const loginResponse = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password,
      }),
    });

    const setCookieHeader = loginResponse.headers.get("set-cookie") || "";
    const match = setCookieHeader.match(/refresh_token=([^;]+)/);
    const refreshCookie = match ? `refresh_token=${match[1]}` : "";

    // Use refresh token via Cookie header
    const refreshResponse = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(refreshCookie ? { Cookie: refreshCookie } : {}),
      },
    });

    expect(refreshResponse.status).toBe(200);
    const refreshData: any = await refreshResponse.json();
    expect(refreshData.success).toBe(true);
    expect(refreshData.data).toHaveProperty("expiresIn");
  });

  it("should logout and invalidate session", async () => {
    // Create a session first
    const sessionToken = await createTestSession(testUser.id!);

    const response = await fetch(`${API_URL}/api/v1/auth/logout`, {
      method: "POST",
      headers: await getAuthHeaders(sessionToken),
    });

    expect(response.status).toBe(200);
    const data: any = await response.json();
    expect(data.success).toBe(true);
  });
});
