import { describe, it, expect, beforeEach, vi } from "vitest";
import { notificationRoutes } from "../../routes/notifications-routes";
import { notificationSettingsQueries } from "../../db/queries/notification-settings";
import * as authMiddleware from "../../middleware/auth";

vi.mock("../../db/queries/notification-settings");
vi.mock("../../middleware/auth");

describe("Notification Settings Routes", () => {
	const mockAuth = {
		userId: "user-123",
		role: "admin" as const,
		sessionId: "session-123",
	};

	const mockSettings = [
		{
			id: "setting-1",
			userId: mockAuth.userId,
			notificationType: "invoice.created",
			channel: "email" as const,
			enabled: true,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		},
	];

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(authMiddleware.verifyAndGetUser).mockResolvedValue(mockAuth);
	});

	const callRoute = async (
		path: string,
		method = "GET",
		options: RequestInit = {},
	): Promise<Response> => {
		const url = new URL(`http://localhost${path}`);
		const request = new Request(url.toString(), { method, ...options });

		const route = notificationRoutes.find(
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

	describe("GET /api/v1/notification-settings", () => {
		it("should return user notification settings", async () => {
			vi.mocked(notificationSettingsQueries.findByUserId).mockResolvedValue(
				mockSettings,
			);

			const response = await callRoute("/api/v1/notification-settings");
			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(Array.isArray(data.data)).toBe(true);
			expect(notificationSettingsQueries.findByUserId).toHaveBeenCalledWith(
				mockAuth.userId,
			);
		});

		it("should require authentication", async () => {
			vi.mocked(authMiddleware.verifyAndGetUser).mockResolvedValue(null);

			const response = await callRoute("/api/v1/notification-settings");
			const data: any = await response.json();

			expect(response.status).toBe(401);
			expect(data.error.code).toBe("UNAUTHORIZED");
		});
	});

	describe("PATCH /api/v1/notification-settings", () => {
		it("should update notification setting", async () => {
			const updatedSetting = {
				...mockSettings[0],
				enabled: false,
			};
			vi.mocked(notificationSettingsQueries.upsert).mockResolvedValue(
				updatedSetting,
			);

			const response = await callRoute(
				"/api/v1/notification-settings",
				"PATCH",
				{
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						notificationType: "invoice.created",
						channel: "email",
						enabled: false,
					}),
				},
			);
			const data: any = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.data.enabled).toBe(false);
			expect(notificationSettingsQueries.upsert).toHaveBeenCalled();
		});

		it("should validate required fields", async () => {
			const response = await callRoute(
				"/api/v1/notification-settings",
				"PATCH",
				{
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						notificationType: "invoice.created",
						// missing channel and enabled
					}),
				},
			);
            const data: any = await response.json();

			expect(response.status).toBe(400);
			expect(data.error.code).toBe("VALIDATION_ERROR");
		});
	});
});
