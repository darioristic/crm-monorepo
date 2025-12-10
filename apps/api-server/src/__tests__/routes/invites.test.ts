import { beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "../../db/client";
import { companyQueries } from "../../db/queries/companies";
import { inviteQueries } from "../../db/queries/invites";
import { userQueries } from "../../db/queries/users";
import * as authMiddleware from "../../middleware/auth";
import { inviteRoutes } from "../../routes/invites";
import { emailService } from "../../services/email.service";

// Mock dependencies
vi.mock("../../db/queries/invites");
vi.mock("../../db/queries/users");
vi.mock("../../db/queries/companies");
vi.mock("../../services/email.service");
vi.mock("../../middleware/auth");
vi.mock("../../db/client", () => ({
  sql: vi.fn(),
}));

describe("Invite Routes", () => {
  const mockAuth = {
    userId: "user-123",
    role: "admin" as const,
    tenantRoles: [],
    sessionId: "session-123",
  };

  const mockCompanyId = "company-123";

  const mockInvite = {
    id: "invite-123",
    email: "test@example.com",
    companyId: mockCompanyId,
    role: "member" as const,
    status: "pending" as const,
    invitedBy: "user-123",
    token: "test-token-123",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    acceptedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authMiddleware.verifyAndGetUser).mockResolvedValue(mockAuth);
    vi.mocked(userQueries.getUserCompanyId).mockResolvedValue(mockCompanyId);
  });

  // Helper to call route
  const callRoute = async (
    path: string,
    method = "GET",
    options: RequestInit = {}
  ): Promise<Response> => {
    const url = new URL(`http://localhost${path}`);
    const request = new Request(url.toString(), { method, ...options });

    const route = inviteRoutes.find((r) => r.method === method && r.pattern.test(path));

    if (!route) {
      throw new Error(`No route found for ${method} ${path}`);
    }

    const match = path.match(route.pattern);
    const params: Record<string, string> = {};
    if (match && route.params.length > 0) {
      route.params.forEach((param, index) => {
        params[param] = match[index + 1];
      });
    }

    return route.handler(request, url, params);
  };

  describe("GET /api/v1/invites", () => {
    it("should return list of invites for current company", async () => {
      vi.mocked(inviteQueries.findPendingByCompany).mockResolvedValue([mockInvite]);

      const response = await callRoute("/api/v1/invites");
      const data: any = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data[0]).toMatchObject({
        id: mockInvite.id,
        email: mockInvite.email,
        role: mockInvite.role,
      });
      expect(inviteQueries.findPendingByCompany).toHaveBeenCalledWith(mockCompanyId);
    });

    it("should return 404 if user has no active company", async () => {
      vi.mocked(userQueries.getUserCompanyId).mockResolvedValue(null);

      const response = await callRoute("/api/v1/invites");
      const data: any = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("NOT_FOUND");
    });

    it("should require authentication", async () => {
      vi.mocked(authMiddleware.verifyAndGetUser).mockResolvedValue(null);

      const response = await callRoute("/api/v1/invites");
      const data: any = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("POST /api/v1/invites", () => {
    it("should create a new invite", async () => {
      vi.mocked(companyQueries.findById).mockResolvedValue({
        id: mockCompanyId,
        name: "Test Company",
      } as any);
      vi.mocked(userQueries.findByEmail).mockResolvedValue(null);
      vi.mocked(inviteQueries.findByEmailAndCompany).mockResolvedValue(null);
      vi.mocked(inviteQueries.create).mockResolvedValue(mockInvite);
      vi.mocked(emailService.sendInviteEmail).mockResolvedValue(undefined);

      const response = await callRoute("/api/v1/invites", "POST", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          role: "member",
        }),
      });
      const data: any = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.email).toBe("test@example.com");
      expect(inviteQueries.create).toHaveBeenCalled();
      expect(emailService.sendInviteEmail).toHaveBeenCalled();
    });

    it("should validate required fields", async () => {
      const response = await callRoute("/api/v1/invites", "POST", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          // missing role
        }),
      });
      const data: any = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("should reject duplicate invite", async () => {
      vi.mocked(companyQueries.findById).mockResolvedValue({
        id: mockCompanyId,
        name: "Test Company",
      } as any);
      vi.mocked(userQueries.findByEmail).mockResolvedValue(null);
      vi.mocked(inviteQueries.findByEmailAndCompany).mockResolvedValue(mockInvite);

      const response = await callRoute("/api/v1/invites", "POST", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          role: "member",
        }),
      });
      const data: any = await response.json();

      expect(response.status).toBe(409);
      expect(data.error.code).toBe("CONFLICT");
    });

    it("should reject if user already member", async () => {
      const existingUser = {
        id: "existing-user",
        email: "test@example.com",
      };
      vi.mocked(companyQueries.findById).mockResolvedValue({
        id: mockCompanyId,
        name: "Test Company",
      } as any);
      vi.mocked(userQueries.findByEmail).mockResolvedValue(existingUser as any);
      // Mock the db template literal call
      const mockDb = vi
        .fn()
        .mockResolvedValue([{ user_id: existingUser.id, company_id: mockCompanyId }]);
      vi.mocked(sql).mockImplementation(mockDb as any);

      const response = await callRoute("/api/v1/invites", "POST", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          role: "member",
        }),
      });
      const data: any = await response.json();

      expect(response.status).toBe(409);
      expect(data.error.code).toBe("CONFLICT");
    });
  });

  describe("DELETE /api/v1/invites/:id", () => {
    it("should delete an invite", async () => {
      vi.mocked(inviteQueries.findById).mockResolvedValue(mockInvite);
      vi.mocked(inviteQueries.delete).mockResolvedValue(undefined);

      const response = await callRoute("/api/v1/invites/invite-123", "DELETE");
      const data: any = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(inviteQueries.delete).toHaveBeenCalledWith("invite-123");
    });

    it("should return 404 if invite not found", async () => {
      vi.mocked(inviteQueries.findById).mockResolvedValue(null);

      const response = await callRoute("/api/v1/invites/invalid-id", "DELETE");
      const data: any = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.code).toBe("NOT_FOUND");
    });

    it("should reject if invite belongs to different company", async () => {
      const otherCompanyInvite = { ...mockInvite, companyId: "other-company" };
      vi.mocked(inviteQueries.findById).mockResolvedValue(otherCompanyInvite);

      const response = await callRoute("/api/v1/invites/invite-123", "DELETE");
      const data: any = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.code).toBe("FORBIDDEN");
    });
  });

  describe("POST /api/v1/invites/accept/:token", () => {
    it("should accept an invite", async () => {
      const user = {
        id: mockAuth.userId,
        email: mockInvite.email,
      };
      vi.mocked(inviteQueries.findByToken).mockResolvedValue(mockInvite);
      vi.mocked(userQueries.findById).mockResolvedValue(user as any);
      vi.mocked(inviteQueries.updateStatus).mockResolvedValue({
        ...mockInvite,
        status: "accepted" as const,
      });
      // Mock the db template literal call for INSERT
      const mockDb = vi.fn().mockResolvedValue([]);
      vi.mocked(sql).mockImplementation(mockDb as any);

      const response = await callRoute("/api/v1/invites/accept/test-token-123", "POST");
      const data: any = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("should return 404 if token invalid", async () => {
      vi.mocked(inviteQueries.findByToken).mockResolvedValue(null);

      const response = await callRoute("/api/v1/invites/accept/invalid-token", "POST");
      const data: any = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.code).toBe("NOT_FOUND");
    });

    it("should reject if invite already accepted", async () => {
      const acceptedInvite = { ...mockInvite, status: "accepted" as const };
      vi.mocked(inviteQueries.findByToken).mockResolvedValue(acceptedInvite);

      const response = await callRoute("/api/v1/invites/accept/test-token-123", "POST");
      const data: any = await response.json();

      expect(response.status).toBe(409);
      expect(data.error.code).toBe("CONFLICT");
    });
  });
});
