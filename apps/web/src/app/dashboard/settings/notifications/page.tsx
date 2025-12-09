"use client";

import { NotificationsSettingsList } from "@/components/notifications-settings-list";

export default function SettingsNotificationsPage() {
  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Notification Settings</h1>
      <NotificationsSettingsList />
    </main>
  );
}
