import type {
	Notification,
	NotificationType,
	CreateNotificationRequest,
	BulkCreateNotificationRequest,
	ApiResponse,
	PaginationParams,
} from "@crm/types";
import { successResponse, errorResponse, paginatedResponse } from "@crm/utils";
import { notificationQueries } from "../db/queries/notifications";
import { userQueries } from "../db/queries/users";
import { emailService } from "../integrations/email.service";

// ============================================
// Notifications Service
// ============================================

class NotificationsService {
	/**
	 * Get all notifications for a user
	 */
	async getNotifications(
		userId: string,
		pagination: PaginationParams = {},
		filters: {
			isRead?: boolean;
			type?: NotificationType;
			entityType?: string;
		} = {},
	): Promise<
		ApiResponse<{ notifications: Notification[]; unreadCount: number }>
	> {
		try {
			const { notifications, total, unreadCount } = await notificationQueries.findAll(
				userId,
				pagination,
				filters,
			);

			return {
				...paginatedResponse(notifications, total, pagination),
				data: { notifications, unreadCount },
			};
		} catch (error) {
			console.error("Error fetching notifications:", error);
			return errorResponse("SERVER_ERROR", "Failed to fetch notifications");
		}
	}

	/**
	 * Get notification by ID
	 */
	async getNotificationById(
		id: string,
		userId: string,
	): Promise<ApiResponse<Notification>> {
		try {
			const notification = await notificationQueries.findById(id);
			if (!notification) {
				return errorResponse("NOT_FOUND", "Notification not found");
			}

			// Verify ownership
			if (notification.userId !== userId) {
				return errorResponse("FORBIDDEN", "Access denied");
			}

			return successResponse(notification);
		} catch (error) {
			console.error("Error fetching notification:", error);
			return errorResponse("SERVER_ERROR", "Failed to fetch notification");
		}
	}

	/**
	 * Create a new notification
	 */
	async createNotification(
		data: CreateNotificationRequest,
	): Promise<ApiResponse<Notification>> {
		try {
			// Validate user exists
			const user = await userQueries.findById(data.userId);
			if (!user) {
				return errorResponse("NOT_FOUND", "User not found");
			}

			if (!data.title || data.title.trim().length === 0) {
				return errorResponse("VALIDATION_ERROR", "Title is required");
			}

			if (!data.message || data.message.trim().length === 0) {
				return errorResponse("VALIDATION_ERROR", "Message is required");
			}

			const notification = await notificationQueries.create(data);

			// Send email if channel includes email
			if (data.channel === "email" || data.channel === "both") {
				await this.sendEmailNotification(notification, user.email);
			}

			return successResponse(notification);
		} catch (error) {
			console.error("Error creating notification:", error);
			return errorResponse("SERVER_ERROR", "Failed to create notification");
		}
	}

	/**
	 * Create notifications for multiple users
	 */
	async createBulkNotifications(
		data: BulkCreateNotificationRequest,
	): Promise<ApiResponse<Notification[]>> {
		try {
			if (!data.userIds || data.userIds.length === 0) {
				return errorResponse("VALIDATION_ERROR", "At least one user ID is required");
			}

			const notifications = await notificationQueries.createBulk(data.userIds, data);

			// Send emails if channel includes email
			if (data.channel === "email" || data.channel === "both") {
				for (const notification of notifications) {
					const user = await userQueries.findById(notification.userId);
					if (user) {
						await this.sendEmailNotification(notification, user.email);
					}
				}
			}

			return successResponse(notifications);
		} catch (error) {
			console.error("Error creating bulk notifications:", error);
			return errorResponse("SERVER_ERROR", "Failed to create notifications");
		}
	}

	/**
	 * Mark a notification as read
	 */
	async markAsRead(
		id: string,
		userId: string,
	): Promise<ApiResponse<Notification>> {
		try {
			const existing = await notificationQueries.findById(id);
			if (!existing) {
				return errorResponse("NOT_FOUND", "Notification not found");
			}

			if (existing.userId !== userId) {
				return errorResponse("FORBIDDEN", "Access denied");
			}

			const notification = await notificationQueries.markAsRead(id);
			if (!notification) {
				return errorResponse("SERVER_ERROR", "Failed to mark as read");
			}

			return successResponse(notification);
		} catch (error) {
			console.error("Error marking notification as read:", error);
			return errorResponse("SERVER_ERROR", "Failed to mark as read");
		}
	}

	/**
	 * Mark all notifications as read for a user
	 */
	async markAllAsRead(
		userId: string,
	): Promise<ApiResponse<{ markedCount: number }>> {
		try {
			const markedCount = await notificationQueries.markAllAsRead(userId);
			return successResponse({ markedCount });
		} catch (error) {
			console.error("Error marking all notifications as read:", error);
			return errorResponse("SERVER_ERROR", "Failed to mark all as read");
		}
	}

	/**
	 * Delete a notification
	 */
	async deleteNotification(
		id: string,
		userId: string,
	): Promise<ApiResponse<{ deleted: boolean }>> {
		try {
			const existing = await notificationQueries.findById(id);
			if (!existing) {
				return errorResponse("NOT_FOUND", "Notification not found");
			}

			if (existing.userId !== userId) {
				return errorResponse("FORBIDDEN", "Access denied");
			}

			const deleted = await notificationQueries.delete(id);
			return successResponse({ deleted });
		} catch (error) {
			console.error("Error deleting notification:", error);
			return errorResponse("SERVER_ERROR", "Failed to delete notification");
		}
	}

	/**
	 * Get unread count for a user
	 */
	async getUnreadCount(userId: string): Promise<ApiResponse<{ count: number }>> {
		try {
			const count = await notificationQueries.getUnreadCount(userId);
			return successResponse({ count });
		} catch (error) {
			console.error("Error getting unread count:", error);
			return errorResponse("SERVER_ERROR", "Failed to get unread count");
		}
	}

	/**
	 * Send email notification
	 */
	private async sendEmailNotification(
		notification: Notification,
		email: string,
	): Promise<void> {
		try {
			await emailService.send(
				{ to: email },
				notification.title,
				this.buildEmailHtml(notification),
				notification.message,
			);

			await notificationQueries.markEmailSent(notification.id);
		} catch (error) {
			console.error("Error sending email notification:", error);
			// Don't fail the notification creation if email fails
		}
	}

	/**
	 * Build HTML email content
	 */
	private buildEmailHtml(notification: Notification): string {
		const linkHtml = notification.link
			? `<p><a href="${notification.link}" style="color: #3b82f6;">View details</a></p>`
			: "";

		return `
			<!DOCTYPE html>
			<html>
				<head>
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
				</head>
				<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background-color: #f5f5f5;">
					<div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 32px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
						<h2 style="color: #1f2937; margin-bottom: 16px;">${notification.title}</h2>
						<p style="color: #4b5563; line-height: 1.6;">${notification.message}</p>
						${linkHtml}
						<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
						<p style="color: #9ca3af; font-size: 12px;">
							This is an automated notification from CRM System.
						</p>
					</div>
				</body>
			</html>
		`;
	}

	// ============================================
	// Helper Methods for Creating Domain Notifications
	// ============================================

	/**
	 * Notify about invoice creation
	 */
	async notifyInvoiceCreated(
		userId: string,
		invoiceId: string,
		invoiceNumber: string,
	): Promise<void> {
		await this.createNotification({
			userId,
			type: "invoice_created",
			channel: "both",
			title: "New Invoice Created",
			message: `Invoice ${invoiceNumber} has been created and is ready for review.`,
			link: `/dashboard/sales/invoices/${invoiceId}`,
			entityType: "invoice",
			entityId: invoiceId,
		});
	}

	/**
	 * Notify about task assignment
	 */
	async notifyTaskAssigned(
		userId: string,
		taskId: string,
		taskTitle: string,
		projectName: string,
	): Promise<void> {
		await this.createNotification({
			userId,
			type: "task_assigned",
			channel: "both",
			title: "New Task Assigned",
			message: `You have been assigned to "${taskTitle}" in project "${projectName}".`,
			link: `/dashboard/projects/tasks/${taskId}`,
			entityType: "task",
			entityId: taskId,
		});
	}

	/**
	 * Notify about overdue invoice
	 */
	async notifyInvoiceOverdue(
		userId: string,
		invoiceId: string,
		invoiceNumber: string,
		daysOverdue: number,
	): Promise<void> {
		await this.createNotification({
			userId,
			type: "invoice_overdue",
			channel: "both",
			title: "Invoice Overdue",
			message: `Invoice ${invoiceNumber} is ${daysOverdue} days overdue. Please follow up with the customer.`,
			link: `/dashboard/sales/invoices/${invoiceId}`,
			entityType: "invoice",
			entityId: invoiceId,
		});
	}

	/**
	 * Notify about deal won
	 */
	async notifyDealWon(
		userId: string,
		dealId: string,
		dealTitle: string,
		value: number,
	): Promise<void> {
		await this.createNotification({
			userId,
			type: "deal_won",
			channel: "both",
			title: "Deal Won! 🎉",
			message: `Congratulations! The deal "${dealTitle}" worth ${value.toLocaleString()} has been won.`,
			link: `/dashboard/crm/deals/${dealId}`,
			entityType: "deal",
			entityId: dealId,
		});
	}
}

export const notificationsService = new NotificationsService();

