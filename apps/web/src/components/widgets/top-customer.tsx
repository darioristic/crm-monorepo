"use client";

import { UsersIcon } from "lucide-react";
import Link from "next/link";
import { BaseWidget } from "./base";

export function TopCustomerWidget() {
  return (
    <Link href="/dashboard/companies">
      <BaseWidget
        title="Top Customer"
        icon={<UsersIcon className="size-4" />}
        description={
          <div className="flex flex-col">
            <span className="text-lg font-medium text-foreground truncate">Acme Corporation</span>
            <span className="text-xs text-[#878787]">€45,000 lifetime value</span>
          </div>
        }
        actions="View customers →"
      />
    </Link>
  );
}
