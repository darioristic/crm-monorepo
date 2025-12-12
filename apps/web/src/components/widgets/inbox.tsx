"use client";

import { InboxIcon } from "lucide-react";
import Link from "next/link";
import { BaseWidget } from "./base";

export function InboxWidget() {
  return (
    <Link href="/dashboard/inbox">
      <BaseWidget
        title="Inbox"
        icon={<InboxIcon className="size-4" />}
        description={
          <div className="flex flex-col">
            <span className="text-2xl font-mono font-medium text-foreground">3</span>
            <span className="text-xs text-[#878787]">items to review</span>
          </div>
        }
        actions="View inbox →"
      />
    </Link>
  );
}
