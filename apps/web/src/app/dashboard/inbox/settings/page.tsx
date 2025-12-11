"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { InboxSettings } from "@/components/inbox/inbox-settings";
import { Button } from "@/components/ui/button";

export default function InboxSettingsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/inbox">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Inbox Settings</h1>
          <p className="text-muted-foreground text-sm">Manage email connections and blocklist</p>
        </div>
      </div>

      {/* Settings */}
      <InboxSettings />
    </div>
  );
}
