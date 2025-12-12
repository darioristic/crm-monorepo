"use client";

import { ClockIcon } from "lucide-react";
import Link from "next/link";
import { BaseWidget } from "./base";

export function TimeTrackerWidget() {
  return (
    <Link href="/dashboard/projects">
      <BaseWidget
        title="Time Tracker"
        icon={<ClockIcon className="size-4" />}
        description={
          <div className="flex flex-col">
            <span className="text-2xl font-mono font-medium text-foreground">32h 45m</span>
            <span className="text-xs text-[#878787]">this week</span>
          </div>
        }
        actions="Track time →"
      />
    </Link>
  );
}
