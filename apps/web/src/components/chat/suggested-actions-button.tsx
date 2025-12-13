"use client";

import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/chat";
import { Icons } from "./icons";

export function SuggestedActionsButton() {
  const { showCommands, handleInputChange, input } = useChatStore();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Toggle command menu by adding/removing / prefix
    if (showCommands) {
      handleInputChange(input.startsWith("/") ? input.slice(1) : input);
    } else {
      handleInputChange(input.startsWith("/") ? input : `/${input}`);
    }

    // Focus textarea for keyboard navigation when opening
    if (!showCommands) {
      requestAnimationFrame(() => {
        document.querySelector("textarea")?.focus();
      });
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center h-6 cursor-pointer transition-colors duration-200"
      data-suggested-actions-toggle
      title="Show commands"
    >
      <Icons.Bolt
        size={16}
        className={cn(
          "transition-colors",
          showCommands
            ? "text-foreground"
            : "text-[#707070] hover:text-[#999999] dark:text-[#666666] dark:hover:text-[#999999]"
        )}
      />
    </button>
  );
}
