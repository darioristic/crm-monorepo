"use client";

import { ExpandIcon, Loader2Icon, MinimizeIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ArtifactStage, ArtifactType } from "@/lib/artifact-config";
import { getArtifactConfig, getStageMessage } from "@/lib/artifact-config";
import { cn } from "@/lib/utils";

interface BaseCanvasProps {
  type: ArtifactType;
  stage?: ArtifactStage;
  isLoading?: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  className?: string;
}

export function BaseCanvas({
  type,
  stage = "analysis_ready",
  isLoading = false,
  onClose,
  children,
  className,
}: BaseCanvasProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = getArtifactConfig(type);

  return (
    <div
      className={cn(
        "fixed top-0 right-0 h-full bg-background border-l shadow-xl z-50",
        "transition-all duration-300 ease-in-out",
        isExpanded ? "w-full md:w-[80%]" : "w-full md:w-[500px] lg:w-[600px]",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="text-primary text-sm">📊</span>
          </div>
          <div>
            <h3 className="font-semibold">{config.title}</h3>
            <p className="text-xs text-muted-foreground">{config.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(!isExpanded)}
            className="hidden md:flex"
          >
            {isExpanded ? <MinimizeIcon className="h-4 w-4" /> : <ExpandIcon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && stage !== "analysis_ready" && (
        <div className="px-4 py-2 bg-muted/50 border-b flex items-center gap-2 text-sm">
          <Loader2Icon className="h-4 w-4 animate-spin text-primary" />
          <span className="text-muted-foreground">{getStageMessage(stage)}</span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 h-[calc(100%-70px)]">{children}</div>
    </div>
  );
}
