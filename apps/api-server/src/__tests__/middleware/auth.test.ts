import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AuthContext,
  canAccessCompany,
  canAccessUser,
  extractJWT,
  isAdmin,
  isUser,
  optionalAuth,
  requireAdmin,
  requireAuth,
  requireRole,
  verifyAndGetUser,
} from "../../middleware/auth";
import { generateJWT } from "../../services/auth.service";

// Mock cache module (avoid hoisting issues)
const hoisted = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
}));
vi.mock("../../cache/redis", () => ({
  cache: {
    getSession: hoisted.mockGetSession,
    get: hoisted.mockCacheGet,
    set: hoisted.mockCacheSet,
  },
}));

describe("Auth Middleware", () => {
  const mockUserId = "550e8400-e29b-41d4-a716-446655440000";
  const mockSessionId = "660e8400-e29b-41d4-a716-446655440001";
  const mockCompanyId = "770e8400-e29b-41d4-a716-446655440002";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // JWT Extraction Tests
  // ============================================

  describe("extractJWT", () => {
    it("should extract JWT from Authorization Bearer header", () => {
      const request = new Request("http://localhost", {
        headers: { Authorization: "Bearer test-token-123" },
      });

      const token = extractJWT(request);
      expect(token).toBe("test-token-123");
    });

    it("should extract JWT from cookie", () => {
      const request = new Request("http://localhost", {
        headers: { Cookie: "access_token=cookie-token-456; other=value" },
      });

      const token = extractJWT(request);
      expect(token).toBe("cookie-token-456");
    });

    it("should prefer Authorization header over cookie", () => {
      const request = new Request("http://localhost", {
        headers: {
          Authorization: "Bearer header-token",
          Cookie: "access_token=cookie-token",
        },
      });

      const token = extractJWT(request);
      expect(token).toBe("header-token");
    });

    it("should return null when no token present", () => {
      const request = new Request("http://localhost");

      const token = extractJWT(request);
      expect(token).toBeNull();
    });

    it("should return null for invalid Authorization header format", () => {
      const request = new Request("http://localhost", {
        headers: { Authorization: "Basic test-token" },
      });

      const token = extractJWT(request);
      expect(token).toBeNull();
    });

    it("should handle cookie with equals signs in value", () => {
      const request = new Request("http://localhost", {
        headers: { Cookie: "access_token=token=with=equals" },
      });

      const token = extractJWT(request);
      expect(token).toBe("token=with=equals");
    });

    it("should handle multiple cookies", () => {
      const request = new Request("http://localhost", {
        headers: { Cookie: "session=abc; access_token=my-token; user=john" },
      });

      const token = extractJWT(request);
      expect(token).toBe("my-token");
    });

    it("should handle empty Authorization header after Bearer", () => {
      const request = new Request("http://localhost", {
        headers: { Authorization: "Bearer " },
      });

      const token = extractJWT(request);
      // Returns null when token is missing, even if "Bearer " prefix is present
      expect(token).toBeNull();
    });
  });

  // ============================================
  // User Verification Tests
  // ============================================

  describe("verifyAndGetUser", () => {
    it("should return null when no token provided", async () => {
      const request = new Request("http://localhost");

      const auth = await verifyAndGetUser(request);
      expect(auth).toBeNull();
    });

    it("should return null when token is invalid", async () => {
      const request = new Request("http://localhost", {
        headers: { Authorization: "Bearer invalid-token" },
      });

      const auth = await verifyAndGetUser(request);
      expect(auth).toBeNull();
    });

    it("should return null when session does not exist in Redis", async () => {
      const token = await generateJWT(mockUserId, "admin", mockCompanyId, mockSessionId);
      const request = new Request("http://localhost", {
        headers: { Authorization: `Bearer ${token}` },
      });

      hoisted.mockGetSession.mockResolvedValue(null);

      const auth = await verifyAndGetUser(request);
      expect(auth).toBeNull();
      expect(hoisted.mockGetSession).toHaveBeenCalledWith(mockSessionId);
    });

    it("should return auth context when token and session are valid", async () => {
      const token = await generateJWT(mockUserId, "admin", mockCompanyId, mockSessionId);
      const request = new Request("http://localhost", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const sessionData = {
        userId: mockUserId,
        userRole: "admin" as const,
        companyId: mockCompanyId,
        email: "admin@example.com",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      hoisted.mockGetSession.mockResolvedValue(sessionData);

      const auth = await verifyAndGetUser(request);
      expect(auth).not.toBeNull();
      expect(auth?.userId).toBe(mockUserId);
      expect(auth?.role).toBe("admin");
      expect(auth?.companyId).toBe(mockCompanyId);
      expect(auth?.sessionId).toBe(mockSessionId);
    });

    it("should handle user without company", async () => {
      const token = await generateJWT(mockUserId, "user", undefined, mockSessionId);
      const request = new Request("http://localhost", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const sessionData = {
        userId: mockUserId,
        userRole: "user" as const,
        email: "user@example.com",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      hoisted.mockGetSession.mockResolvedValue(sessionData);

      const auth = await verifyAndGetUser(request);
      expect(auth).not.toBeNull();
      expect(auth?.companyId).toBeUndefined();
    });
  });

  // ============================================
  // Middleware Functions Tests
  // ============================================

  describe("requireAuth", () => {
    const mockHandler = vi.fn(async () => new Response("success"));
    const mockUrl = new URL("http://localhost/api/test");
    const mockParams = {};

    it("should call handler when authenticated", async () => {
      const token = await generateJWT(mockUserId, "admin", mockCompanyId, mockSessionId);
      const request = new Request("http://localhost", {
        headers: { Authorization: `Bearer ${token}` },
      });

      hoisted.mockGetSession.mockResolvedValue({
        userId: mockUserId,
        userRole: "admin",
        email: "admin@example.com",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const handler = requireAuth(mockHandler);
      const response = await handler(request, mockUrl, mockParams);

      expect(mockHandler).toHaveBeenCalled();
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe("success");
    });

    it("should return 401 when not authenticated", async () => {
      const request = new Request("http://localhost");

      const handler = requireAuth(mockHandler);
      const response = await handler(request, mockUrl, mockParams);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(response.status).toBe(401);

      const data: any = await response.json();
      expect(data.error.code).toBe("UNAUTHORIZED");
      expect(response.headers.get("WWW-Authenticate")).toContain("Bearer");
    });

    it("should return 401 when session is expired", async () => {
      const token = await generateJWT(mockUserId, "admin", mockCompanyId, mockSessionId);
      const request = new Request("http://localhost", {
        headers: { Authorization: `Bearer ${token}` },
      });

      hoisted.mockGetSession.mockResolvedValue(null);

      const handler = requireAuth(mockHandler);
      const response = await handler(request, mockUrl, mockParams);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(response.status).toBe(401);
    });
  });

  describe("requireRole", () => {
    const mockHandler = vi.fn(async () => new Response("success"));
    const mockUrl = new URL("http://localhost/api/test");
    const mockParams = {};

    it("should allow user with correct role", async () => {
      const token = await generateJWT(mockUserId, "user", mockCompanyId, mockSessionId);
      const request = new Request("http://localhost", {
        headers: { Authorization: `Bearer ${token}` },
      });

      hoisted.mockGetSession.mockResolvedValue({
        userId: mockUserId,
        userRole: "user",
        companyId: mockCompanyId,
        email: "user@example.com",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const handler = requireRole("user", mockHandler);
      const response = await handler(request, mockUrl, mockParams);

      expect(mockHandler).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it("should allow superadmin to access any role", async () => {
      const token = await generateJWT(mockUserId, "superadmin", mockCompanyId, mockSessionId);
      const request = new Request("http://localhost", {
        headers: { Authorization: `Bearer ${token}` },
      });

      hoisted.mockGetSession.mockResolvedValue({
        userId: mockUserId,
        userRole: "superadmin",
        companyId: mockCompanyId,
        email: "admin@example.com",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const handler = requireRole("user", mockHandler);
      const response = await handler(request, mockUrl, mockParams);

      expect(mockHandler).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it("should return 403 when role does not match", async () => {
      const token = await generateJWT(mockUserId, "user", mockCompanyId, mockSessionId);
      const request = new Request("http://localhost", {
        headers: { Authorization: `Bearer ${token}` },
      });

      hoisted.mockGetSession.mockResolvedValue({
        userId: mockUserId,
        userRole: "user",
        companyId: mockCompanyId,
        email: "user@example.com",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const handler = requireRole("admin", mockHandler);
      const response = await handler(request, mockUrl, mockParams);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(response.status).toBe(403);

      const data: any = await response.json();
      expect(data.error.code).toBe("FORBIDDEN");
    });

    it("should return 401 when not authenticated", async () => {
      const request = new Request("http://localhost");

      const handler = requireRole("user", mockHandler);
      const response = await handler(request, mockUrl, mockParams);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(response.status).toBe(401);
    });
  });

  describe("requireAdmin", () => {
    const mockHandler = vi.fn(async () => new Response("success"));
    const mockUrl = new URL("http://localhost/api/test");
    const mockParams = {};

    it("should allow superadmin user", async () => {
      const token = await generateJWT(mockUserId, "superadmin", mockCompanyId, mockSessionId);
      const request = new Request("http://localhost", {
        headers: { Authorization: `Bearer ${token}` },
      });

      hoisted.mockGetSession.mockResolvedValue({
        userId: mockUserId,
        userRole: "superadmin",
        companyId: mockCompanyId,
        email: "admin@example.com",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const handler = requireAdmin(mockHandler);
      const response = await handler(request, mockUrl, mockParams);

      expect(mockHandler).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it("should return 403 for non-superadmin user", async () => {
      const token = await generateJWT(mockUserId, "user", mockCompanyId, mockSessionId);
      const request = new Request("http://localhost", {
        headers: { Authorization: `Bearer ${token}` },
      });

      hoisted.mockGetSession.mockResolvedValue({
        userId: mockUserId,
        userRole: "user",
        companyId: mockCompanyId,
        email: "user@example.com",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const handler = requireAdmin(mockHandler);
      const response = await handler(request, mockUrl, mockParams);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(response.status).toBe(403);

      const data: any = await response.json();
      expect(data.error.code).toBe("FORBIDDEN");
      expect(data.error.message).toContain("Superadmin");
    });

    it("should return 401 when not authenticated", async () => {
      const request = new Request("http://localhost");

      const handler = requireAdmin(mockHandler);
      const response = await handler(request, mockUrl, mockParams);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(response.status).toBe(401);
    });
  });

  describe("optionalAuth", () => {
    const mockHandler = vi.fn(async () => new Response("success"));
    const mockUrl = new URL("http://localhost/api/test");
    const mockParams = {};

    it("should attach auth when authenticated", async () => {
      const token = await generateJWT(mockUserId, "user", mockCompanyId, mockSessionId);
      const request = new Request("http://localhost", {
        headers: { Authorization: `Bearer ${token}` },
      });

      hoisted.mockGetSession.mockResolvedValue({
        userId: mockUserId,
        userRole: "user",
        companyId: mockCompanyId,
        email: "user@example.com",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const handler = optionalAuth(mockHandler);
      await handler(request, mockUrl, mockParams);

      expect(mockHandler).toHaveBeenCalledWith(
        request,
        mockUrl,
        mockParams,
        expect.objectContaining({ userId: mockUserId })
      );
    });

    it("should call handler without auth when not authenticated", async () => {
      const request = new Request("http://localhost");

      const handler = optionalAuth(mockHandler);
      await handler(request, mockUrl, mockParams);

      expect(mockHandler).toHaveBeenCalledWith(request, mockUrl, mockParams, undefined);
    });

    it("should always return 200 regardless of auth status", async () => {
      const request = new Request("http://localhost");

      const handler = optionalAuth(mockHandler);
      const response = await handler(request, mockUrl, mockParams);

      expect(response.status).toBe(200);
    });
  });

  // ============================================
  // Role Check Helpers Tests
  // ============================================

  describe("Role Check Helpers", () => {
    const adminAuth: AuthContext = {
      userId: mockUserId,
      role: "superadmin",
      tenantRoles: [],
      companyId: mockCompanyId,
      sessionId: mockSessionId,
    };

    const userAuth: AuthContext = {
      userId: mockUserId,
      role: "user",
      tenantRoles: [],
      companyId: mockCompanyId,
      sessionId: mockSessionId,
    };

    describe("isAdmin", () => {
      it("should return true for admin", () => {
        expect(isAdmin(adminAuth)).toBe(true);
      });

      it("should return false for non-admin", () => {
        expect(isAdmin(userAuth)).toBe(false);
      });
    });

    describe("isUser", () => {
      it("should return true for user", () => {
        expect(isUser(userAuth)).toBe(true);
      });

      it("should return false for admin", () => {
        expect(isUser(adminAuth)).toBe(false);
      });
    });

    describe("canAccessCompany", () => {
      it("should allow admin to access any company", async () => {
        await expect(canAccessCompany(adminAuth, "any-company-id")).resolves.toBe(true);
        await expect(canAccessCompany(adminAuth, "different-company")).resolves.toBe(true);
      });

      it("should allow user to access their own company", async () => {
        hoisted.mockCacheGet.mockResolvedValue(true);
        await expect(canAccessCompany(userAuth, mockCompanyId)).resolves.toBe(true);
      });

      it("should deny user access to other company", async () => {
        hoisted.mockCacheGet.mockResolvedValue(false);
        await expect(canAccessCompany(userAuth, "different-company")).resolves.toBe(false);
      });

      it("should handle user without company", async () => {
        const noCompanyAuth: AuthContext = {
          userId: mockUserId,
          role: "user",
          tenantRoles: [],
          sessionId: mockSessionId,
        };
        hoisted.mockCacheGet.mockResolvedValue(false);
        await expect(canAccessCompany(noCompanyAuth, mockCompanyId)).resolves.toBe(false);
      });
    });

    describe("canAccessUser", () => {
      it("should allow superadmin to access any user", () => {
        expect(canAccessUser(adminAuth, "any-user-id")).toBe(true);
        expect(canAccessUser(adminAuth, "different-user")).toBe(true);
      });

      it("should allow user to access themselves", () => {
        expect(canAccessUser(userAuth, mockUserId)).toBe(true);
      });

      it("should deny user access to other users", () => {
        expect(canAccessUser(userAuth, "different-user-id")).toBe(false);
      });
    });
  });
});
