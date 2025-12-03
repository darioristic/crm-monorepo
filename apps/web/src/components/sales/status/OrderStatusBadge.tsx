"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type OrderStatus = "pending" | "processing" | "completed" | "cancelled" | "refunded";

const statusConfig: Record<
  OrderStatus,
  { variant: "secondary" | "default" | "success" | "warning" | "destructive" | "outline"; label: string; description: string }
> = {
  pending: {
    variant: "warning",
    label: "Pending",
    description: "Order is pending and awaiting processing",
  },
  processing: {
    variant: "default",
    label: "Processing",
    description: "Order is being processed",
  },
  completed: {
    variant: "success",
    label: "Completed",
    description: "Order has been completed",
  },
  cancelled: {
    variant: "outline",
    label: "Cancelled",
    description: "Order has been cancelled",
  },
  refunded: {
    variant: "destructive",
    label: "Refunded",
    description: "Order has been refunded",
  },
};

interface OrderStatusBadgeProps {
  status: OrderStatus;
  size?: "sm" | "default" | "lg";
  showTooltip?: boolean;
  className?: string;
}

export function OrderStatusBadge({
  status,
  size = "default",
  showTooltip = true,
  className,
}: OrderStatusBadgeProps) {
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

