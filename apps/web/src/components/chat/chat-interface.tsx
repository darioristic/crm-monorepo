"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/chat";
import { ChatHeader } from "./chat-header";
import { ChatHistory } from "./chat-history";
import { ChatInput } from "./chat-input";
import { ChatMessages } from "./chat-messages";
import { ChatStatusIndicators } from "./chat-status-indicators";
import { SuggestedPrompts } from "./suggested-prompts";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatInterfaceProps {
  className?: string;
  initialChatId?: string;
  onNewChat?: () => void;
  isHome?: boolean;
}

export function ChatInterface({
  className,
  initialChatId,
  onNewChat,
  isHome = false,
}: ChatInterfaceProps) {
  const router = useRouter();
  const [chatId, setChatId] = useState(() => initialChatId || crypto.randomUUID());
  const [showHistory, setShowHistory] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    input,
    handleInputChange,
    showCommands,
    filteredCommands,
    selectedCommandIndex,
    handleCommandSelect,
    navigateCommandUp,
    navigateCommandDown,
    selectCurrentCommand,
    resetCommandState,
    agentState,
    setAgentState,
    sessions,
    createSession,
    addMessageToSession,
    updateSessionTitle,
  } = useChatStore();

  // Simple chat function without streaming
  const sendChatMessage = useCallback(
    async (userMessage: string) => {
      setIsLoading(true);
      setError(null);
      setAgentState({ status: "routing", message: "Analyzing request..." });

      // Add user message to UI
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: userMessage,
      };
      setMessages((prev) => [...prev, userMsg]);
      addMessageToSession(chatId, { role: "user", content: userMessage });

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

        // Read the response - it's in AI SDK data stream format
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
          addMessageToSession(chatId, { role: "assistant", content: assistantContent });

          // Auto-generate title
          const session = sessions.find((s) => s.id === chatId);
          if (session && session.title === "New Chat" && session.messages.length <= 2) {
            const title = userMessage.slice(0, 50) + (userMessage.length > 50 ? "..." : "");
            updateSessionTitle(chatId, title);
          }
        }

        setAgentState({ status: "complete" });
      } catch (err) {
        console.error("[Chat] Error:", err);
        setError(err instanceof Error ? err : new Error("Unknown error"));
        setAgentState({ status: "idle" });
      } finally {
        setIsLoading(false);
      }
    },
    [chatId, addMessageToSession, sessions, updateSessionTitle, setAgentState]
  );

  const regenerate = useCallback(() => {
    // Find last user message and resend
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      // Remove last assistant message
      setMessages((prev) => prev.filter((m) => m.id !== messages[messages.length - 1]?.id));
      sendChatMessage(lastUserMsg.content);
    }
  }, [messages, sendChatMessage]);

  const stop = useCallback(() => {
    // Not applicable for non-streaming
    setIsLoading(false);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;

      sendChatMessage(input);
      handleInputChange("");
      resetCommandState();
    },
    [input, isLoading, sendChatMessage, handleInputChange, resetCommandState]
  );

  const handlePromptSelect = useCallback(
    (prompt: string) => {
      handleInputChange(prompt);
    },
    [handleInputChange]
  );

  const handleNewChat = useCallback(() => {
    if (onNewChat) {
      onNewChat();
    } else {
      const newId = createSession();
      setChatId(newId);
      router.push(`/dashboard/chat/${newId}`);
    }
  }, [onNewChat, createSession, router]);

  const handleSelectChat = useCallback(
    (id: string) => {
      setChatId(id);
      setShowHistory(false);
      router.push(`/dashboard/chat/${id}`);
    },
    [router]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showCommands) return;

      if (e.key === "ArrowUp") {
        e.preventDefault();
        navigateCommandUp();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        navigateCommandDown();
      } else if (e.key === "Enter" && !e.shiftKey) {
        const selected = selectCurrentCommand();
        if (selected) {
          e.preventDefault();
          handleCommandSelect(selected);
        }
      } else if (e.key === "Escape") {
        resetCommandState();
      }
    },
    [
      showCommands,
      navigateCommandUp,
      navigateCommandDown,
      selectCurrentCommand,
      handleCommandSelect,
      resetCommandState,
    ]
  );

  const hasMessages = messages.length > 0;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <ChatHeader
        onNewChat={handleNewChat}
        onViewHistory={() => setShowHistory(true)}
        showNavigation={!isHome && hasMessages}
      />

      {/* Agent Status Indicators */}
      {isLoading && <ChatStatusIndicators agentState={agentState} />}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        {!hasMessages ? (
          <div className="flex flex-col items-center justify-center h-full space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold">AI Assistant</h2>
              <p className="text-muted-foreground max-w-md">
                Ask me about invoices, customers, products, sales, or anything else about your
                business. Type <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">/</kbd> to
                see available commands.
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
            onChange={handleInputChange}
            onSubmit={handleSendMessage}
            onKeyDown={handleKeyDown}
            isLoading={isLoading}
            onStop={stop}
            showCommands={showCommands}
            commands={filteredCommands}
            selectedCommandIndex={selectedCommandIndex}
            onCommandSelect={handleCommandSelect}
          />
        </div>
      </div>

      {/* Chat History Drawer */}
      <ChatHistory
        open={showHistory}
        onOpenChange={setShowHistory}
        sessions={sessions}
        currentChatId={chatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
      />
    </div>
  );
}
