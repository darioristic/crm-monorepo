"use client";

import { ArrowLeftIcon, HistoryIcon, PlusIcon, SparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface ChatHeaderProps {
  onNewChat?: () => void;
  onViewHistory?: () => void;
  showNavigation?: boolean;
}

export function ChatHeader({ onNewChat, onViewHistory, showNavigation }: ChatHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between border-b px-4 py-3">
      <div className="flex items-center gap-2">
        {showNavigation && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/chat")}
            title="Back to home"
            className="mr-2"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Button>
        )}
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
          <SparklesIcon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="font-semibold">AI Assistant</h1>
          <p className="text-xs text-muted-foreground">Powered by GPT-4o</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onNewChat} title="New Chat">
          <PlusIcon className="h-4 w-4" />
        </Button>

        <Button variant="ghost" size="icon" onClick={onViewHistory} title="Chat History">
          <HistoryIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
