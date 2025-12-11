"use client";

import { format } from "date-fns";
import { forwardRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useInboxParams } from "@/hooks/use-inbox-params";
import type { InboxItem as InboxItemType } from "@/lib/api/inbox";
import { cn, formatCurrency } from "@/lib/utils";
import { InboxStatus } from "./inbox-status";

type Props = {
  item: InboxItemType;
  index: number;
};

export const InboxItem = forwardRef<HTMLButtonElement, Props>(
  function InboxItem({ item, index }, ref) {
    const { params, setParams } = useInboxParams();

    const isSelected =
      params.inboxId === item.id || (!params.inboxId && index === 0);
    const isProcessing = item.status === "processing" || item.status === "new";

    return (
      <button
        ref={ref}
        type="button"
        onClick={() => {
          setParams({ inboxId: item.id });
        }}
        key={item.id}
        className={cn(
          "flex flex-col w-full items-start gap-2 border p-4 text-left text-sm h-[90px]",
          isSelected && "bg-accent border-[#DCDAD2] dark:border-[#2C2C2C]",
        )}
      >
        <div className="flex w-full flex-col gap-1">
          <div className="flex items-center mb-1">
            <div className="flex items-center gap-2">
              <div className="flex items-center space-x-2 select-text">
                <div className="font-semibold">
                  {isProcessing ? (
                    <Skeleton className="h-3 w-[120px] mb-1" />
                  ) : (
                    item.displayName
                  )}
                </div>
              </div>
            </div>
            <div
              className={cn(
                "ml-auto text-xs select-text",
                isSelected ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {isProcessing && <Skeleton className="h-3 w-[50px]" />}
              {!isProcessing &&
                item?.date &&
                format(new Date(item.date), "MMM d")}
            </div>
          </div>

          <div className="flex">
            <div className="text-xs font-medium select-text">
              {isProcessing && <Skeleton className="h-3 w-[50px]" />}
              {!isProcessing && item?.currency && (
                <span>{formatCurrency(item.amount ?? 0, item.currency)}</span>
              )}
            </div>

            <div className="ml-auto">
              {isProcessing ? (
                <Skeleton className="h-4 w-[60px]" />
              ) : (
                <InboxStatus item={item} />
              )}
            </div>
          </div>
        </div>
      </button>
    );
  },
);
