"use client";

import { SendIcon, SlashIcon, StopCircleIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { CommandSuggestion } from "@/store/chat";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  isLoading?: boolean;
  onStop?: () => void;
  placeholder?: string;
  className?: string;
  showCommands?: boolean;
  commands?: CommandSuggestion[];
  selectedCommandIndex?: number;
  onCommandSelect?: (command: CommandSuggestion) => void;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  onKeyDown,
  isLoading,
  onStop,
  placeholder = "Ask me anything about your business... (type / for commands)",
  className,
  showCommands,
  commands = [],
  selectedCommandIndex = 0,
  onCommandSelect,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Let parent handle command navigation
    if (onKeyDown) {
      onKeyDown(e);
      if (e.defaultPrevented) return;
    }

    if (e.key === "Enter" && !e.shiftKey && !showCommands) {
      e.preventDefault();
      onSubmit(e);
    }
  };

  return (
    <form onSubmit={onSubmit} className={cn("relative", className)}>
      {/* Command Menu */}
      {showCommands && commands.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-popover border rounded-lg shadow-lg overflow-hidden z-50">
          <div className="p-2 border-b bg-muted/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <SlashIcon className="h-3 w-3" />
              <span>Commands</span>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {commands.map((cmd, index) => (
              <button
                key={cmd.command}
                type="button"
                onClick={() => onCommandSelect?.(cmd)}
                className={cn(
                  "w-full text-left px-3 py-2 flex items-center gap-3 transition-colors",
                  index === selectedCommandIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted"
                )}
              >
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                  {cmd.command}
                </code>
                <span className="text-sm">{cmd.title}</span>
              </button>
            ))}
          </div>
          <div className="p-2 border-t bg-muted/50 text-xs text-muted-foreground">
            <kbd className="px-1 bg-background rounded">↑↓</kbd> navigate{" "}
            <kbd className="px-1 bg-background rounded">Enter</kbd> select{" "}
            <kbd className="px-1 bg-background rounded">Esc</kbd> close
          </div>
        </div>
      )}

      <div className="relative flex items-end gap-2 rounded-xl border bg-background p-2 shadow-sm focus-within:ring-1 focus-within:ring-ring">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="min-h-[44px] max-h-[200px] resize-none border-0 bg-transparent p-2 focus-visible:ring-0 focus-visible:ring-offset-0"
          rows={1}
          disabled={isLoading}
        />

        <div className="flex items-center gap-1 pb-1">
          {isLoading ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onStop}
              className="h-8 w-8 shrink-0"
            >
              <StopCircleIcon className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!value.trim()} className="h-8 w-8 shrink-0">
              <SendIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
