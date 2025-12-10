import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AuthContext,
  checkRateLimitByIp,
  checkRateLimitByUser,
  checkRateLimitCombined,
  getClientIp,
  getRateLimitHeaders,
  RATE_LIMITS,
  type RateLimitConfig,
  rateLimitExceededResponse,
  withLoginRateLimit,
  withRateLimit,
  withRateLimitByIp,
  withWriteRateLimit,
} from "../../middleware/rate-limit";

// Mock cache module (avoid top-level init issues with hoisting)
const hoisted = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn(),
}));
vi.mock("../../cache/redis", () => ({
  cache: {
    checkRateLimit: hoisted.mockCheckRateLimit,
  },
}));

describe("Rate Limit Middleware", () => {
  const mockUserId = "550e8400-e29b-41d4-a716-446655440000";
  const mockSessionId = "660e8400-e29b-41d4-a716-446655440001";
  const mockCompanyId = "770e8400-e29b-41d4-a716-446655440002";

  const mockAuth: AuthContext = {
    userId: mockUserId,
    role: "user",
    tenantRoles: [],
    companyId: mockCompanyId,
    sessionId: mockSessionId,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // Client IP Extraction Tests
  // ============================================

  describe("getClientIp", () => {
    it("should extract IP from x-forwarded-for header", () => {
      const request = new Request("http://localhost", {
        headers: { "x-forwarded-for": "192.168.1.1, 10.0.0.1" },
      });

      const ip = getClientIp(request);
      expect(ip).toBe("192.168.1.1");
    });

    it("should extract IP from x-real-ip header", () => {
      const request = new Request("http://localhost", {
        headers: { "x-real-ip": "192.168.1.2" },
      });

      const ip = getClientIp(request);
      expect(ip).toBe("192.168.1.2");
    });

    it("should extract IP from cf-connecting-ip header (Cloudflare)", () => {
      const request = new Request("http://localhost", {
        headers: { "cf-connecting-ip": "192.168.1.3" },
      });

      const ip = getClientIp(request);
      expect(ip).toBe("192.168.1.3");
    });

    it("should prefer x-forwarded-for over other headers", () => {
      const request = new Request("http://localhost", {
        headers: {
          "x-forwarded-for": "192.168.1.1",
          "x-real-ip": "192.168.1.2",
          "cf-connecting-ip": "192.168.1.3",
        },
      });

      const ip = getClientIp(request);
      expect(ip).toBe("192.168.1.1");
    });

    it('should return "unknown" when no IP headers present', () => {
      const request = new Request("http://localhost");

      const ip = getClientIp(request);
      expect(ip).toBe("unknown");
    });

    it("should handle IPv6 addresses", () => {
      const request = new Request("http://localhost", {
        headers: { "x-forwarded-for": "2001:0db8:85a3::8a2e:0370:7334" },
      });

      const ip = getClientIp(request);
      expect(ip).toBe("2001:0db8:85a3::8a2e:0370:7334");
    });

    it("should trim whitespace from x-forwarded-for", () => {
      const request = new Request("http://localhost", {
        headers: { "x-forwarded-for": "  192.168.1.1  , 10.0.0.1" },
      });

      const ip = getClientIp(request);
      expect(ip).toBe("192.168.1.1");
    });
  });

  // ============================================
  // Rate Limit Check Functions Tests
  // ============================================

  describe("checkRateLimitByIp", () => {
    it("should check rate limit for IP address", async () => {
      const request = new Request("http://localhost", {
        headers: { "x-forwarded-for": "192.168.1.1" },
      });

      hoisted.mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        resetIn: 900,
      });

      const result = await checkRateLimitByIp(request, "/api/test");

      expect(hoisted.mockCheckRateLimit).toHaveBeenCalledWith("ip:192.168.1.1:/api/test", 100, 900);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
      expect(result.limit).toBe(100);
    });

    it("should use custom rate limit config", async () => {
      const request = new Request("http://localhost", {
        headers: { "x-forwarded-for": "192.168.1.1" },
      });

      hoisted.mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 4,
        resetIn: 60,
      });

      const customConfig: RateLimitConfig = { requests: 5, windowSeconds: 60 };
      const result = await checkRateLimitByIp(request, "/api/login", customConfig);

      expect(hoisted.mockCheckRateLimit).toHaveBeenCalledWith("ip:192.168.1.1:/api/login", 5, 60);
      expect(result.limit).toBe(5);
    });

    it("should return not allowed when rate limit exceeded", async () => {
      const request = new Request("http://localhost", {
        headers: { "x-forwarded-for": "192.168.1.1" },
      });

      hoisted.mockCheckRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetIn: 45,
      });

      const result = await checkRateLimitByIp(request, "/api/test");

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe("checkRateLimitByUser", () => {
    it("should check rate limit for user ID", async () => {
      hoisted.mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 19,
        resetIn: 60,
      });

      const result = await checkRateLimitByUser(mockUserId, "/api/create");

      expect(hoisted.mockCheckRateLimit).toHaveBeenCalledWith(
        `user:${mockUserId}:/api/create`,
        100,
        900
      );
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(19);
    });

    it("should use custom config for user rate limit", async () => {
      hoisted.mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetIn: 60,
      });

      const result = await checkRateLimitByUser(mockUserId, "/api/write", RATE_LIMITS.write);

      expect(hoisted.mockCheckRateLimit).toHaveBeenCalledWith(
        `user:${mockUserId}:/api/write`,
        20,
        60
      );
      expect(result.limit).toBe(20);
    });
  });

  describe("checkRateLimitCombined", () => {
    it("should use user-based limiting when authenticated", async () => {
      const request = new Request("http://localhost", {
        headers: { "x-forwarded-for": "192.168.1.1" },
      });

      hoisted.mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        resetIn: 900,
      });

      const result = await checkRateLimitCombined(request, mockAuth, "/api/test");

      expect(hoisted.mockCheckRateLimit).toHaveBeenCalledWith(
        `user:${mockUserId}:/api/test`,
        100,
        900
      );
      expect(result.allowed).toBe(true);
    });

    it("should use IP-based limiting when not authenticated", async () => {
      const request = new Request("http://localhost", {
        headers: { "x-forwarded-for": "192.168.1.1" },
      });

      hoisted.mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        resetIn: 900,
      });

      const result = await checkRateLimitCombined(request, undefined, "/api/test");

      expect(hoisted.mockCheckRateLimit).toHaveBeenCalledWith("ip:192.168.1.1:/api/test", 100, 900);
      expect(result.allowed).toBe(true);
    });
  });

  // ============================================
  // Rate Limit Headers Tests
  // ============================================

  describe("getRateLimitHeaders", () => {
    it("should generate correct rate limit headers", () => {
      const result = {
        allowed: true,
        remaining: 95,
        resetIn: 600,
        limit: 100,
      };

      const headers = getRateLimitHeaders(result);

      expect(headers["X-RateLimit-Limit"]).toBe("100");
      expect(headers["X-RateLimit-Remaining"]).toBe("95");
      expect(headers["X-RateLimit-Reset"]).toBeDefined();
    });

    it("should include reset time as unix timestamp", () => {
      const result = {
        allowed: false,
        remaining: 0,
        resetIn: 60,
        limit: 5,
      };

      const headers = getRateLimitHeaders(result);
      const resetTime = Number.parseInt(headers["X-RateLimit-Reset"], 10);
      const currentTime = Math.ceil(Date.now() / 1000);

      // Reset time should be approximately current time + 60 seconds
      expect(resetTime).toBeGreaterThanOrEqual(currentTime);
      expect(resetTime).toBeLessThanOrEqual(currentTime + 65);
    });
  });

  describe("rateLimitExceededResponse", () => {
    it("should return 429 response with correct structure", async () => {
      const result = {
        allowed: false,
        remaining: 0,
        resetIn: 45,
        limit: 5,
      };

      const response = rateLimitExceededResponse(result);

      expect(response.status).toBe(429);
      expect(response.headers.get("Content-Type")).toBe("application/json");
      expect(response.headers.get("Retry-After")).toBe("45");

      const data: any = await response.json();
      expect(data.error.code).toBe("RATE_LIMITED");
      expect(data.error.message).toContain("45 seconds");
    });

    it("should include rate limit headers", async () => {
      const result = {
        allowed: false,
        remaining: 0,
        resetIn: 30,
        limit: 10,
      };

      const response = rateLimitExceededResponse(result);

      expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
      expect(response.headers.get("X-RateLimit-Reset")).toBeDefined();
    });
  });

  // ============================================
  // Middleware Functions Tests
  // ============================================

  describe("withRateLimitByIp", () => {
    const mockHandler = vi.fn(async () => new Response("success"));
    const mockUrl = new URL("http://localhost/api/test");
    const mockParams = {};

    it("should call handler when rate limit not exceeded", async () => {
      const request = new Request("http://localhost/api/test", {
        method: "POST",
        headers: { "x-forwarded-for": "192.168.1.1" },
      });

      hoisted.mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        resetIn: 900,
      });

      const handler = withRateLimitByIp(RATE_LIMITS.default, mockHandler);
      const response = await handler(request, mockUrl, mockParams);

      expect(mockHandler).toHaveBeenCalled();
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe("success");

      // Check rate limit headers are added
      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
    });

    it("should return 429 when rate limit exceeded", async () => {
      const request = new Request("http://localhost/api/test", {
        method: "POST",
        headers: { "x-forwarded-for": "192.168.1.1" },
      });

      hoisted.mockCheckRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetIn: 45,
      });

      const handler = withRateLimitByIp(RATE_LIMITS.default, mockHandler);
      const response = await handler(request, mockUrl, mockParams);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("45");
    });

    it("should include HTTP method and path in rate limit key", async () => {
      const request = new Request("http://localhost/api/create", {
        method: "POST",
        headers: { "x-forwarded-for": "192.168.1.1" },
      });

      const url = new URL("http://localhost/api/create");

      hoisted.mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 19,
        resetIn: 60,
      });

      const handler = withRateLimitByIp(RATE_LIMITS.write, mockHandler);
      await handler(request, url, mockParams);

      expect(hoisted.mockCheckRateLimit).toHaveBeenCalledWith(
        "ip:192.168.1.1:POST:/api/create",
        20,
        60
      );
    });
  });

  describe("withRateLimit", () => {
    const mockHandler = vi.fn(async () => new Response("success"));
    const mockUrl = new URL("http://localhost/api/test");
    const mockParams = {};

    it("should use user-based rate limiting when authenticated", async () => {
      const request = new Request("http://localhost/api/test", {
        method: "GET",
        headers: { "x-forwarded-for": "192.168.1.1" },
      });

      hoisted.mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        resetIn: 900,
      });

      const handler = withRateLimit(RATE_LIMITS.default, mockHandler);
      await handler(request, mockUrl, mockParams, mockAuth);

      expect(hoisted.mockCheckRateLimit).toHaveBeenCalledWith(
        `user:${mockUserId}:GET:/api/test`,
        100,
        900
      );
    });

    it("should use IP-based rate limiting when not authenticated", async () => {
      const request = new Request("http://localhost/api/test", {
        method: "GET",
        headers: { "x-forwarded-for": "192.168.1.1" },
      });

      hoisted.mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        resetIn: 900,
      });

      const handler = withRateLimit(RATE_LIMITS.default, mockHandler);
      await handler(request, mockUrl, mockParams);

      expect(hoisted.mockCheckRateLimit).toHaveBeenCalledWith(
        "ip:192.168.1.1:GET:/api/test",
        100,
        900
      );
    });

    it("should add rate limit headers to successful response", async () => {
      const request = new Request("http://localhost/api/test", {
        method: "GET",
        headers: { "x-forwarded-for": "192.168.1.1" },
      });

      hoisted.mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 50,
        resetIn: 450,
      });

      const handler = withRateLimit(RATE_LIMITS.default, mockHandler);
      const response = await handler(request, mockUrl, mockParams);

      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("50");
      expect(response.headers.get("X-RateLimit-Reset")).toBeDefined();
    });
  });

  describe("withLoginRateLimit", () => {
    const mockHandler = vi.fn(async () => new Response("success"));
    const mockUrl = new URL("http://localhost/api/login");
    const mockParams = {};

    it("should use strict login rate limit config", async () => {
      const request = new Request("http://localhost/api/login", {
        method: "POST",
        headers: { "x-forwarded-for": "192.168.1.1" },
      });

      hoisted.mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 4,
        resetIn: 60,
      });

      const handler = withLoginRateLimit(mockHandler);
      await handler(request, mockUrl, mockParams);

      // Should use RATE_LIMITS.login (5 requests per minute)
      expect(hoisted.mockCheckRateLimit).toHaveBeenCalledWith(
        "ip:192.168.1.1:POST:/api/login",
        5,
        60
      );
    });

    it("should block after 5 failed login attempts", async () => {
      const request = new Request("http://localhost/api/login", {
        method: "POST",
        headers: { "x-forwarded-for": "192.168.1.1" },
      });

      hoisted.mockCheckRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetIn: 45,
      });

      const handler = withLoginRateLimit(mockHandler);
      const response = await handler(request, mockUrl, mockParams);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(response.status).toBe(429);
    });
  });

  describe("withWriteRateLimit", () => {
    const mockHandler = vi.fn(async () => new Response("success"));
    const mockUrl = new URL("http://localhost/api/create");
    const mockParams = {};

    it("should use write operations rate limit config", async () => {
      const request = new Request("http://localhost/api/create", {
        method: "POST",
        headers: { "x-forwarded-for": "192.168.1.1" },
      });

      hoisted.mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 19,
        resetIn: 60,
      });

      const handler = withWriteRateLimit(mockHandler);
      await handler(request, mockUrl, mockParams, mockAuth);

      // Should use RATE_LIMITS.write (20 requests per minute)
      expect(hoisted.mockCheckRateLimit).toHaveBeenCalledWith(
        `user:${mockUserId}:POST:/api/create`,
        20,
        60
      );
    });
  });

  // ============================================
  // Rate Limit Configuration Tests
  // ============================================

  describe("RATE_LIMITS configuration", () => {
    it("should have default rate limit", () => {
      expect(RATE_LIMITS.default).toEqual({
        requests: 100,
        windowSeconds: 900,
      });
    });

    it("should have strict login rate limit", () => {
      expect(RATE_LIMITS.login).toEqual({
        requests: 5,
        windowSeconds: 60,
      });
    });

    it("should have write operations rate limit", () => {
      expect(RATE_LIMITS.write).toEqual({
        requests: 20,
        windowSeconds: 60,
      });
    });

    it("should have refresh token rate limit", () => {
      expect(RATE_LIMITS.refresh).toEqual({
        requests: 10,
        windowSeconds: 60,
      });
    });

    it("should have reports rate limit", () => {
      expect(RATE_LIMITS.reports).toEqual({
        requests: 30,
        windowSeconds: 60,
      });
    });

    it("should have strict rate limit for sensitive operations", () => {
      expect(RATE_LIMITS.strict).toEqual({
        requests: 3,
        windowSeconds: 60,
      });
    });
  });
});
