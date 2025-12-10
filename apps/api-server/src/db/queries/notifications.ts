import type {
  CreateNotificationRequest,
  Notification,
  NotificationChannel,
  NotificationType,
  PaginationParams,
} from "@crm/types";
import { generateUUID, now } from "@crm/utils";
import { serviceLogger } from "../../lib/logger";
import { sql as db } from "../client";

// ============================================
// Notification Queries
// ============================================

function mapNotification(row: Record<string, unknown>): Notification {
  let metadata: Record<string, unknown> | undefined;
  if (row.metadata) {
    try {
      if (typeof row.metadata === "string") {
        const parsed = JSON.parse(row.metadata);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          metadata = parsed as Record<string, unknown>;
        }
      } else if (row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)) {
        metadata = row.metadata as Record<string, unknown>;
      }
    } catch (parseError) {
      serviceLogger.error(
        { error: parseError, metadata: row.metadata },
        "Error parsing notification metadata"
      );
      metadata = undefined;
    }
  }

  return {
    id: String(row.id || ""),
    userId: String(row.user_id || row.userId || ""),
    type: (row.type || "info") as NotificationType,
    channel: (row.channel || "in_app") as NotificationChannel,
    title: String(row.title || ""),
    message: String(row.message || ""),
    link: row.link ? String(row.link) : undefined,
    entityType:
      row.entity_type || row.entityType ? String(row.entity_type || row.entityType) : undefined,
    entityId: row.entity_id || row.entityId ? String(row.entity_id || row.entityId) : undefined,
    isRead: row.is_read !== undefined ? Boolean(row.is_read) : Boolean(row.isRead),
    readAt: row.read_at || row.readAt ? String(row.read_at || row.readAt) : undefined,
    emailSent: row.email_sent !== undefined ? Boolean(row.email_sent) : Boolean(row.emailSent),
    emailSentAt:
      row.email_sent_at || row.emailSentAt
        ? String(row.email_sent_at || row.emailSentAt)
        : undefined,
    metadata,
    createdAt: String(row.created_at || row.createdAt || new Date().toISOString()),
  };
}

export const notificationQueries = {
  async findAll(
    userId: string,
    pagination: PaginationParams = {},
    filters: {
      isRead?: boolean;
      type?: NotificationType;
      entityType?: string;
    } = {}
  ): Promise<{
    notifications: Notification[];
    total: number;
    unreadCount: number;
  }> {
    try {
      // Validate userId
      if (!userId || typeof userId !== "string") {
        serviceLogger.warn(
          { userId, pagination, filters },
          "Invalid userId in notifications.findAll"
        );
        return {
          notifications: [],
          total: 0,
          unreadCount: 0,
        };
      }

      const page = pagination.page || 1;
      const pageSize = pagination.pageSize || 20;

      const safePage = Math.max(1, Math.floor(page));
      const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
      const safeOffset = (safePage - 1) * safePageSize;

      // Get total count - build query dynamically with template literal
      let total = 0;
      try {
        let countResult: Array<{ count: string | number }>;
        if (filters.isRead !== undefined && filters.type && filters.entityType) {
          countResult = await db`
						SELECT COUNT(*) as count FROM notifications
						WHERE user_id = ${userId} 
							AND is_read = ${filters.isRead}
							AND type = ${filters.type}
							AND entity_type = ${filters.entityType}
					`;
        } else if (filters.isRead !== undefined && filters.type) {
          countResult = await db`
						SELECT COUNT(*) as count FROM notifications
						WHERE user_id = ${userId} 
							AND is_read = ${filters.isRead}
							AND type = ${filters.type}
					`;
        } else if (filters.isRead !== undefined) {
          countResult = await db`
						SELECT COUNT(*) as count FROM notifications
						WHERE user_id = ${userId} AND is_read = ${filters.isRead}
					`;
        } else if (filters.type) {
          countResult = await db`
						SELECT COUNT(*) as count FROM notifications
						WHERE user_id = ${userId} AND type = ${filters.type}
					`;
        } else {
          countResult = await db`
						SELECT COUNT(*) as count FROM notifications
						WHERE user_id = ${userId}
					`;
        }

        const countValue = countResult[0]?.count;
        total =
          typeof countValue === "string"
            ? parseInt(countValue, 10)
            : typeof countValue === "number"
              ? countValue
              : 0;
      } catch (countError) {
        serviceLogger.error(
          {
            error: countError,
            errorMessage: countError instanceof Error ? countError.message : String(countError),
            errorStack: countError instanceof Error ? countError.stack : undefined,
            userId,
            filters,
          },
          "Error counting notifications"
        );
        total = 0;
      }

      // Get unread count
      let unreadCount = 0;
      try {
        const unreadResult = await db`
					SELECT COUNT(*) as count FROM notifications
					WHERE user_id = ${userId} AND is_read = false
				`;
        unreadCount = parseInt(unreadResult[0]?.count || "0", 10);
      } catch (unreadError) {
        serviceLogger.error(
          {
            error: unreadError,
            errorMessage: unreadError instanceof Error ? unreadError.message : String(unreadError),
            errorStack: unreadError instanceof Error ? unreadError.stack : undefined,
            userId,
          },
          "Error counting unread notifications"
        );
        unreadCount = 0;
      }

      // Get notifications - build query dynamically with template literal
      let notificationRows: Record<string, unknown>[] = [];
      try {
        if (filters.isRead !== undefined && filters.type && filters.entityType) {
          notificationRows = await db`
						SELECT 
							id, user_id, type, channel, title, message, link,
							entity_type, entity_id,
							is_read, read_at,
							email_sent, email_sent_at,
							metadata, created_at
						FROM notifications
						WHERE user_id = ${userId} 
							AND is_read = ${filters.isRead}
							AND type = ${filters.type}
							AND entity_type = ${filters.entityType}
						ORDER BY created_at DESC
						LIMIT ${safePageSize} OFFSET ${safeOffset}
					`;
        } else if (filters.isRead !== undefined && filters.type) {
          notificationRows = await db`
						SELECT 
							id, user_id, type, channel, title, message, link,
							entity_type, entity_id,
							is_read, read_at,
							email_sent, email_sent_at,
							metadata, created_at
						FROM notifications
						WHERE user_id = ${userId} 
							AND is_read = ${filters.isRead}
							AND type = ${filters.type}
						ORDER BY created_at DESC
						LIMIT ${safePageSize} OFFSET ${safeOffset}
					`;
        } else if (filters.isRead !== undefined) {
          notificationRows = await db`
						SELECT 
							id, user_id, type, channel, title, message, link,
							entity_type, entity_id,
							is_read, read_at,
							email_sent, email_sent_at,
							metadata, created_at
						FROM notifications
						WHERE user_id = ${userId} AND is_read = ${filters.isRead}
						ORDER BY created_at DESC
						LIMIT ${safePageSize} OFFSET ${safeOffset}
					`;
        } else if (filters.type) {
          notificationRows = await db`
						SELECT 
							id, user_id, type, channel, title, message, link,
							entity_type, entity_id,
							is_read, read_at,
							email_sent, email_sent_at,
							metadata, created_at
						FROM notifications
						WHERE user_id = ${userId} AND type = ${filters.type}
						ORDER BY created_at DESC
						LIMIT ${safePageSize} OFFSET ${safeOffset}
					`;
        } else {
          notificationRows = await db`
						SELECT 
							id, user_id, type, channel, title, message, link,
							entity_type, entity_id,
							is_read, read_at,
							email_sent, email_sent_at,
							metadata, created_at
						FROM notifications
						WHERE user_id = ${userId}
						ORDER BY created_at DESC
						LIMIT ${safePageSize} OFFSET ${safeOffset}
					`;
        }
      } catch (selectError) {
        serviceLogger.error(
          {
            error: selectError,
            errorMessage: selectError instanceof Error ? selectError.message : String(selectError),
            errorStack: selectError instanceof Error ? selectError.stack : undefined,
            userId,
            filters,
            pagination,
          },
          "Error selecting notifications"
        );
        notificationRows = [];
      }

      // Map notifications
      const mappedNotifications = (notificationRows || [])
        .map((row) => {
          try {
            if (!row || typeof row !== "object") {
              return null;
            }
            return mapNotification(row);
          } catch (error) {
            serviceLogger.error(
              {
                error,
                errorMessage: error instanceof Error ? error.message : String(error),
                row,
              },
              "Error mapping notification row"
            );
            return null;
          }
        })
        .filter((n): n is Notification => n !== null);

      return {
        notifications: mappedNotifications,
        total,
        unreadCount,
      };
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
        "Critical error in notifications.findAll"
      );
      return {
        notifications: [],
        total: 0,
        unreadCount: 0,
      };
    }
  },

  async findById(id: string): Promise<Notification | null> {
    try {
      const result = await db`
        SELECT 
          id, user_id, type, channel, title, message, link,
          entity_type, entity_id,
          is_read, read_at,
          email_sent, email_sent_at,
          metadata, created_at
        FROM notifications
        WHERE id = ${id}
      `;

      return result[0] ? mapNotification(result[0]) : null;
    } catch (error) {
      serviceLogger.error({ error, id }, "Error finding notification by ID");
      return null;
    }
  },

  async create(data: CreateNotificationRequest): Promise<Notification> {
    const id = generateUUID();
    const timestamp = now();

    try {
      const result = await db`
        INSERT INTO notifications (
          id, user_id, type, channel, title, message, link,
          entity_type, entity_id, metadata, created_at
        ) VALUES (
          ${id}, ${data.userId}, ${data.type || "info"}::notification_type,
          ${data.channel || "in_app"}::notification_channel,
          ${data.title}, ${data.message}, ${data.link || null},
          ${data.entityType || null}, ${data.entityId || null},
          ${data.metadata ? JSON.stringify(data.metadata) : null},
          ${timestamp}
        )
        RETURNING 
          id, user_id, type, channel, title, message, link,
          entity_type, entity_id,
          is_read, read_at,
          email_sent, email_sent_at,
          metadata, created_at
      `;

      return mapNotification(result[0]);
    } catch (error) {
      serviceLogger.error({ error, data }, "Error creating notification");
      throw error;
    }
  },

  async createBulk(
    userIds: string[],
    data: Omit<CreateNotificationRequest, "userId">
  ): Promise<Notification[]> {
    const timestamp = now();
    const notifications: Notification[] = [];

    for (const userId of userIds) {
      try {
        const id = generateUUID();
        const result = await db`
          INSERT INTO notifications (
            id, user_id, type, channel, title, message, link,
            entity_type, entity_id, metadata, created_at
          ) VALUES (
            ${id}, ${userId}, ${data.type || "info"}::notification_type,
            ${data.channel || "in_app"}::notification_channel,
            ${data.title}, ${data.message}, ${data.link || null},
            ${data.entityType || null}, ${data.entityId || null},
            ${data.metadata ? JSON.stringify(data.metadata) : null},
            ${timestamp}
          )
          RETURNING 
            id, user_id, type, channel, title, message, link,
            entity_type, entity_id,
            is_read, read_at,
            email_sent, email_sent_at,
            metadata, created_at
        `;
        notifications.push(mapNotification(result[0]));
      } catch (error) {
        serviceLogger.error({ error, userId, data }, "Error creating notification for user");
        // Continue with other users
      }
    }

    return notifications;
  },

  async markAsRead(id: string): Promise<Notification | null> {
    try {
      const result = await db`
        UPDATE notifications SET
          is_read = true,
          read_at = ${now()}
        WHERE id = ${id}
        RETURNING 
          id, user_id, type, channel, title, message, link,
          entity_type, entity_id,
          is_read, read_at,
          email_sent, email_sent_at,
          metadata, created_at
      `;

      return result[0] ? mapNotification(result[0]) : null;
    } catch (error) {
      serviceLogger.error({ error, id }, "Error marking notification as read");
      return null;
    }
  },

  async markAllAsRead(userId: string): Promise<number> {
    try {
      const result = await db`
        UPDATE notifications SET
          is_read = true,
          read_at = ${now()}
        WHERE user_id = ${userId} AND is_read = false
        RETURNING id
      `;

      return result.length || 0;
    } catch (error) {
      serviceLogger.error({ error, userId }, "Error marking all notifications as read");
      return 0;
    }
  },

  async markEmailSent(id: string): Promise<Notification | null> {
    try {
      const result = await db`
        UPDATE notifications SET
          email_sent = true,
          email_sent_at = ${now()}
        WHERE id = ${id}
        RETURNING 
          id, user_id, type, channel, title, message, link,
          entity_type, entity_id,
          is_read, read_at,
          email_sent, email_sent_at,
          metadata, created_at
      `;

      return result[0] ? mapNotification(result[0]) : null;
    } catch (error) {
      serviceLogger.error({ error, id }, "Error marking email as sent");
      return null;
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const result = await db`
        DELETE FROM notifications WHERE id = ${id}
        RETURNING id
      `;

      return result.length > 0;
    } catch (error) {
      serviceLogger.error({ error, id }, "Error deleting notification");
      return false;
    }
  },

  async deleteOld(daysOld: number): Promise<number> {
    try {
      const result = await db`
        DELETE FROM notifications
        WHERE created_at < NOW() - INTERVAL ${daysOld} DAY
        RETURNING id
      `;
      return result.length;
    } catch (error) {
      serviceLogger.error({ error, daysOld }, "Error deleting old notifications");
      return 0;
    }
  },

  async deleteNotification(id: string, userId: string): Promise<boolean> {
    try {
      const result = await db`
        DELETE FROM notifications 
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING id
      `;

      return result.length > 0;
    } catch (error) {
      serviceLogger.error({ error, id, userId }, "Error deleting notification");
      return false;
    }
  },

  async getUnreadCount(userId: string): Promise<number> {
    try {
      if (!userId || typeof userId !== "string") {
        return 0;
      }

      const result = await db`
				SELECT COUNT(*) as count FROM notifications
				WHERE user_id = ${userId} AND is_read = false
			`;

      if (!result || !result[0]) {
        return 0;
      }

      const count = result[0].count;
      if (typeof count === "string") {
        return parseInt(count, 10) || 0;
      }
      if (typeof count === "number") {
        return count;
      }
      return 0;
    } catch (error) {
      serviceLogger.error(
        {
          error,
          userId,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
        },
        "Error getting unread count"
      );
      return 0;
    }
  },
};
