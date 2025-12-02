"use client";

import { UserAvatar } from "@/components/settings/user-avatar";
import { DisplayName } from "@/components/settings/display-name";

export default function AccountSettingsPage() {
	return (
		<div className="space-y-6">
			<UserAvatar />
			<DisplayName />
		</div>
	);
}
