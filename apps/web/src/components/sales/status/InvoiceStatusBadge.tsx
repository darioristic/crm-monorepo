"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type InvoiceStatus = "draft" | "sent" | "paid" | "partial" | "overdue" | "cancelled";

const statusConfig: Record<
  InvoiceStatus,
  {
    variant: "secondary" | "default" | "success" | "warning" | "destructive" | "outline";
    label: string;
    description: string;
  }
> = {
  draft: {
    variant: "secondary",
    label: "Draft",
    description: "Invoice is being prepared and not yet sent",
  },
  sent: {
    variant: "default",
    label: "Sent",
    description: "Invoice has been sent to the customer",
  },
  paid: {
    variant: "success",
    label: "Paid",
    description: "Invoice has been fully paid",
  },
  partial: {
    variant: "warning",
    label: "Partial",
    description: "Invoice has been partially paid",
  },
  overdue: {
    variant: "destructive",
    label: "Overdue",
    description: "Payment deadline has passed",
  },
  cancelled: {
    variant: "outline",
    label: "Cancelled",
    description: "Invoice has been cancelled",
  },
};

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
  size?: "sm" | "default" | "lg";
  showTooltip?: boolean;
  className?: string;
}

export function InvoiceStatusBadge({
  status,
  size = "default",
  showTooltip = true,
  className,
}: InvoiceStatusBadgeProps) {
  const config = statusConfig[status] || {
    variant: "outline" as const,
    label: status,
    description: "Unknown status",
  };

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0",
    default: "",
    lg: "text-sm px-3 py-1",
  };

  const badge = (
    <Badge variant={config.variant} className={cn("capitalize", sizeClasses[size], className)}>
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
