"use client";

import { AlertTriangleIcon } from "lucide-react";
import Link from "next/link";
import { BaseWidget } from "./base";

export function OverdueInvoicesAlertWidget() {
  return (
    <Link href="/dashboard/sales/invoices?status=overdue">
      <BaseWidget
        title="Overdue Invoices"
        icon={<AlertTriangleIcon className="size-4 text-destructive" />}
        description={
          <div className="flex flex-col">
            <span className="text-2xl font-mono font-medium text-destructive">€3,200</span>
            <span className="text-xs text-[#878787]">2 invoices overdue</span>
          </div>
        }
        actions="Take action →"
      />
    </Link>
  );
}
