"use client";

import { useChat } from "@ai-sdk/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/chat";
import { type ArtifactType, Canvas, getArtifactTypeFromTool } from "./artifacts";
import { ChatHeader } from "./chat-header";
import { ChatHistory, ChatHistoryDropdown } from "./chat-history";
import { ChatInput } from "./chat-input";
import { ChatMessages } from "./chat-messages";
import { ChatStatusIndicators } from "./chat-status-indicators";
import { SuggestedPrompts } from "./suggested-prompts";
import { ToolCallIndicator } from "./tool-call-indicator";

interface ArtifactData {
  type: ArtifactType;
  data?: Record<string, unknown>;
  stage?: "loading" | "chart_ready" | "metrics_ready" | "analysis_ready";
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
  const [showHistory, setShowHistory] = useState(false);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const [artifact, setArtifact] = useState<ArtifactData | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    input,
    handleInputChange: setInput,
    showCommands,
    filteredCommands,
    selectedCommandIndex,
    handleCommandSelect,
    navigateCommandUp,
    navigateCommandDown,
    selectCurrentCommand,
    resetCommandState,
    sessions,
    createSession,
    addMessageToSession,
    updateSessionTitle,
  } = useChatStore();

  // Initialize or get chatId - create session if needed
  const [chatId, setChatId] = useState(() => {
    if (initialChatId) {
      return initialChatId;
    }
    // Will create session in useEffect below
    return crypto.randomUUID();
  });

  // Ensure a session exists for the current chatId (only check once per chatId)
  const sessionCreatedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    // Skip if we've already created a session for this chatId
    if (sessionCreatedRef.current.has(chatId)) return;

    const currentSessions = useChatStore.getState().sessions;
    const sessionExists = currentSessions.some((s) => s.id === chatId);

    if (!sessionExists) {
      sessionCreatedRef.current.add(chatId);
      useChatStore.setState((state) => {
        // Double-check inside setState to prevent race conditions
        if (state.sessions.some((s) => s.id === chatId)) {
          return state;
        }
        return {
          sessions: [
            {
              id: chatId,
              title: "New Chat",
              messages: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            ...state.sessions,
          ],
        };
      });
    } else {
      sessionCreatedRef.current.add(chatId);
    }
  }, [chatId]);

  // Use AI SDK's useChat hook with streaming
  const chat = useChat({
    id: chatId,
    onFinish: ({ message, messages }) => {
      // Save to session store
      const m = message as {
        content?: unknown;
        parts?: unknown[];
        text?: string;
        display?: string;
      };
      let text = "";
      if (typeof m?.display === "string") {
        text = m.display;
      } else if (typeof m?.content === "string") {
        text = m.content;
      } else if (Array.isArray(m?.content)) {
        text = (m.content as unknown[])
          .map((part: unknown) => {
            if (typeof part === "string") return part;
            if (typeof part === "object" && part && "text" in (part as object)) {
              const p = part as { text?: string };
              return p.text || "";
            }
            return "";
          })
          .join("");
      } else if (Array.isArray(m?.parts)) {
        text = (m.parts as unknown[])
          .map((part: unknown) => {
            if (typeof part === "string") return part;
            if (typeof part === "object" && part && "text" in (part as object)) {
              const p = part as { text?: string };
              return p.text || "";
            }
            return "";
          })
          .join("");
      } else if (typeof m?.text === "string") {
        text = m.text;
      }
      addMessageToSession(chatId, { role: "assistant", content: text });

      // Auto-generate title from first user message
      const session = sessions.find((s) => s.id === chatId);
      if (session && session.title === "New Chat" && messages.length <= 2) {
        const userMsg = messages.find((msg) => msg.role === "user");
        if (userMsg) {
          const u = userMsg as unknown as { content?: unknown; text?: string };
          const text =
            typeof u.content === "string" ? u.content : typeof u.text === "string" ? u.text : "";
          const title = String(text).slice(0, 50) + (String(text).length > 50 ? "..." : "");
          updateSessionTitle(chatId, title);
        }
      }

      // Update artifact stage when finished
      if (artifact) {
        setArtifact((prev) => (prev ? { ...prev, stage: "analysis_ready" } : null));
      }
    },
    onError: (err) => {
      setArtifact(null);
      const e = err as unknown;
      const fallback =
        typeof e === "object" && e && "error" in (e as object)
          ? String((e as { error?: unknown }).error)
          : "AI servis nije dostupan. Molim pokušajte kasnije.";
      addMessageToSession(chatId, { role: "assistant", content: fallback });
    },
  });
  const messages = chat.messages;
  const reload = (chat as unknown as { reload?: () => void }).reload ?? (() => {});
  const stop = (chat as unknown as { stop?: () => void }).stop ?? (() => {});
  const setMessages = chat.setMessages;
  const isLoading = Boolean((chat as unknown as { isLoading?: boolean }).isLoading);
  const error = (chat as unknown as { error?: Error | null }).error ?? null;
  const sendMessage = async (content: string) => {
    const fn =
      (
        chat as unknown as {
          append?: (msg: { role: "user" | "assistant"; content: string }) => Promise<unknown>;
          sendMessage?: (msg: { role: "user" | "assistant"; content: string }) => Promise<unknown>;
        }
      ).append ??
      (
        chat as unknown as {
          append?: (msg: { role: "user" | "assistant"; content: string }) => Promise<unknown>;
          sendMessage?: (msg: { role: "user" | "assistant"; content: string }) => Promise<unknown>;
        }
      ).sendMessage;
    if (fn) {
      return fn({ role: "user", content });
    }
  };

  // Load messages from session when component mounts
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const session = sessions.find((s) => s.id === chatId);
    if (session && session.messages.length > 0) {
      // Convert stored messages to AI SDK format (using type assertion)
      const storedMessages = session.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        parts: [{ type: "text" as const, text: m.content }],
      }));
      (setMessages as (msgs: typeof storedMessages) => void)(storedMessages);
    }
  }, []); // Only run once on mount

  // Derive agent status and tool calls from messages
  const { agentStatus, currentToolCall } = useMemo(() => {
    if (!isLoading) {
      return { agentStatus: null, currentToolCall: null };
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) {
      return { agentStatus: "routing", currentToolCall: null };
    }

    const toolInvocations =
      (
        lastMessage as unknown as {
          toolInvocations?: { state: string; toolName: string }[];
        }
      ).toolInvocations || [];
    const activeTool = toolInvocations.find(
      (t) => t.state === "call" || t.state === "partial-call"
    );

    if (activeTool) {
      return {
        agentStatus: "executing",
        currentToolCall: activeTool.toolName,
      };
    }

    return {
      agentStatus: isLoading ? "responding" : null,
      currentToolCall: null,
    };
  }, [messages, isLoading]);

  // Track artifacts from tool calls
  useEffect(() => {
    if (currentToolCall) {
      const artifactType = getArtifactTypeFromTool(currentToolCall);
      if (artifactType) {
        setArtifact({
          type: artifactType,
          stage: "loading",
        });
      }
    }
  }, [currentToolCall]);

  // Extract artifact data from completed tool calls
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "assistant") return;

    const toolInvocations =
      (
        lastMessage as unknown as {
          toolInvocations?: { state: string; result?: unknown; toolName: string }[];
        }
      ).toolInvocations || [];
    const completedTools = toolInvocations.filter((t) => t.state === "result");

    if (completedTools.length > 0 && artifact) {
      const lastTool = completedTools[completedTools.length - 1];
      if (lastTool.result) {
        setArtifact((prev) =>
          prev
            ? {
                ...prev,
                data:
                  lastTool.result && typeof lastTool.result === "object"
                    ? (lastTool.result as Record<string, unknown>)
                    : {},
                stage: "metrics_ready",
              }
            : null
        );
      }
    }
  }, [messages, artifact]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;

      // Save user message to session
      addMessageToSession(chatId, { role: "user", content: input });

      // Send message using AI SDK
      try {
        await sendMessage(input);
      } catch (err) {
        const e = err as unknown;
        const fallback =
          typeof e === "object" && e && "error" in (e as object)
            ? String((e as { error?: unknown }).error)
            : "AI servis nije dostupan. Molim pokušajte kasnije.";
        addMessageToSession(chatId, { role: "assistant", content: fallback });
      }

      setInput("");
      resetCommandState();
    },
    [input, isLoading, sendMessage, addMessageToSession, chatId, setInput, resetCommandState]
  );

  const handlePromptSelect = useCallback(
    (prompt: string) => {
      setInput(prompt);
    },
    [setInput]
  );

  const handleNewChat = useCallback(() => {
    setArtifact(null);
    if (onNewChat) {
      onNewChat();
    } else {
      const newId = createSession();
      setChatId(newId);
      (setMessages as (msgs: typeof messages) => void)([]);
      router.push(`/dashboard/chat/${newId}`);
    }
  }, [onNewChat, createSession, router, setMessages]);

  const handleSelectChat = useCallback(
    (id: string) => {
      setArtifact(null);
      setChatId(id);
      setShowHistory(false);
      setShowHistoryDropdown(false);

      // Load messages from session store
      const session = sessions.find((s) => s.id === id);
      if (session && session.messages.length > 0) {
        // Convert stored messages to AI SDK format with parts array
        const storedMessages = session.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          parts: [{ type: "text" as const, text: m.content }],
        }));
        (setMessages as (msgs: typeof storedMessages) => void)(storedMessages);
      } else {
        (setMessages as (msgs: typeof messages) => void)([]);
      }

      router.push(`/dashboard/chat/${id}`);
    },
    [router, setMessages, sessions]
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

  // Convert AI SDK messages to our format
  const displayMessages = useMemo(() => {
    const fromChat = messages.map((m) => {
      const raw = m as unknown as {
        content?: unknown;
        text?: string;
        display?: string;
        parts?: unknown[];
        toolInvocations?: unknown[];
      };
      let content: string | Array<string | { text?: string }> = "";
      if (typeof raw.content === "string") {
        content = raw.content;
      } else if (Array.isArray(raw.content)) {
        content = raw.content as Array<string | { text?: string }>;
      } else if (Array.isArray(raw.parts)) {
        content = (raw.parts as unknown[])
          .map((part: unknown) => {
            if (typeof part === "string") return part;
            if (typeof part === "object" && part && "text" in (part as object)) {
              const p = part as { text?: string };
              return p.text || "";
            }
            return "";
          })
          .filter(Boolean)
          .join("");
      } else if (typeof raw.text === "string") {
        content = raw.text;
      } else if (typeof raw.display === "string") {
        content = raw.display;
      }
      return {
        id: m.id,
        role: m.role as "user" | "assistant",
        content,
        display: typeof raw.display === "string" ? raw.display : undefined,
        toolInvocations: raw.toolInvocations as
          | {
              toolCallId: string;
              toolName: string;
              args: Record<string, unknown>;
              state: "call" | "partial-call" | "result";
              result?: unknown;
            }[]
          | undefined,
      };
    });
    if (fromChat.length > 0) return fromChat;
    const session = sessions.find((s) => s.id === chatId);
    const fromSession =
      session?.messages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        display: undefined,
        toolInvocations: undefined,
      })) || [];
    return fromSession;
  }, [messages, sessions, chatId]);

  const hasMessages = displayMessages.length > 0;
  const showCanvas = artifact !== null;

  return (
    <div className={cn("flex flex-col h-full relative", className)}>
      {/* Canvas slides in from right when artifacts are present */}
      {showCanvas && (
        <Canvas
          artifact={artifact}
          onClose={() => setArtifact(null)}
          className={showCanvas ? "translate-x-0" : "translate-x-full"}
        />
      )}

      {/* Main chat area */}
      <div
        className={cn(
          "flex-1 flex flex-col",
          hasMessages && "transition-all duration-300 ease-in-out",
          showCanvas && "mr-0 md:mr-[600px]"
        )}
      >
        <ChatHeader
          onNewChat={handleNewChat}
          onViewHistory={() => setShowHistory(true)}
          showNavigation={!isHome && hasMessages}
        />

        {/* Agent Status and Tool Call Indicators */}
        {isLoading && (
          <div className="px-4 py-2 border-b bg-muted/30">
            <ChatStatusIndicators
              agentState={{
                status: (agentStatus ?? "routing") as import("@/store/chat").AgentStatus,
                message:
                  agentStatus === "executing" ? `Using ${currentToolCall}...` : "Processing...",
              }}
            />
            {currentToolCall && <ToolCallIndicator toolName={currentToolCall} />}
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
          {!hasMessages ? (
            <div className="flex flex-col items-center justify-center h-full space-y-8">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-semibold">AI Assistant</h2>
                <p className="text-muted-foreground max-w-md">
                  Ask me about invoices, customers, products, sales, financial analysis, or anything
                  else about your business. Type{" "}
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">/</kbd> to see available
                  commands.
                </p>
              </div>
              <SuggestedPrompts onSelect={handlePromptSelect} />
            </div>
          ) : (
            <ChatMessages
              messages={displayMessages}
              isLoading={isLoading}
              error={error}
              onRetry={reload}
            />
          )}
        </div>

        <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="max-w-3xl mx-auto p-4 relative">
            {/* Midday-style History Dropdown */}
            <ChatHistoryDropdown
              isOpen={showHistoryDropdown}
              onClose={() => setShowHistoryDropdown(false)}
              onSelectChat={handleSelectChat}
            />
            <ChatInput
              value={input}
              onChange={setInput}
              onSubmit={handleSendMessage}
              onKeyDown={handleKeyDown}
              isLoading={isLoading}
              onStop={stop}
              showCommands={showCommands}
              commands={filteredCommands}
              selectedCommandIndex={selectedCommandIndex}
              onCommandSelect={handleCommandSelect}
              onHistoryClick={() => setShowHistoryDropdown((prev) => !prev)}
              showHistoryButton={true}
              isHistoryOpen={showHistoryDropdown}
            />
          </div>
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
