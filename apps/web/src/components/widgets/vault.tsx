"use client";

import { FolderIcon } from "lucide-react";
import Link from "next/link";
import { BaseWidget } from "./base";

export function VaultWidget() {
  return (
    <Link href="/dashboard/inbox">
      <BaseWidget
        title="Vault"
        icon={<FolderIcon className="size-4" />}
        description={
          <div className="flex flex-col">
            <span className="text-2xl font-mono font-medium text-foreground">24</span>
            <span className="text-xs text-[#878787]">documents stored</span>
          </div>
        }
        actions="Open vault →"
      />
    </Link>
  );
}
