import { NotificationsSettingsList } from "@/components/notifications-settings-list";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Notifications",
};

export default async function NotificationsPage() {
	return (
		<div className="space-y-12">
			<NotificationsSettingsList />
		</div>
	);
}
