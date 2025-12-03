import { describe, it, expect, beforeEach, vi } from "vitest";
import { notificationSettingsService } from "../../services/notification-settings.service";
import { notificationSettingsQueries } from "../../db/queries/notification-settings";

vi.mock("../../db/queries/notification-settings");

describe("NotificationSettingsService", () => {
	const mockUserId = "user-123";

	const mockSettings = [
		{
			id: "setting-1",
			userId: mockUserId,
			notificationType: "invoice.created",
			channel: "email" as const,
			enabled: true,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		},
		{
			id: "setting-2",
			userId: mockUserId,
			notificationType: "invoice.created",
			channel: "in_app" as const,
			enabled: false,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		},
	];

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getSettings", () => {
		it("should return user notification settings", async () => {
			vi.mocked(notificationSettingsQueries.findByUserId).mockResolvedValue(
				mockSettings,
			);

			const result = await notificationSettingsService.getSettings(mockUserId);

			expect(result.success).toBe(true);
			expect(result.data).toBeDefined();
			expect(Array.isArray(result.data)).toBe(true);
			expect(result.data!.length).toBe(2);
			expect(notificationSettingsQueries.findByUserId).toHaveBeenCalledWith(
				mockUserId,
			);
		});

		it("should handle database errors", async () => {
			vi.mocked(notificationSettingsQueries.findByUserId).mockRejectedValue(
				new Error("DB Error"),
			);

			const result = await notificationSettingsService.getSettings(mockUserId);

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe("DATABASE_ERROR");
		});
	});

	describe("updateSetting", () => {
		it("should update notification setting", async () => {
			const updatedSetting = {
				...mockSettings[0],
				enabled: false,
			};
			vi.mocked(notificationSettingsQueries.upsert).mockResolvedValue(
				updatedSetting,
			);

			const result = await notificationSettingsService.updateSetting(
				mockUserId,
				{
					notificationType: "invoice.created",
					channel: "email",
					enabled: false,
				},
			);

			expect(result.success).toBe(true);
			expect(result.data).toBeDefined();
			expect(result.data!.enabled).toBe(false);
			expect(notificationSettingsQueries.upsert).toHaveBeenCalledWith({
				userId: mockUserId,
				notificationType: "invoice.created",
				channel: "email",
				enabled: false,
			});
		});

		it("should handle database errors", async () => {
			vi.mocked(notificationSettingsQueries.upsert).mockRejectedValue(
				new Error("DB Error"),
			);

			const result = await notificationSettingsService.updateSetting(
				mockUserId,
				{
					notificationType: "invoice.created",
					channel: "email",
					enabled: true,
				},
			);

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe("DATABASE_ERROR");
		});
	});
});

