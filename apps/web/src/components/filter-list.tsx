"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface Filter {
  id: string;
  name: string;
  type: "tag" | "date" | "status" | "custom";
  value: string;
}

interface FilterListProps {
  filters: Filter[];
  onRemove: (filterId: string) => void;
  onClearAll?: () => void;
  className?: string;
}

export function FilterList({ filters, onRemove, onClearAll, className }: FilterListProps) {
  if (!filters.length) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {filters.map((filter) => (
        <div
          key={filter.id}
          className="flex items-center gap-1.5 h-7 px-2.5 text-xs bg-secondary text-secondary-foreground rounded-full"
        >
          <span className="text-muted-foreground capitalize">{filter.type}:</span>
          <span>{filter.name}</span>
          <button
            type="button"
            onClick={() => onRemove(filter.id)}
            className="ml-0.5 hover:text-destructive transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}

      {filters.length > 1 && onClearAll && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
        >
          Clear all
        </Button>
      )}
    </div>
  );
}
