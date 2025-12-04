import { sql as db } from "../client";

export type NotificationSetting = {
	id: string;
	userId: string;
	notificationType: string;
	channel: "in_app" | "email" | "push";
	enabled: boolean;
	createdAt: string;
	updatedAt: string;
};

export type CreateNotificationSettingParams = {
	userId: string;
	notificationType: string;
	channel: "in_app" | "email" | "push";
	enabled: boolean;
};

function mapNotificationSetting(row: Record<string, unknown>): NotificationSetting {
	return {
		id: row.id as string,
		userId: row.user_id as string,
		notificationType: row.notification_type as string,
		channel: row.channel as "in_app" | "email" | "push",
		enabled: row.enabled as boolean,
		createdAt: row.created_at as string,
		updatedAt: row.updated_at as string,
	};
}

export const notificationSettingsQueries = {
	async findByUserId(userId: string): Promise<NotificationSetting[]> {
		const result = await db`
      SELECT * FROM notification_settings
      WHERE user_id = ${userId}
      ORDER BY notification_type, channel
    `;
		return result.map(mapNotificationSetting);
	},

	async findByUserIdAndType(
		userId: string,
		notificationType: string,
	): Promise<NotificationSetting[]> {
		const result = await db`
      SELECT * FROM notification_settings
      WHERE user_id = ${userId}
        AND notification_type = ${notificationType}
    `;
		return result.map(mapNotificationSetting);
	},

	async upsert(params: CreateNotificationSettingParams): Promise<NotificationSetting> {
		const result = await db`
      INSERT INTO notification_settings (user_id, notification_type, channel, enabled)
      VALUES (${params.userId}, ${params.notificationType}, ${params.channel}, ${params.enabled})
      ON CONFLICT (user_id, notification_type, channel)
      DO UPDATE SET
        enabled = ${params.enabled},
        updated_at = NOW()
      RETURNING *
    `;
		return mapNotificationSetting(result[0]);
	},
};
