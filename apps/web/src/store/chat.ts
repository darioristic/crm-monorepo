import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface CommandSuggestion {
  command: string;
  title: string;
  keywords: string[];
}

// Command suggestions for quick access - CRM specific
export const COMMAND_SUGGESTIONS: CommandSuggestion[] = [
  // Invoices
  {
    command: "/show invoices",
    title: "Show recent invoices",
    keywords: ["invoices", "bills", "payments", "recent"],
  },
  {
    command: "/show overdue",
    title: "Show overdue invoices",
    keywords: ["overdue", "late", "unpaid", "past due"],
  },
  {
    command: "/show unpaid",
    title: "Show unpaid invoices",
    keywords: ["unpaid", "pending", "outstanding"],
  },
  {
    command: "/show paid this month",
    title: "Invoices paid this month",
    keywords: ["paid", "collected", "month"],
  },
  // Customers
  {
    command: "/show customers",
    title: "List all customers",
    keywords: ["customers", "clients", "companies"],
  },
  {
    command: "/show new customers",
    title: "New customers this month",
    keywords: ["new", "recent", "customers"],
  },
  {
    command: "/find customer",
    title: "Find a specific customer",
    keywords: ["find", "search", "customer", "lookup"],
  },
  {
    command: "/show top customers",
    title: "Top customers by revenue",
    keywords: ["top", "best", "revenue", "customers"],
  },
  // Sales
  {
    command: "/show pipeline",
    title: "Sales pipeline overview",
    keywords: ["pipeline", "deals", "opportunities"],
  },
  {
    command: "/show quotes",
    title: "Show recent quotes",
    keywords: ["quotes", "proposals", "estimates"],
  },
  {
    command: "/show deals in negotiation",
    title: "Deals in negotiation stage",
    keywords: ["negotiation", "deals", "active"],
  },
  {
    command: "/show won deals",
    title: "Recently won deals",
    keywords: ["won", "closed", "deals"],
  },
  // Products
  {
    command: "/show products",
    title: "Show all products",
    keywords: ["products", "items", "catalog"],
  },
  {
    command: "/show bestsellers",
    title: "Best selling products",
    keywords: ["bestsellers", "top", "popular"],
  },
  // Analytics
  {
    command: "/analyze sales",
    title: "Sales performance analysis",
    keywords: ["analyze", "sales", "performance"],
  },
  {
    command: "/analyze pipeline",
    title: "Pipeline health analysis",
    keywords: ["analyze", "pipeline", "health"],
  },
  {
    command: "/show revenue",
    title: "Revenue breakdown",
    keywords: ["revenue", "income", "money"],
  },
  {
    command: "/show growth",
    title: "Growth rate metrics",
    keywords: ["growth", "trend", "metrics"],
  },
  // Reports
  {
    command: "/report monthly",
    title: "Generate monthly report",
    keywords: ["report", "monthly", "summary"],
  },
  {
    command: "/report quarterly",
    title: "Generate quarterly report",
    keywords: ["report", "quarterly", "Q1", "Q2", "Q3", "Q4"],
  },
  {
    command: "/report sales",
    title: "Sales performance report",
    keywords: ["report", "sales", "performance"],
  },
  // Help
  {
    command: "/help",
    title: "Show available commands",
    keywords: ["help", "commands", "guide"],
  },
];

export type AgentStatus =
  | "idle"
  | "routing"
  | "executing"
  | "tool_calling"
  | "generating"
  | "complete";

export interface AgentState {
  status: AgentStatus;
  agentName?: string;
  toolName?: string;
  message?: string;
}

interface ChatState {
  // Current chat state
  currentChatId: string | null;
  input: string;
  isLoading: boolean;
  error: string | null;

  // Chat sessions
  sessions: ChatSession[];

  // Command suggestions
  showCommands: boolean;
  commandQuery: string;
  selectedCommandIndex: number;
  filteredCommands: CommandSuggestion[];

  // Agent & Features
  agentState: AgentState;
  isWebSearch: boolean;
  artifactType: string | null;

  // Actions
  setCurrentChatId: (id: string | null) => void;
  setInput: (input: string) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setAgentState: (state: Partial<AgentState>) => void;
  setIsWebSearch: (enabled: boolean) => void;
  setArtifactType: (type: string | null) => void;

  // Session management
  createSession: () => string;
  deleteSession: (id: string) => void;
  clearSessions: () => void;
  addMessageToSession: (sessionId: string, message: Omit<ChatMessage, "id" | "createdAt">) => void;
  updateSessionTitle: (sessionId: string, title: string) => void;

  // Command handling
  handleInputChange: (value: string) => void;
  handleCommandSelect: (command: CommandSuggestion) => void;
  resetCommandState: () => void;
  navigateCommandUp: () => void;
  navigateCommandDown: () => void;
  selectCurrentCommand: () => CommandSuggestion | null;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentChatId: null,
      input: "",
      isLoading: false,
      error: null,
      sessions: [],
      showCommands: false,
      commandQuery: "",
      selectedCommandIndex: 0,
      filteredCommands: COMMAND_SUGGESTIONS,
      agentState: { status: "idle" },
      isWebSearch: false,
      artifactType: null,

      // Basic setters
      setCurrentChatId: (id) => set({ currentChatId: id }),
      setInput: (input) => set({ input }),
      setIsLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      setAgentState: (state) => set((prev) => ({ agentState: { ...prev.agentState, ...state } })),
      setIsWebSearch: (enabled) => set({ isWebSearch: enabled }),
      setArtifactType: (type) => set({ artifactType: type }),

      // Session management
      createSession: () => {
        const id = crypto.randomUUID();
        const session: ChatSession = {
          id,
          title: "New Chat",
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set((state) => {
          // Check if session already exists
          if (state.sessions.some((s) => s.id === id)) {
            return { currentChatId: id };
          }
          return {
            sessions: [session, ...state.sessions],
            currentChatId: id,
          };
        });

        return id;
      },

      deleteSession: (id) => {
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
          currentChatId: state.currentChatId === id ? null : state.currentChatId,
        }));
      },

      clearSessions: () => {
        set({ sessions: [], currentChatId: null });
      },

      addMessageToSession: (sessionId, message) => {
        const newMessage: ChatMessage = {
          ...message,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  messages: [...session.messages, newMessage],
                  updatedAt: new Date().toISOString(),
                }
              : session
          ),
        }));
      },

      updateSessionTitle: (sessionId, title) => {
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? { ...session, title, updatedAt: new Date().toISOString() }
              : session
          ),
        }));
      },

      // Command handling
      handleInputChange: (value) => {
        set({ input: value });

        // Check if we're typing a command
        if (value.startsWith("/")) {
          const query = value.slice(1).toLowerCase();
          const filtered = COMMAND_SUGGESTIONS.filter((cmd) => {
            const matchesCommand = cmd.command.toLowerCase().includes(query);
            const matchesTitle = cmd.title.toLowerCase().includes(query);
            const matchesKeywords = cmd.keywords.some((kw) => kw.toLowerCase().includes(query));
            return matchesCommand || matchesTitle || matchesKeywords;
          });

          set({
            showCommands: true,
            commandQuery: query,
            selectedCommandIndex: 0,
            filteredCommands: filtered.length > 0 ? filtered : COMMAND_SUGGESTIONS,
          });
        } else {
          set({
            showCommands: false,
            commandQuery: "",
            filteredCommands: COMMAND_SUGGESTIONS,
          });
        }
      },

      handleCommandSelect: (command) => {
        set({
          input: command.title,
          showCommands: false,
          commandQuery: "",
        });
      },

      resetCommandState: () => {
        set({
          showCommands: false,
          commandQuery: "",
          selectedCommandIndex: 0,
          filteredCommands: COMMAND_SUGGESTIONS,
        });
      },

      navigateCommandUp: () => {
        const { selectedCommandIndex } = get();
        set({
          selectedCommandIndex: Math.max(selectedCommandIndex - 1, 0),
        });
      },

      navigateCommandDown: () => {
        const { selectedCommandIndex, filteredCommands } = get();
        set({
          selectedCommandIndex: Math.min(selectedCommandIndex + 1, filteredCommands.length - 1),
        });
      },

      selectCurrentCommand: () => {
        const { filteredCommands, selectedCommandIndex } = get();
        return filteredCommands[selectedCommandIndex] || null;
      },
    }),
    {
      name: "chat-storage",
      partialize: (state) => ({
        // Deduplicate sessions before persisting
        sessions: state.sessions
          .filter((session, index, self) => index === self.findIndex((s) => s.id === session.id))
          .slice(0, 20), // Keep last 20 sessions
      }),
      onRehydrateStorage: () => (state) => {
        // Clean up duplicates when loading from storage
        if (state?.sessions) {
          const seen = new Set<string>();
          state.sessions = state.sessions.filter((session) => {
            if (seen.has(session.id)) {
              return false;
            }
            seen.add(session.id);
            return true;
          });
        }
      },
    }
  )
);
