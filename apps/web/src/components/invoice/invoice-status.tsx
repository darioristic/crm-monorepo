"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type InvoiceStatusType =
  | "draft"
  | "overdue"
  | "paid"
  | "unpaid"
  | "canceled"
  | "scheduled"
  | "sent";

const statusLabels: Record<InvoiceStatusType, string> = {
  draft: "Draft",
  overdue: "Overdue",
  paid: "Paid",
  unpaid: "Unpaid",
  canceled: "Canceled",
  scheduled: "Scheduled",
  sent: "Sent",
};

export function InvoiceStatus({
  status,
  isLoading,
  className,
  textOnly = false,
}: {
  status?: InvoiceStatusType;
  isLoading?: boolean;
  className?: string;
  textOnly?: boolean;
}) {
  if (isLoading) {
    return <Skeleton className="w-24 h-6 rounded-full" />;
  }

  if (!status) {
    return null;
  }

  // Text-only mode for PDF rendering
  if (textOnly) {
    return (
      <span
        className={cn(
          (status === "draft" || status === "canceled") && "text-[#878787] dark:text-[#878787]",
          status === "overdue" && "text-[#FFD02B] dark:text-[#FFD02B]",
          status === "paid" && "text-[#00C969] dark:text-[#00C969]",
          (status === "unpaid" || status === "sent") && "text-foreground",
          status === "scheduled" && "text-[#1F6FEB] dark:text-[#1F6FEB]",
          className
        )}
      >
        {statusLabels[status]}
      </span>
    );
  }

  return (
    <div
      className={cn(
        "px-2 py-0.5 rounded-full cursor-default inline-flex max-w-full text-[11px] font-medium",
        (status === "draft" || status === "canceled") &&
          "text-[#878787] bg-[#F2F1EF] dark:text-[#878787] dark:bg-[#1D1D1D]",
        status === "overdue" &&
          "bg-[#FFD02B]/10 text-[#FFD02B] dark:bg-[#FFD02B]/10 dark:text-[#FFD02B]",
        status === "paid" && "text-[#00C969] bg-[#DDF1E4] dark:text-[#00C969] dark:bg-[#00C969]/10",
        (status === "unpaid" || status === "sent") &&
          "text-[#1D1D1D] bg-[#878787]/10 dark:text-[#F5F5F3] dark:bg-[#F5F5F3]/10",
        status === "scheduled" &&
          "text-[#1F6FEB] bg-[#DDEBFF] dark:text-[#1F6FEB] dark:bg-[#1F6FEB]/10",
        className
      )}
    >
      <span className="line-clamp-1 truncate inline-block">{statusLabels[status]}</span>
    </div>
  );
}
