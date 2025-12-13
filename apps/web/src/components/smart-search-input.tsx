"use client";

import { Loader2, Search, Sparkles, X } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { type FilterEntity, shouldUseAIFilter, useSmartFilter } from "@/hooks/use-smart-filter";
import { cn } from "@/lib/utils";

interface SmartSearchInputProps<T extends FilterEntity> {
  entity: T;
  placeholder?: string;
  onSearch?: (query: string) => void;
  onFiltersApplied?: (filters: Record<string, unknown>) => void;
  context?: {
    categories?: string[];
    tags?: string[];
    customers?: string[];
    industries?: string[];
    countries?: string[];
  };
  className?: string;
  showAIIndicator?: boolean;
}

export function SmartSearchInput<T extends FilterEntity>({
  entity,
  placeholder = "Search or describe what you're looking for...",
  onSearch,
  onFiltersApplied,
  context,
  className,
  showAIIndicator = true,
}: SmartSearchInputProps<T>) {
  const [value, setValue] = useState("");
  const [useAI, setUseAI] = useState(true);

  const { generateFilters, isLoading } = useSmartFilter({
    entity,
    context,
    onFilterApplied: (filters) => {
      onFiltersApplied?.(filters as Record<string, unknown>);
    },
  });

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!value.trim()) return;

      // If AI is enabled and query has multiple words, use AI filter
      if (useAI && shouldUseAIFilter(value)) {
        await generateFilters(value);
      } else {
        // Simple keyword search
        onSearch?.(value);
      }
    },
    [value, useAI, generateFilters, onSearch]
  );

  const handleClear = useCallback(() => {
    setValue("");
    onSearch?.("");
    onFiltersApplied?.({});
  }, [onSearch, onFiltersApplied]);

  const willUseAI = useAI && shouldUseAIFilter(value);

  return (
    <form onSubmit={handleSubmit} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className={cn("pl-9 pr-20", willUseAI && "border-primary/50")}
          disabled={isLoading}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleClear}
              disabled={isLoading}
            >
              <X className="h-3 w-3" />
            </Button>
          )}

          {showAIIndicator && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={useAI ? "default" : "ghost"}
                    size="icon"
                    className={cn(
                      "h-6 w-6",
                      useAI && "bg-primary/10 hover:bg-primary/20 text-primary"
                    )}
                    onClick={() => setUseAI(!useAI)}
                    disabled={isLoading}
                  >
                    <Sparkles className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>
                    {useAI
                      ? "AI Smart Search enabled - understands natural language"
                      : "Click to enable AI Smart Search"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        </div>
      </div>

      {willUseAI && !isLoading && (
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-primary" />
          AI will interpret your query
        </p>
      )}
    </form>
  );
}

export default SmartSearchInput;
