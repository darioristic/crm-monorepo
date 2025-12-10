import type {
  ApiResponse,
  BulkCreateNotificationRequest,
  CreateNotificationRequest,
  Notification,
  NotificationType,
  PaginationParams,
} from "@crm/types";
import { errorResponse, successResponse } from "@crm/utils";
import { notificationQueries } from "../db/queries/notifications";
import { userQueries } from "../db/queries/users";
import { emailService } from "../integrations/email.service";
import { serviceLogger } from "../lib/logger";

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
    } = {}
  ): Promise<ApiResponse<{ notifications: Notification[]; unreadCount: number }>> {
    try {
      // Validate userId
      if (!userId || typeof userId !== "string") {
        return errorResponse("VALIDATION_ERROR", "Invalid user ID");
      }

      const { notifications, total, unreadCount } = await notificationQueries.findAll(
        userId,
        pagination,
        filters
      );

      const page = pagination.page ?? 1;
      const pageSize = pagination.pageSize ?? 20;

      return successResponse(
        { notifications: notifications || [], unreadCount: unreadCount || 0 },
        {
          page,
          pageSize,
          totalCount: total || 0,
          totalPages: Math.ceil((total || 0) / pageSize),
        }
      );
    } catch (error) {
      serviceLogger.error(
        {
          error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          userId,
          pagination,
          filters,
        },
        "Error fetching notifications:"
      );
      // Return empty result instead of error to prevent 500
      const page = pagination.page ?? 1;
      const pageSize = pagination.pageSize ?? 20;
      return successResponse(
        { notifications: [], unreadCount: 0 },
        {
          page,
          pageSize,
          totalCount: 0,
          totalPages: 0,
        }
      );
    }
  }

  /**
   * Get notification by ID
   */
  async getNotificationById(id: string, userId: string): Promise<ApiResponse<Notification>> {
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
      serviceLogger.error(error, "Error fetching notification:");
      return errorResponse("SERVER_ERROR", "Failed to fetch notification");
    }
  }

  /**
   * Create a new notification
   */
  async createNotification(data: CreateNotificationRequest): Promise<ApiResponse<Notification>> {
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
      serviceLogger.error(error, "Error creating notification:");
      return errorResponse("SERVER_ERROR", "Failed to create notification");
    }
  }

  /**
   * Create notifications for multiple users
   */
  async createBulkNotifications(
    data: BulkCreateNotificationRequest
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
      serviceLogger.error(error, "Error creating bulk notifications:");
      return errorResponse("SERVER_ERROR", "Failed to create notifications");
    }
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(id: string, userId: string): Promise<ApiResponse<Notification>> {
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
      serviceLogger.error(error, "Error marking notification as read:");
      return errorResponse("SERVER_ERROR", "Failed to mark as read");
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<ApiResponse<{ markedCount: number }>> {
    try {
      const markedCount = await notificationQueries.markAllAsRead(userId);
      return successResponse({ markedCount });
    } catch (error) {
      serviceLogger.error(error, "Error marking all notifications as read:");
      return errorResponse("SERVER_ERROR", "Failed to mark all as read");
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(id: string, userId: string): Promise<ApiResponse<{ deleted: boolean }>> {
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
      serviceLogger.error(error, "Error deleting notification:");
      return errorResponse("SERVER_ERROR", "Failed to delete notification");
    }
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<ApiResponse<{ count: number }>> {
    try {
      // Validate userId
      if (!userId || typeof userId !== "string") {
        return successResponse({ count: 0 });
      }

      const count = await notificationQueries.getUnreadCount(userId);
      return successResponse({ count: count || 0 });
    } catch (error) {
      serviceLogger.error({ error, userId }, "Error getting unread count:");
      // Always return success with count 0 instead of error to prevent 500
      return successResponse({ count: 0 });
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(notification: Notification, email: string): Promise<void> {
    try {
      await emailService.send(
        { to: email },
        notification.title,
        this.buildEmailHtml(notification),
        notification.message
      );

      await notificationQueries.markEmailSent(notification.id);
    } catch (error) {
      serviceLogger.error(error, "Error sending email notification:");
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
    invoiceNumber: string
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
    projectName: string
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
    daysOverdue: number
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
    value: number
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
