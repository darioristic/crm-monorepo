"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Suspense } from "react";
import { ErrorFallback } from "@/components/error-fallback";
import {
	NotificationSettings,
	NotificationSettingsSkeleton,
} from "@/components/notification-settings";

export function NotificationsSettingsList() {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Notifications</CardTitle>
				<CardDescription>
					Manage your personal notification settings for this team.
				</CardDescription>
			</CardHeader>

			<CardContent>
				<Suspense fallback={<NotificationSettingsSkeleton />}>
					<NotificationSettings />
				</Suspense>
			</CardContent>
		</Card>
	);
}
