"use client";

import { Suspense } from "react";
import {
  NotificationSettings,
  NotificationSettingsSkeleton,
} from "@/components/notification-settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function NotificationsSettingsList() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Manage your personal notification settings for this team.</CardDescription>
      </CardHeader>

      <CardContent>
        <Suspense fallback={<NotificationSettingsSkeleton />}>
          <NotificationSettings />
        </Suspense>
      </CardContent>
    </Card>
  );
}
