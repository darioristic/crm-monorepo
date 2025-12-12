"use client";

import { Check, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { InboxItem } from "@/lib/api/inbox";

type Props = {
  item: InboxItem;
};

export function InboxStatus({ item }: Props) {
  // Don't show status for processing items - let skeleton handle the visual feedback
  if (item.status === "processing" || item.status === "new") {
    return null;
  }

  if (item.status === "analyzing") {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex space-x-1 items-center p-1 text-[#878787] text-[10px] px-1.5 py-0.5 cursor-default border">
              <Loader2 className="size-3.5 animate-spin" />
              <span>Analyzing</span>
            </div>
          </TooltipTrigger>
          <TooltipContent sideOffset={10} className="text-xs">
            <p>
              We're reviewing the file and checking <br />
              for a matching transaction
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (item.status === "suggested_match") {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex space-x-1.5 items-center px-1.5 py-0.5 text-[10px] cursor-default border">
              <div className="w-1.5 h-1.5 bg-[#FFD02B] rounded-full" />
              <span>Suggested match</span>
            </div>
          </TooltipTrigger>
          <TooltipContent sideOffset={10} className="text-xs">
            <p>
              We found a possible match — confirm <br />
              or dismiss it
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (item.status === "pending") {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="p-1 text-[10px] px-1.5 py-0.5 cursor-default inline-block border">
              <span>Pending</span>
            </div>
          </TooltipTrigger>
          <TooltipContent sideOffset={10} className="text-xs">
            <p>
              We didn't find a match yet — we'll check <br />
              again when new transactions arrive
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (item.status === "done" || item.transactionId) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex space-x-1 items-center px-1.5 py-0.5 text-[10px] cursor-default border">
              <Check className="size-3.5 mt-[1px]" />
              <span>Matched</span>
            </div>
          </TooltipTrigger>
          <TooltipContent sideOffset={10} className="text-xs">
            <p>
              This file has been successfully <br />
              matched to a transaction
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // no_match or archived
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex space-x-1 items-center px-1.5 py-0.5 text-[10px] cursor-default border">
            <span>No match</span>
          </div>
        </TooltipTrigger>
        <TooltipContent sideOffset={10} className="text-xs">
          <p>
            We couldn't find a match — please <br />
            select the transaction manually
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
