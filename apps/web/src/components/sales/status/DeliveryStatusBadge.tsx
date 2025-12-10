"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type DeliveryStatus = "pending" | "in_transit" | "delivered" | "returned";

const statusConfig: Record<
  DeliveryStatus,
  {
    variant: "secondary" | "default" | "success" | "destructive";
    label: string;
    description: string;
  }
> = {
  pending: {
    variant: "secondary",
    label: "Pending",
    description: "Delivery is being prepared for shipment",
  },
  in_transit: {
    variant: "default",
    label: "In Transit",
    description: "Package is on its way to the destination",
  },
  delivered: {
    variant: "success",
    label: "Delivered",
    description: "Package has been successfully delivered",
  },
  returned: {
    variant: "destructive",
    label: "Returned",
    description: "Package was returned to sender",
  },
};

interface DeliveryStatusBadgeProps {
  status: DeliveryStatus;
  size?: "sm" | "default" | "lg";
  showTooltip?: boolean;
  className?: string;
}

export function DeliveryStatusBadge({
  status,
  size = "default",
  showTooltip = true,
  className,
}: DeliveryStatusBadgeProps) {
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
      {config.label.replace("_", " ")}
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
