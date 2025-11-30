"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

const statusConfig: Record<
  QuoteStatus,
  { variant: "secondary" | "default" | "success" | "destructive" | "outline"; label: string; description: string }
> = {
  draft: {
    variant: "secondary",
    label: "Draft",
    description: "Quote is being prepared and not yet sent to customer",
  },
  sent: {
    variant: "default",
    label: "Sent",
    description: "Quote has been sent to the customer and awaiting response",
  },
  accepted: {
    variant: "success",
    label: "Accepted",
    description: "Customer has accepted this quote",
  },
  rejected: {
    variant: "destructive",
    label: "Rejected",
    description: "Customer has rejected this quote",
  },
  expired: {
    variant: "outline",
    label: "Expired",
    description: "Quote validity period has ended",
  },
};

interface QuoteStatusBadgeProps {
  status: QuoteStatus;
  size?: "sm" | "default" | "lg";
  showTooltip?: boolean;
  className?: string;
}

export function QuoteStatusBadge({
  status,
  size = "default",
  showTooltip = true,
  className,
}: QuoteStatusBadgeProps) {
  const config = statusConfig[status] || { variant: "outline" as const, label: status, description: "Unknown status" };

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0",
    default: "",
    lg: "text-sm px-3 py-1",
  };

  const badge = (
    <Badge
      variant={config.variant}
      className={cn("capitalize", sizeClasses[size], className)}
    >
      {config.label}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs text-sm">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

