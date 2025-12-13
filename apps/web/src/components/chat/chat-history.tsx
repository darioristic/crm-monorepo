"use client";

import { formatDistanceToNow } from "date-fns";
import { MessageSquareIcon, PlusIcon, SearchIcon, TrashIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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

// Sheet-based history (sidebar)
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
                    type="button"
                    key={session.id}
                    onClick={() => onSelectChat(session.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg transition-colors group cursor-pointer",
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
                          {formatDistanceToNow(new Date(session.updatedAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => handleDelete(e, session.id)}
                      >
                        <span>
                          <TrashIcon className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </span>
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

// Dropdown-based history (Midday style)
interface ChatHistoryDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectChat: (id: string) => void;
}

export function ChatHistoryDropdown({ isOpen, onClose, onSelectChat }: ChatHistoryDropdownProps) {
  const { sessions, deleteSession } = useChatStore();
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredSessions = sessions.filter(
    (session) =>
      session.title.toLowerCase().includes(search.toLowerCase()) ||
      session.messages.some((m) => m.content.toLowerCase().includes(search.toLowerCase()))
  );

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setSelectedIndex(-1);
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || filteredSessions.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev < filteredSessions.length - 1 ? prev + 1 : prev));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0 && filteredSessions[selectedIndex]) {
            onSelectChat(filteredSessions[selectedIndex].id);
            onClose();
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [isOpen, filteredSessions, selectedIndex, onSelectChat, onClose]
  );

  const handleDelete = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    deleteSession(sessionId);
  };

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute bottom-full left-0 right-0 mb-2 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200"
    >
      <div className="bg-popover/95 backdrop-blur-lg border rounded-lg shadow-lg overflow-hidden max-h-80 flex flex-col">
        {/* Search input */}
        <div className="p-2 border-b flex-shrink-0 sticky top-0 bg-popover/95 backdrop-blur-lg z-10">
          <div className="relative">
            <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder="Search history..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedIndex(-1);
              }}
              onKeyDown={handleKeyDown}
              className="pl-8 h-8 text-sm bg-muted/50 border-0 focus-visible:ring-0"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={onClose}
            >
              <XIcon className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Chat list */}
        <div className="overflow-y-auto flex-1 min-h-0 max-h-64 overscroll-contain">
          <div className="p-2 pt-0">
            {filteredSessions.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">
                  {search ? "No chats found" : "No chat history"}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredSessions.map((session, index) => (
                  <div
                    key={session.id}
                    data-index={index}
                    className={cn(
                      "group relative flex items-center justify-between px-2 py-2 text-sm transition-colors rounded-md",
                      selectedIndex === index ? "bg-accent" : "hover:bg-muted"
                    )}
                  >
                    <button
                      type="button"
                      className="flex-1 min-w-0 text-left"
                      onClick={() => {
                        onSelectChat(session.id);
                        onClose();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectChat(session.id);
                          onClose();
                        }
                      }}
                    >
                      <span className="text-foreground/80 line-clamp-1">
                        {session.title || "New chat"}
                      </span>
                    </button>
                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => handleDelete(e, session.id)}
                        title="Delete chat"
                      >
                        <TrashIcon className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Keyboard hints */}
        <div className="p-2 border-t bg-muted/30 text-xs text-muted-foreground flex-shrink-0">
          <kbd className="px-1 bg-background rounded">↑↓</kbd> navigate{" "}
          <kbd className="px-1 bg-background rounded">Enter</kbd> select{" "}
          <kbd className="px-1 bg-background rounded">Esc</kbd> close
        </div>
      </div>
    </div>
  );
}
