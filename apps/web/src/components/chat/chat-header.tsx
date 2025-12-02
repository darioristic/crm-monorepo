"use client";

import { Button } from "@/components/ui/button";
import { PlusIcon, HistoryIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ChatHeaderProps {
  onNewChat?: () => void;
  onViewHistory?: () => void;
}

export function ChatHeader({ onNewChat, onViewHistory }: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
          <span className="text-lg">🤖</span>
        </div>
        <div>
          <h1 className="font-semibold">AI Assistant</h1>
          <p className="text-xs text-muted-foreground">Powered by GPT-4o</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onNewChat}
          title="New Chat"
        >
          <PlusIcon className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" title="Chat History">
              <HistoryIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem onClick={onViewHistory}>
              View Chat History
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

