"use client";

import { formatDistanceToNow } from "date-fns";
import { MessageSquareIcon, PlusIcon, SearchIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { ChatSession } from "@/store/chat";
import { useChatStore } from "@/store/chat";

interface ChatHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: ChatSession[];
  currentChatId: string;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
}

export function ChatHistory({
  open,
  onOpenChange,
  sessions,
  currentChatId,
  onSelectChat,
  onNewChat,
}: ChatHistoryProps) {
  const [search, setSearch] = useState("");
  const { deleteSession } = useChatStore();

  const filteredSessions = sessions.filter(
    (session) =>
      session.title.toLowerCase().includes(search.toLowerCase()) ||
      session.messages.some((m) => m.content.toLowerCase().includes(search.toLowerCase()))
  );

  const handleDelete = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    deleteSession(sessionId);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-80 p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle>Chat History</SheetTitle>
          <SheetDescription>Your previous conversations</SheetDescription>
        </SheetHeader>

        <div className="p-4 border-b">
          <Button onClick={onNewChat} className="w-full" variant="outline">
            <PlusIcon className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        </div>

        <div className="p-4 border-b">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search chats..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-220px)]">
          <div className="p-2">
            {filteredSessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquareIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No conversations yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredSessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => onSelectChat(session.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg transition-colors group",
                      "hover:bg-muted",
                      currentChatId === session.id && "bg-muted"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{session.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {session.messages.length} messages
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => handleDelete(e, session.id)}
                      >
                        <TrashIcon className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
