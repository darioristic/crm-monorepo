"use client";

import type { Invoice } from "@crm/types";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type ActivityItemProps = {
  label: string;
  date?: string | null;
  completed: boolean;
  isLast?: boolean;
};

function ActivityItem({ label, date, completed, isLast }: ActivityItemProps) {
  return (
    <li className="relative pb-6 last:pb-0">
      {!isLast && (
        <div className="absolute left-[3px] top-[20px] bottom-0 border-[0.5px] border-border" />
      )}

      <div className="flex items-center gap-3">
        <div
          className={cn(
            "relative z-10 flex size-[7px] items-center justify-center rounded-full border border-border",
            completed && "bg-[#666666] border-[#666666]"
          )}
        />

        <div className="flex flex-1 items-center justify-between">
          <span className={cn("text-sm", completed ? "text-primary" : "text-[#666666]")}>
            {label}
          </span>

          <span className="text-sm text-[#666666]">
            {date && format(new Date(date), "MMM d, HH:mm")}
          </span>
        </div>
      </div>
    </li>
  );
}

interface InvoiceActivityProps {
  invoice: Invoice;
}

export function InvoiceActivity({ invoice }: InvoiceActivityProps) {
  const isPaid = invoice.paidAt !== null && invoice.paidAt !== undefined;
  const isCancelled = invoice.status === "cancelled";
  const isScheduled = invoice.status === "scheduled";

  return (
    <ul>
      {/* Created */}
      {invoice.createdAt && <ActivityItem label="Created" date={invoice.createdAt} completed />}

      {/* Scheduled - show if invoice is scheduled */}
      {invoice.scheduledAt && isScheduled && (
        <ActivityItem label="Scheduled" date={invoice.scheduledAt} completed={!!invoice.sentAt} />
      )}

      {/* Sent */}
      {invoice.sentAt && <ActivityItem label="Sent" date={invoice.sentAt} completed />}

      {/* Viewed */}
      {invoice.viewedAt && <ActivityItem label="Viewed" date={invoice.viewedAt} completed />}

      {/* Paid - show if not cancelled */}
      {!isCancelled && (
        <ActivityItem label="Paid" date={invoice.paidAt} completed={isPaid} isLast />
      )}

      {/* Cancelled */}
      {isCancelled && <ActivityItem label="Cancelled" date={invoice.updatedAt} completed isLast />}
    </ul>
  );
}
