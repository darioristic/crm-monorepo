import type { ApiResponse } from "@crm/types";
import { errorResponse, successResponse } from "@crm/utils";
import { notificationSettingsQueries } from "../db/queries/notification-settings";
import { serviceLogger } from "../lib/logger";

export type NotificationSetting = {
  id: string;
  notificationType: string;
  channel: "in_app" | "email" | "push";
  enabled: boolean;
};

export type UpdateNotificationSettingRequest = {
  notificationType: string;
  channel: "in_app" | "email" | "push";
  enabled: boolean;
};

class NotificationSettingsService {
  async getSettings(userId: string): Promise<ApiResponse<NotificationSetting[]>> {
    try {
      const settings = await notificationSettingsQueries.findByUserId(userId);
      return successResponse(
        settings.map((s) => ({
          id: s.id,
          notificationType: s.notificationType,
          channel: s.channel,
          enabled: s.enabled,
        }))
      );
    } catch (error) {
      serviceLogger.error(error, "Error fetching notification settings:");
      return errorResponse("DATABASE_ERROR", "Failed to fetch notification settings");
    }
  }

  async updateSetting(
    userId: string,
    setting: UpdateNotificationSettingRequest
  ): Promise<ApiResponse<NotificationSetting>> {
    try {
      const updated = await notificationSettingsQueries.upsert({
        userId,
        notificationType: setting.notificationType,
        channel: setting.channel,
        enabled: setting.enabled,
      });
      return successResponse({
        id: updated.id,
        notificationType: updated.notificationType,
        channel: updated.channel,
        enabled: updated.enabled,
      });
    } catch (error) {
      serviceLogger.error(error, "Error updating notification setting:");
      return errorResponse("DATABASE_ERROR", "Failed to update notification setting");
    }
  }
}

export const notificationSettingsService = new NotificationSettingsService();
