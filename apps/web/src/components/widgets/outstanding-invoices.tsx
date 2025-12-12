"use client";

import { FileTextIcon } from "lucide-react";
import Link from "next/link";
import { BaseWidget } from "./base";

export function OutstandingInvoicesWidget() {
  return (
    <Link href="/dashboard/sales/invoices?status=pending">
      <BaseWidget
        title="Outstanding Invoices"
        icon={<FileTextIcon className="size-4" />}
        description={
          <div className="flex flex-col">
            <span className="text-2xl font-mono font-medium text-foreground">€12,450</span>
            <span className="text-xs text-[#878787]">5 invoices pending</span>
          </div>
        }
        actions="View invoices →"
      />
    </Link>
  );
}
