"use client";

import { PlusIcon, SendIcon, SlashIcon, StopCircleIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { CommandSuggestion } from "@/store/chat";
import { ChatHistoryButton } from "./chat-history-button";
import { RecordButton } from "./record-button";
import { SuggestedActionsButton } from "./suggested-actions-button";
import { WebSearchButton } from "./web-search-button";

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
  onHistoryClick?: () => void;
  showHistoryButton?: boolean;
  isHistoryOpen?: boolean;
  onAddAttachment?: () => void;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  onKeyDown,
  isLoading,
  onStop,
  placeholder = "Ask anything",
  className,
  showCommands,
  commands = [],
  selectedCommandIndex = 0,
  onCommandSelect,
  onHistoryClick,
  showHistoryButton = true,
  isHistoryOpen = false,
  onAddAttachment,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 55)}px`;
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

  const handleTranscription = (text: string) => {
    onChange(value ? `${value} ${text}` : text);
  };

  return (
    <form onSubmit={onSubmit} className={cn("relative", className)}>
      {/* Command Menu */}
      {showCommands && commands.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-popover/95 backdrop-blur-lg border rounded-lg shadow-lg overflow-hidden z-50">
          <div className="p-2 border-b bg-muted/30">
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
          <div className="p-2 border-t bg-muted/30 text-xs text-muted-foreground">
            <kbd className="px-1 bg-background rounded">↑↓</kbd> navigate{" "}
            <kbd className="px-1 bg-background rounded">Enter</kbd> select{" "}
            <kbd className="px-1 bg-background rounded">Esc</kbd> close
          </div>
        </div>
      )}

      {/* Main Input Container - Midday Style */}
      <div className="w-full overflow-hidden bg-[#F7F7F7] dark:bg-[#131313] rounded-xl">
        {/* Textarea */}
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "w-full resize-none rounded-none border-none p-3 pt-4 shadow-none outline-none ring-0 text-sm",
            "field-sizing-content bg-transparent dark:bg-transparent placeholder:text-[rgba(102,102,102,0.5)]",
            "max-h-[55px] min-h-[55px]",
            "focus-visible:ring-0"
          )}
          rows={1}
          disabled={isLoading}
        />

        {/* Toolbar - Midday Style */}
        <div className="flex items-center justify-between px-3 pb-2">
          {/* Left Tools */}
          <div className="flex items-center gap-3.5">
            {/* Add Attachment Button */}
            <button
              type="button"
              onClick={onAddAttachment}
              className="flex items-center h-6 cursor-pointer transition-colors duration-200"
              title="Add attachment"
            >
              <PlusIcon
                size={16}
                className="text-[#707070] hover:text-[#999999] dark:text-[#666666] dark:hover:text-[#999999] transition-colors"
              />
            </button>

            {/* Suggested Actions Button (Lightning) */}
            <SuggestedActionsButton />

            {/* Web Search Button (Globe) */}
            <WebSearchButton />

            {/* Chat History Button */}
            {showHistoryButton && onHistoryClick && (
              <ChatHistoryButton isOpen={isHistoryOpen} onClick={onHistoryClick} />
            )}
          </div>

          {/* Right Tools */}
          <div className="flex items-center gap-3.5">
            {/* Record Button */}
            <RecordButton disabled={isLoading} onTranscription={handleTranscription} size={16} />

            {/* Submit/Stop Button */}
            {isLoading ? (
              <Button
                type="button"
                size="icon"
                variant="default"
                onClick={onStop}
                className="h-8 w-8 shrink-0"
              >
                <StopCircleIcon className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                disabled={!value.trim()}
                className={cn(
                  "h-8 w-8 shrink-0 rounded-md transition-colors",
                  value.trim()
                    ? "bg-foreground text-background hover:bg-foreground/90"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <SendIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
