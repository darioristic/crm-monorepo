import type {
  Notification,
  NotificationType,
  NotificationChannel,
  CreateNotificationRequest,
  PaginationParams,
} from "@crm/types";
import { generateUUID, now } from "@crm/utils";
import { sql as db } from "../client";
import { createQueryBuilder, type QueryParam } from "../query-builder";

// ============================================
// Notification Queries
// ============================================

export const notificationQueries = {
  async findAll(
    userId: string,
    pagination: PaginationParams = {},
    filters: {
      isRead?: boolean;
      type?: NotificationType;
      entityType?: string;
    } = {}
  ): Promise<{ notifications: Notification[]; total: number; unreadCount: number }> {
    const page = pagination.page || 1;
    const pageSize = pagination.pageSize || 20;

    const safePage = Math.max(1, Math.floor(page));
    const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
    const safeOffset = (safePage - 1) * safePageSize;

    // Gradi parameterizovan upit
    const qb = createQueryBuilder("notifications");
    qb.addUuidCondition("user_id", userId);
    qb.addBooleanCondition("is_read", filters.isRead);
    qb.addEqualCondition("type", filters.type);
    qb.addEqualCondition("entity_type", filters.entityType);

    const { clause: whereClause, values: whereValues } = qb.buildWhereClause();

    // Count
    const countQuery = `SELECT COUNT(*) as total FROM notifications ${whereClause}`;
    const countResult = await db.unsafe(countQuery, whereValues as QueryParam[]);
    const total = Number(countResult[0]?.total || 0);

    // Get unread count
    const unreadResult = await db`
      SELECT COUNT(*) as unread FROM notifications
      WHERE user_id = ${userId} AND is_read = false
    `;
    const unreadCount = Number(unreadResult[0]?.unread || 0);

    // Select
    const selectQuery = `
      SELECT 
        id, user_id as "userId", type, channel, title, message, link,
        entity_type as "entityType", entity_id as "entityId",
        is_read as "isRead", read_at as "readAt",
        email_sent as "emailSent", email_sent_at as "emailSentAt",
        metadata, created_at as "createdAt"
      FROM notifications
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${whereValues.length + 1} OFFSET $${whereValues.length + 2}
    `;

    const notifications = await db.unsafe(selectQuery, [...whereValues, safePageSize, safeOffset] as QueryParam[]);

    return {
      notifications: notifications.map(mapNotification),
      total,
      unreadCount,
    };
  },

  async findById(id: string): Promise<Notification | null> {
    const result = await db`
      SELECT 
        id, user_id as "userId", type, channel, title, message, link,
        entity_type as "entityType", entity_id as "entityId",
        is_read as "isRead", read_at as "readAt",
        email_sent as "emailSent", email_sent_at as "emailSentAt",
        metadata, created_at as "createdAt"
      FROM notifications
      WHERE id = ${id}
    `;

    return result[0] ? mapNotification(result[0]) : null;
  },

  async create(data: CreateNotificationRequest): Promise<Notification> {
    const id = generateUUID();
    const timestamp = now();

    const result = await db`
      INSERT INTO notifications (
        id, user_id, type, channel, title, message, link,
        entity_type, entity_id, metadata, created_at
      ) VALUES (
        ${id}, ${data.userId}, ${data.type}::notification_type,
        ${data.channel || "in_app"}::notification_channel,
        ${data.title}, ${data.message}, ${data.link || null},
        ${data.entityType || null}, ${data.entityId || null},
        ${data.metadata ? JSON.stringify(data.metadata) : null},
        ${timestamp}
      )
      RETURNING 
        id, user_id as "userId", type, channel, title, message, link,
        entity_type as "entityType", entity_id as "entityId",
        is_read as "isRead", read_at as "readAt",
        email_sent as "emailSent", email_sent_at as "emailSentAt",
        metadata, created_at as "createdAt"
    `;

    return mapNotification(result[0]);
  },

  async createBulk(
    userIds: string[],
    data: Omit<CreateNotificationRequest, "userId">
  ): Promise<Notification[]> {
    const timestamp = now();
    const notifications: Notification[] = [];

    for (const userId of userIds) {
      const id = generateUUID();
      const result = await db`
        INSERT INTO notifications (
          id, user_id, type, channel, title, message, link,
          entity_type, entity_id, metadata, created_at
        ) VALUES (
          ${id}, ${userId}, ${data.type}::notification_type,
          ${data.channel || "in_app"}::notification_channel,
          ${data.title}, ${data.message}, ${data.link || null},
          ${data.entityType || null}, ${data.entityId || null},
          ${data.metadata ? JSON.stringify(data.metadata) : null},
          ${timestamp}
        )
        RETURNING 
          id, user_id as "userId", type, channel, title, message, link,
          entity_type as "entityType", entity_id as "entityId",
          is_read as "isRead", read_at as "readAt",
          email_sent as "emailSent", email_sent_at as "emailSentAt",
          metadata, created_at as "createdAt"
      `;
      notifications.push(mapNotification(result[0]));
    }

    return notifications;
  },

  async markAsRead(id: string): Promise<Notification | null> {
    const result = await db`
      UPDATE notifications SET
        is_read = true,
        read_at = ${now()}
      WHERE id = ${id}
      RETURNING 
        id, user_id as "userId", type, channel, title, message, link,
        entity_type as "entityType", entity_id as "entityId",
        is_read as "isRead", read_at as "readAt",
        email_sent as "emailSent", email_sent_at as "emailSentAt",
        metadata, created_at as "createdAt"
    `;

    return result[0] ? mapNotification(result[0]) : null;
  },

  async markAllAsRead(userId: string): Promise<number> {
    const result = await db`
      UPDATE notifications SET
        is_read = true,
        read_at = ${now()}
      WHERE user_id = ${userId} AND is_read = false
    `;

    return result.count;
  },

  async markEmailSent(id: string): Promise<void> {
    await db`
      UPDATE notifications SET
        email_sent = true,
        email_sent_at = ${now()}
      WHERE id = ${id}
    `;
  },

  async delete(id: string): Promise<boolean> {
    const result = await db`
      DELETE FROM notifications WHERE id = ${id}
    `;

    return result.count > 0;
  },

  async deleteOld(daysOld: number = 30): Promise<number> {
    const safeDays = Math.max(1, Math.min(365, Math.floor(daysOld)));
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - safeDays);

    const result = await db`
      DELETE FROM notifications
      WHERE created_at < ${cutoffDate.toISOString()}
      AND is_read = true
    `;

    return result.count;
  },

  async getUnreadCount(userId: string): Promise<number> {
    const result = await db`
      SELECT COUNT(*) as count FROM notifications
      WHERE user_id = ${userId} AND is_read = false
    `;

    return Number(result[0]?.count || 0);
  },

  async getPendingEmailNotifications(): Promise<Notification[]> {
    const result = await db`
      SELECT 
        id, user_id as "userId", type, channel, title, message, link,
        entity_type as "entityType", entity_id as "entityId",
        is_read as "isRead", read_at as "readAt",
        email_sent as "emailSent", email_sent_at as "emailSentAt",
        metadata, created_at as "createdAt"
      FROM notifications
      WHERE email_sent = false
      AND channel IN ('email', 'both')
      ORDER BY created_at ASC
      LIMIT 100
    `;

    return result.map(mapNotification);
  },
};

// ============================================
// Mapping Function
// ============================================

function mapNotification(row: Record<string, unknown>): Notification {
  return {
    id: row.id as string,
    userId: row.userId as string,
    type: row.type as NotificationType,
    channel: row.channel as NotificationChannel,
    title: row.title as string,
    message: row.message as string,
    link: row.link as string | undefined,
    entityType: row.entityType as string | undefined,
    entityId: row.entityId as string | undefined,
    isRead: row.isRead as boolean,
    readAt: row.readAt ? (row.readAt as Date).toISOString() : undefined,
    emailSent: row.emailSent as boolean,
    emailSentAt: row.emailSentAt ? (row.emailSentAt as Date).toISOString() : undefined,
    metadata: row.metadata as Record<string, unknown> | undefined,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : (row.createdAt as string),
  };
}

export default notificationQueries;
