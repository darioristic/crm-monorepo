"use client";

import { BotIcon, Loader2Icon, RouteIcon, SparklesIcon, WrenchIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentState, AgentStatus } from "@/store/chat";

interface ChatStatusIndicatorsProps {
  agentState: AgentState;
  className?: string;
}

const STATUS_CONFIG: Record<AgentStatus, { icon: typeof BotIcon; label: string; color: string }> = {
  idle: {
    icon: BotIcon,
    label: "Ready",
    color: "text-muted-foreground",
  },
  routing: {
    icon: RouteIcon,
    label: "Routing to specialist...",
    color: "text-blue-500",
  },
  executing: {
    icon: SparklesIcon,
    label: "Processing...",
    color: "text-purple-500",
  },
  tool_calling: {
    icon: WrenchIcon,
    label: "Fetching data...",
    color: "text-orange-500",
  },
  generating: {
    icon: SparklesIcon,
    label: "Generating response...",
    color: "text-green-500",
  },
  complete: {
    icon: BotIcon,
    label: "Complete",
    color: "text-muted-foreground",
  },
};

export function ChatStatusIndicators({ agentState, className }: ChatStatusIndicatorsProps) {
  const config = STATUS_CONFIG[agentState.status];
  const _Icon = config.icon;

  if (agentState.status === "idle" || agentState.status === "complete") {
    return null;
  }

  return (
    <div
      className={cn("flex items-center gap-2 px-4 py-2 bg-muted/50 border-b text-sm", className)}
    >
      <Loader2Icon className={cn("h-4 w-4 animate-spin", config.color)} />
      <span className={cn("font-medium", config.color)}>{agentState.message || config.label}</span>
      {agentState.agentName && (
        <span className="text-muted-foreground">({agentState.agentName} agent)</span>
      )}
      {agentState.toolName && (
        <span className="text-muted-foreground">using {agentState.toolName}</span>
      )}
    </div>
  );
}
