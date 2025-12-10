"use client";

import { useChat } from "@ai-sdk/react";
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

  const { messages, sendMessage, status, error, regenerate, stop } = useChat({
    id: chatId,
    onFinish: (result) => {
      // Save message to session - access message from result object
      const msg = (result as any)?.message;
      if (msg?.role === "assistant") {
        const content = typeof msg.content === "string" ? msg.content : "";
        addMessageToSession(chatId, {
          role: "assistant",
          content,
        });
        // Auto-generate title from first exchange
        const session = sessions.find((s) => s.id === chatId);
        if (session && session.title === "New Chat" && session.messages.length <= 2) {
          const firstUserMessage = session.messages.find((m) => m.role === "user");
          if (firstUserMessage) {
            const title =
              firstUserMessage.content.slice(0, 50) +
              (firstUserMessage.content.length > 50 ? "..." : "");
            updateSessionTitle(chatId, title);
          }
        }
      }
      setAgentState({ status: "complete" });
    },
    onError: () => {
      setAgentState({ status: "idle" });
    },
  });

  const isLoading = status !== "ready" && status !== "error";

  // Update agent status based on streaming state
  useEffect(() => {
    if (isLoading && agentState.status === "idle") {
      setAgentState({ status: "routing", message: "Routing to specialist..." });
    }
  }, [isLoading, agentState.status, setAgentState]);

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

      // Save user message to session
      addMessageToSession(chatId, { role: "user", content: input });

      setAgentState({ status: "routing", message: "Analyzing request..." });
      sendMessage({ text: input });
      handleInputChange("");
      resetCommandState();
    },
    [
      input,
      isLoading,
      chatId,
      addMessageToSession,
      setAgentState,
      sendMessage,
      handleInputChange,
      resetCommandState,
    ]
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
