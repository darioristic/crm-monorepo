"use client";

import { WalletIcon } from "lucide-react";
import Link from "next/link";
import { BaseWidget } from "./base";

export function MonthlySpendingWidget() {
  return (
    <Link href="/dashboard/reports">
      <BaseWidget
        title="Monthly Spending"
        icon={<WalletIcon className="size-4" />}
        description={
          <div className="flex flex-col">
            <span className="text-2xl font-mono font-medium text-foreground">€8,320</span>
            <span className="text-xs text-[#878787]">-12% vs last month</span>
          </div>
        }
        actions="View breakdown →"
      />
    </Link>
  );
}
