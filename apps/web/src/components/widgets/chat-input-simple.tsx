"use client";

import { ArrowUpRight, History, Loader2, MessageSquare, Send, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import Markdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/chat";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function ChatInputSimple() {
  const [value, setValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [chatId] = useState(() => crypto.randomUUID());

  const { createSession, addMessageToSession } = useChatStore();

  const sendMessage = useCallback(
    async (userMessage: string) => {
      setIsLoading(true);
      setIsExpanded(true);

      // Add user message
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: userMessage,
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: chatId,
            messages: [{ role: "user", content: userMessage }],
          }),
        });

        if (!response.ok) {
          throw new Error(`Chat request failed: ${response.status}`);
        }

        const text = await response.text();

        // Parse AI SDK data stream format: 0:"text"\n
        let assistantContent = "";
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.startsWith("0:")) {
            try {
              assistantContent += JSON.parse(line.slice(2));
            } catch {
              // ignore parse errors
            }
          }
        }

        if (assistantContent) {
          const assistantMsg: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: assistantContent,
          };
          setMessages((prev) => [...prev, assistantMsg]);
        }
      } catch (error) {
        console.error("[DashboardChat] Error:", error);
        const errorMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Sorry, I couldn't process your request. Please try again.",
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [chatId]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || isLoading) return;

    sendMessage(value);
    setValue("");
  };

  const handleOpenFullChat = () => {
    // Create new session with existing messages
    const newChatId = createSession();
    for (const msg of messages) {
      addMessageToSession(newChatId, { role: msg.role, content: msg.content });
    }
    // Navigate will happen via Link
  };

  const clearChat = () => {
    setMessages([]);
    setIsExpanded(false);
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Expanded chat area */}
      {isExpanded && messages.length > 0 && (
        <div className="mb-4 dark:bg-[#121212] bg-card border dark:border-[#1c1c1c] rounded-lg overflow-hidden">
          {/* Chat header */}
          <div className="flex items-center justify-between px-4 py-2 border-b dark:border-[#1c1c1c]">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MessageSquare className="size-4" />
              <span>AI Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              <Link href="/dashboard/chat" onClick={handleOpenFullChat}>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1">
                  <ArrowUpRight className="size-3" />
                  Open in chat
                </Button>
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={clearChat}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="max-h-[300px] overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                    msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <Markdown>{msg.content}</Markdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  <span>Thinking...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit}>
        <div className="relative dark:bg-[#121212] bg-card border dark:border-[#1c1c1c] rounded-lg">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ask anything about your business..."
            className="w-full bg-transparent px-4 py-4 pr-12 text-sm placeholder:text-[#878787] focus:outline-none"
            disabled={isLoading}
          />

          {/* Bottom actions bar */}
          <div className="flex items-center justify-between px-3 pb-3">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[#878787] hover:text-foreground hover:bg-[#1c1c1c]"
                title="AI Assistant"
              >
                <Sparkles className="size-4" />
              </Button>
              <Link href="/dashboard/chat">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-[#878787] hover:text-foreground hover:bg-[#1c1c1c]"
                  title="Chat History"
                >
                  <History className="size-4" />
                </Button>
              </Link>
            </div>

            <div className="flex items-center gap-1">
              <Button
                type="submit"
                size="icon"
                className={cn(
                  "h-8 w-8 rounded-md",
                  value.trim() && !isLoading
                    ? "bg-foreground text-background hover:bg-foreground/90"
                    : "bg-[#1c1c1c] text-[#878787]"
                )}
                disabled={!value.trim() || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
