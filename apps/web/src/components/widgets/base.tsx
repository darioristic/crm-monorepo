"use client";

import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface BaseWidgetProps {
  title: string;
  description: React.ReactNode;
  onClick?: () => void;
  actions: React.ReactNode;
  icon: React.ReactNode;
  children?: React.ReactNode;
  onConfigure?: () => void;
}

export function BaseWidget({
  children,
  onClick,
  title,
  description,
  actions,
  icon,
  onConfigure,
}: BaseWidgetProps) {
  return (
    <button
      type="button"
      className={cn(
        "dark:bg-[#121212] bg-card border dark:border-[#1c1c1c] p-4 h-[210px] flex flex-col justify-between transition-all duration-300 dark:hover:bg-[#1a1a1a] dark:hover:border-[#262626] hover:border-border/80 group cursor-pointer"
      )}
      onClick={onClick}
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[#878787]">{icon}</span>
            <h3 className="text-xs text-[#878787] font-medium">{title}</h3>
          </div>
          {onConfigure && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onConfigure();
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-[#878787] hover:text-primary"
            >
              <Settings className="size-3.5" />
            </button>
          )}
        </div>

        {typeof description === "string" ? (
          <p className="text-sm text-[#878787]">{description}</p>
        ) : (
          description
        )}
      </div>

      <div>
        {children}

        <span className="text-xs text-[#878787] group-hover:text-primary transition-colors duration-300">
          {actions}
        </span>
      </div>
    </button>
  );
}
