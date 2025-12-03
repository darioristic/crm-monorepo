import { describe, it, expect, beforeEach, vi } from "vitest";
import { orderRoutes } from "../../routes/orders";
import { orderQueries } from "../../db/queries/orders";
import { userQueries } from "../../db/queries/users";
import * as authMiddleware from "../../middleware/auth";

vi.mock("../../db/queries/orders");
vi.mock("../../db/queries/users");
vi.mock("../../middleware/auth");

describe("Orders Routes", () => {
	const mockAuth = {
		userId: "user-123",
		role: "admin" as const,
	};

	const mockCompanyId = "company-123";

	const mockOrder = {
		id: "order-123",
		orderNumber: "ORD-001",
		companyId: mockCompanyId,
		contactId: null,
		quoteId: null,
		invoiceId: null,
		status: "pending" as const,
		subtotal: 1000,
		tax: 200,
		total: 1200,
		currency: "EUR",
		notes: null,
		createdBy: mockAuth.userId,
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
		const request = new Request(url, { method, ...options });

		const route = orderRoutes.find(
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

	describe("GET /api/v1/orders", () => {
		it("should return list of orders for current company", async () => {
			vi.mocked(orderQueries.findByCompany).mockResolvedValue([mockOrder]);

			const response = await callRoute("/api/v1/orders");
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(Array.isArray(data.data)).toBe(true);
			expect(data.data[0]).toMatchObject({
				id: mockOrder.id,
				orderNumber: mockOrder.orderNumber,
			});
			expect(orderQueries.findByCompany).toHaveBeenCalledWith(mockCompanyId);
		});

		it("should return 404 if user has no active company", async () => {
			vi.mocked(userQueries.getUserCompanyId).mockResolvedValue(null);

			const response = await callRoute("/api/v1/orders");
			const data = await response.json();

			expect(response.status).toBe(404);
			expect(data.error.code).toBe("NOT_FOUND");
		});

		it("should require authentication", async () => {
			vi.mocked(authMiddleware.verifyAndGetUser).mockResolvedValue(null);

			const response = await callRoute("/api/v1/orders");
			const data = await response.json();

			expect(response.status).toBe(401);
			expect(data.error.code).toBe("UNAUTHORIZED");
		});
	});
});

