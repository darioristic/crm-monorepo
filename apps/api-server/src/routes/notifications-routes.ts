/**
 * Notification Routes
 */

import { errorResponse } from "@crm/utils";
import { notificationsService } from "../services/notifications.service";
import { RouteBuilder, withAuth, parseBody, parsePagination } from "./helpers";
import type { NotificationType, CreateNotificationRequest } from "@crm/types";

const router = new RouteBuilder();

// ============================================
// List Notifications (for current user)
// ============================================

router.get("/api/v1/notifications", async (request, url) => {
	return withAuth(request, async (auth) => {
		try {
			// Validate auth context
			if (!auth || !auth.userId) {
				return errorResponse("UNAUTHORIZED", "Invalid authentication context");
			}

			const pagination = parsePagination(url);

			// Parse notification-specific filters
			const isRead = url.searchParams.get("isRead");
			const type = url.searchParams.get("type") as NotificationType | undefined;
			const entityType = url.searchParams.get("entityType") || undefined;

			const result = await notificationsService.getNotifications(
				auth.userId,
				pagination,
				{
					isRead: isRead ? isRead === "true" : undefined,
					type,
					entityType,
				},
			);

			// Ensure result is always an ApiResponse
			if (!result || typeof result !== "object" || !("success" in result)) {
				return errorResponse("INTERNAL_ERROR", "Invalid response from service");
			}

			return result;
		} catch (error) {
			const errorMessage =
				error instanceof Error
					? error.message
					: "Failed to fetch notifications";
			return errorResponse("INTERNAL_ERROR", errorMessage);
		}
	});
});

// ============================================
// Get Unread Count
// ============================================

router.get("/api/v1/notifications/unread-count", async (request) => {
	return withAuth(request, async (auth) => {
		// withAuth already handles errors and returns JSON, just call the service
		return notificationsService.getUnreadCount(auth.userId);
	});
});

// ============================================
// Get Single Notification
// ============================================

router.get("/api/v1/notifications/:id", async (request, _url, params) => {
	return withAuth(request, async (auth) => {
		return notificationsService.getNotificationById(params.id, auth.userId);
	});
});

// ============================================
// Create Notification (Admin only)
// ============================================

router.post("/api/v1/notifications", async (request) => {
	return withAuth(
		request,
		async () => {
			const body = await parseBody<CreateNotificationRequest>(request);
			if (!body) {
				return errorResponse("VALIDATION_ERROR", "Invalid request body");
			}
			return notificationsService.createNotification(body);
		},
		201,
	);
});

// ============================================
// Mark as Read
// ============================================

router.patch(
	"/api/v1/notifications/:id/read",
	async (request, _url, params) => {
		return withAuth(request, async (auth) => {
			return notificationsService.markAsRead(params.id, auth.userId);
		});
	},
);

// ============================================
// Mark All as Read
// ============================================

router.post("/api/v1/notifications/mark-all-read", async (request) => {
	return withAuth(request, async (auth) => {
		return notificationsService.markAllAsRead(auth.userId);
	});
});

// ============================================
// Delete Notification
// ============================================

router.delete("/api/v1/notifications/:id", async (request, _url, params) => {
	return withAuth(request, async (auth) => {
		return notificationsService.deleteNotification(params.id, auth.userId);
	});
});

// ============================================
// Notification Settings Routes
// ============================================

import { notificationSettingsService } from "../services/notification-settings.service";

router.get("/api/v1/notification-settings", async (request) => {
	return withAuth(request, async (auth) => {
		return notificationSettingsService.getSettings(auth.userId);
	});
});

router.patch("/api/v1/notification-settings", async (request) => {
	return withAuth(request, async (auth) => {
		const body = await parseBody<{
			notificationType: string;
			channel: "in_app" | "email" | "push";
			enabled: boolean;
		}>(request);

		if (!body || !body.notificationType || !body.channel) {
			return errorResponse(
				"VALIDATION_ERROR",
				"Notification type and channel are required",
			);
		}

		return notificationSettingsService.updateSetting(auth.userId, body);
	});
});

export const notificationRoutes = router.getRoutes();
