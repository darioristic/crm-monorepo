"use client";

import { cn } from "@/lib/utils";
import { Icons } from "./icons";

interface ChatHistoryButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

export function ChatHistoryButton({ isOpen, onClick }: ChatHistoryButtonProps) {
  return (
    <button
      type="button"
      data-chat-history-button
      onClick={onClick}
      className={cn(
        "flex items-center h-6 cursor-pointer transition-colors duration-200",
        isOpen
          ? "bg-[rgba(0,0,0,0.05)] hover:bg-[rgba(0,0,0,0.08)] dark:bg-[rgba(255,255,255,0.05)] dark:hover:bg-[rgba(255,255,255,0.08)] rounded-full"
          : "hover:bg-[rgba(0,0,0,0.05)] dark:hover:bg-[rgba(255,255,255,0.05)]"
      )}
      title="Chat history"
    >
      <span className="w-6 h-6 flex items-center justify-center">
        <Icons.History
          size={16}
          className={cn(
            "transition-colors",
            isOpen
              ? "text-foreground"
              : "text-[#707070] hover:text-[#999999] dark:text-[#666666] dark:hover:text-[#999999]"
          )}
        />
      </span>
    </button>
  );
}
