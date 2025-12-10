"use client";

import { DisplayName } from "@/components/settings/display-name";
import { UserAvatar } from "@/components/settings/user-avatar";

export default function AccountSettingsPage() {
  return (
    <div className="space-y-6">
      <UserAvatar />
      <DisplayName />
    </div>
  );
}
