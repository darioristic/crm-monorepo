"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { cn } from "@/lib/utils";
import { ChatHeader } from "./chat-header";
import { ChatInput } from "./chat-input";
import { ChatMessages } from "./chat-messages";
import { SuggestedPrompts } from "./suggested-prompts";

interface ChatInterfaceProps {
  className?: string;
  initialChatId?: string;
}

export function ChatInterface({ className, initialChatId }: ChatInterfaceProps) {
  const [chatId] = useState(() => initialChatId || crypto.randomUUID());
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    sendMessage,
    status,
    error,
    regenerate,
    stop,
  } = useChat({
    api: `${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat`,
    id: chatId,
    body: {
      chatId,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    headers: {
      Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("access_token") : ""}`,
    },
  });

  const isLoading = status === "in_progress";

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput("");
  };

  const handlePromptSelect = (prompt: string) => {
    setInput(prompt);
  };

  const hasMessages = messages.length > 0;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <ChatHeader />
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6"
      >
        {!hasMessages ? (
          <div className="flex flex-col items-center justify-center h-full space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold">AI Assistant</h2>
              <p className="text-muted-foreground max-w-md">
                Ask me about invoices, customers, products, sales, or anything else about your business.
              </p>
            </div>
            <SuggestedPrompts onSelect={handlePromptSelect} />
          </div>
        ) : (
          <ChatMessages
            messages={messages}
            isLoading={isLoading}
            error={error}
            onRetry={regenerate}
          />
        )}
      </div>

      <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-3xl mx-auto p-4">
          <ChatInput
            value={input}
            onChange={setInput}
            onSubmit={handleSendMessage}
            isLoading={isLoading}
            onStop={stop}
          />
        </div>
      </div>
    </div>
  );
}

