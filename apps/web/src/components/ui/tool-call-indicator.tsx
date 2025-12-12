"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TextShimmer } from "./text-shimmer";

type ToolCallStatus = "pending" | "running" | "completed" | "error";

interface ToolCallIndicatorProps {
  toolName: string;
  status?: ToolCallStatus;
  className?: string;
}

const statusConfig = {
  pending: {
    icon: Loader2,
    iconClass: "animate-spin text-muted-foreground",
    useShimmer: true,
  },
  running: {
    icon: Loader2,
    iconClass: "animate-spin text-primary",
    useShimmer: true,
  },
  completed: {
    icon: CheckCircle2,
    iconClass: "text-green-500",
    useShimmer: false,
  },
  error: {
    icon: AlertCircle,
    iconClass: "text-destructive",
    useShimmer: false,
  },
};

export function ToolCallIndicator({
  toolName,
  status = "running",
  className,
}: ToolCallIndicatorProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm",
        className
      )}
    >
      <Icon className={cn("size-4", config.iconClass)} />
      {config.useShimmer ? (
        <TextShimmer duration={1.5}>{toolName}</TextShimmer>
      ) : (
        <span className="text-muted-foreground">{toolName}</span>
      )}
    </div>
  );
}
