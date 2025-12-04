import { describe, it, expect, beforeEach, vi } from "vitest";
import { connectedAccountRoutes } from "../../routes/connected-accounts";
import { connectedAccountQueries } from "../../db/queries/connected-accounts";
import { userQueries } from "../../db/queries/users";
import * as authMiddleware from "../../middleware/auth";

vi.mock("../../db/queries/connected-accounts");
vi.mock("../../db/queries/users");
vi.mock("../../middleware/auth");

describe("Connected Accounts Routes", () => {
	const mockAuth = {
		userId: "user-123",
		role: "admin" as const,
		sessionId: "session-123",
	};

	const mockCompanyId = "company-123";

	const mockAccount = {
		id: "account-123",
		companyId: mockCompanyId,
		accountType: "bank",
		accountName: "Main Account",
		accountNumber: "123456",
		bankName: "Test Bank",
		iban: "GB82WEST12345698765432",
		swift: "WESTGB22",
		currency: "EUR",
		balance: 50000,
		isActive: true,
		connectedBy: mockAuth.userId,
		connectedAt: new Date().toISOString(),
		lastSyncedAt: null,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(authMiddleware.verifyAndGetUser).mockResolvedValue(mockAuth);
		vi.mocked(userQueries.getUserCompanyId).mockResolvedValue(mockCompanyId);
	});

	const callRoute = async (
		path: string,
		method = "GET",
		options: RequestInit = {},
	): Promise<Response> => {
		const url = new URL(`http://localhost${path}`);
		const request = new Request(url.toString(), { method, ...options });

		const route = connectedAccountRoutes.find(
			(r) => r.method === method && r.pattern.test(path),
		);

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

	describe("GET /api/v1/connected-accounts", () => {
		it("should return list of connected accounts for current company", async () => {
			vi.mocked(connectedAccountQueries.findByCompany).mockResolvedValue([
				mockAccount,
			]);

			const response = await callRoute("/api/v1/connected-accounts");
			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(Array.isArray(data.data)).toBe(true);
			expect(data.data[0]).toMatchObject({
				id: mockAccount.id,
				accountName: mockAccount.accountName,
			});
			expect(connectedAccountQueries.findByCompany).toHaveBeenCalledWith(
				mockCompanyId,
			);
		});

		it("should return 404 if user has no active company", async () => {
			vi.mocked(userQueries.getUserCompanyId).mockResolvedValue(null);

			const response = await callRoute("/api/v1/connected-accounts");
			const data: any = await response.json();

			expect(response.status).toBe(404);
			expect(data.error.code).toBe("NOT_FOUND");
		});

		it("should require authentication", async () => {
			vi.mocked(authMiddleware.verifyAndGetUser).mockResolvedValue(null);

			const response = await callRoute("/api/v1/connected-accounts");
			const data: any = await response.json();

			expect(response.status).toBe(401);
			expect(data.error.code).toBe("UNAUTHORIZED");
		});
	});
});
