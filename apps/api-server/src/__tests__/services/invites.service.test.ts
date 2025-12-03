import { describe, it, expect, beforeEach, vi } from "vitest";
import { invitesService } from "../../services/invites.service";
import { inviteQueries } from "../../db/queries/invites";
import { userQueries } from "../../db/queries/users";
import { companyQueries } from "../../db/queries/companies";
import { emailService } from "../../services/email.service";
import { sql as db } from "../../db/client";

vi.mock("../../db/queries/invites");
vi.mock("../../db/queries/users");
vi.mock("../../db/queries/companies");
vi.mock("../../services/email.service");
vi.mock("../../db/client", () => ({
	sql: vi.fn(),
}));

describe("InvitesService", () => {
	const mockCompanyId = "company-123";
	const mockUserId = "user-123";

	const mockInvite = {
		id: "invite-123",
		email: "test@example.com",
		companyId: mockCompanyId,
		role: "member" as const,
		status: "pending" as const,
		invitedBy: mockUserId,
		token: "test-token",
		expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
		acceptedAt: null,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getInvites", () => {
		it("should return list of invites", async () => {
			vi.mocked(inviteQueries.findPendingByCompany).mockResolvedValue([
				mockInvite,
			]);

			const result = await invitesService.getInvites(mockCompanyId);

			expect(result.success).toBe(true);
			expect(result.data).toBeDefined();
			expect(Array.isArray(result.data)).toBe(true);
			expect(result.data![0]).toMatchObject({
				id: mockInvite.id,
				email: mockInvite.email,
				role: mockInvite.role,
			});
		});

		it("should handle database errors", async () => {
			vi.mocked(inviteQueries.findPendingByCompany).mockRejectedValue(
				new Error("DB Error"),
			);

			const result = await invitesService.getInvites(mockCompanyId);

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe("DATABASE_ERROR");
		});
	});

	describe("createInvite", () => {
		it("should create a new invite", async () => {
			const company = {
				id: mockCompanyId,
				name: "Test Company",
			};
			vi.mocked(companyQueries.findById).mockResolvedValue(company as any);
			vi.mocked(userQueries.findByEmail).mockResolvedValue(null);
			vi.mocked(inviteQueries.findByEmailAndCompany).mockResolvedValue(null);
			vi.mocked(inviteQueries.create).mockResolvedValue(mockInvite);
			vi.mocked(emailService.sendInviteEmail).mockResolvedValue(undefined);

			const result = await invitesService.createInvite(
				mockCompanyId,
				{
					email: "test@example.com",
					role: "member",
				},
				mockUserId,
			);

			expect(result.success).toBe(true);
			expect(result.data).toBeDefined();
			expect(inviteQueries.create).toHaveBeenCalled();
			expect(emailService.sendInviteEmail).toHaveBeenCalled();
		});

		it("should validate email format", async () => {
			const result = await invitesService.createInvite(
				mockCompanyId,
				{
					email: "invalid-email",
					role: "member",
				},
				mockUserId,
			);

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe("VALIDATION_ERROR");
		});

		it("should reject if company not found", async () => {
			vi.mocked(companyQueries.findById).mockResolvedValue(null);

			const result = await invitesService.createInvite(
				mockCompanyId,
				{
					email: "test@example.com",
					role: "member",
				},
				mockUserId,
			);

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe("NOT_FOUND");
		});

		it("should reject if user already member", async () => {
			const company = {
				id: mockCompanyId,
				name: "Test Company",
			};
			const existingUser = {
				id: "existing-user",
				email: "test@example.com",
			};
			vi.mocked(companyQueries.findById).mockResolvedValue(company as any);
			vi.mocked(userQueries.findByEmail).mockResolvedValue(existingUser as any);
			vi.mocked(db).mockResolvedValue([
				{ user_id: existingUser.id, company_id: mockCompanyId },
			] as any);

			const result = await invitesService.createInvite(
				mockCompanyId,
				{
					email: "test@example.com",
					role: "member",
				},
				mockUserId,
			);

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe("CONFLICT");
		});

		it("should reject if invite already pending", async () => {
			const company = {
				id: mockCompanyId,
				name: "Test Company",
			};
			vi.mocked(companyQueries.findById).mockResolvedValue(company as any);
			vi.mocked(userQueries.findByEmail).mockResolvedValue(null);
			vi.mocked(inviteQueries.findByEmailAndCompany).mockResolvedValue(
				mockInvite,
			);

			const result = await invitesService.createInvite(
				mockCompanyId,
				{
					email: "test@example.com",
					role: "member",
				},
				mockUserId,
			);

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe("CONFLICT");
		});
	});

	describe("deleteInvite", () => {
		it("should delete an invite", async () => {
			vi.mocked(inviteQueries.findById).mockResolvedValue(mockInvite);
			vi.mocked(inviteQueries.delete).mockResolvedValue(undefined);

			const result = await invitesService.deleteInvite(
				mockInvite.id,
				mockCompanyId,
			);

			expect(result.success).toBe(true);
			expect(inviteQueries.delete).toHaveBeenCalledWith(mockInvite.id);
		});

		it("should return 404 if invite not found", async () => {
			vi.mocked(inviteQueries.findById).mockResolvedValue(null);

			const result = await invitesService.deleteInvite(
				"invalid-id",
				mockCompanyId,
			);

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe("NOT_FOUND");
		});

		it("should reject if invite belongs to different company", async () => {
			const otherCompanyInvite = { ...mockInvite, companyId: "other-company" };
			vi.mocked(inviteQueries.findById).mockResolvedValue(otherCompanyInvite);

			const result = await invitesService.deleteInvite(
				mockInvite.id,
				mockCompanyId,
			);

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe("FORBIDDEN");
		});
	});

	describe("acceptInvite", () => {
		it("should accept an invite", async () => {
			const user = {
				id: mockUserId,
				email: mockInvite.email,
			};
			vi.mocked(inviteQueries.findByToken).mockResolvedValue(mockInvite);
			vi.mocked(userQueries.findById).mockResolvedValue(user as any);
			vi.mocked(inviteQueries.updateStatus).mockResolvedValue({
				...mockInvite,
				status: "accepted" as const,
			});
			vi.mocked(db).mockResolvedValue([] as any);

			const result = await invitesService.acceptInvite(
				"test-token",
				mockUserId,
			);

			expect(result.success).toBe(true);
			expect(inviteQueries.updateStatus).toHaveBeenCalled();
		});

		it("should return 404 if token invalid", async () => {
			vi.mocked(inviteQueries.findByToken).mockResolvedValue(null);

			const result = await invitesService.acceptInvite(
				"invalid-token",
				mockUserId,
			);

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe("NOT_FOUND");
		});

		it("should reject if invite already accepted", async () => {
			const acceptedInvite = { ...mockInvite, status: "accepted" as const };
			vi.mocked(inviteQueries.findByToken).mockResolvedValue(acceptedInvite);

			const result = await invitesService.acceptInvite(
				"test-token",
				mockUserId,
			);

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe("CONFLICT");
		});

		it("should reject if email doesn't match", async () => {
			const user = {
				id: mockUserId,
				email: "different@example.com",
			};
			vi.mocked(inviteQueries.findByToken).mockResolvedValue(mockInvite);
			vi.mocked(userQueries.findById).mockResolvedValue(user as any);

			const result = await invitesService.acceptInvite(
				"test-token",
				mockUserId,
			);

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe("FORBIDDEN");
		});
	});
});

