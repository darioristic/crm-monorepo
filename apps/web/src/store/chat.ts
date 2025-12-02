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

// Command suggestions for quick access
const COMMAND_SUGGESTIONS: CommandSuggestion[] = [
  {
    command: "/invoices",
    title: "Show recent invoices",
    keywords: ["invoices", "bills", "payments"],
  },
  {
    command: "/overdue",
    title: "Show overdue invoices",
    keywords: ["overdue", "late", "unpaid"],
  },
  {
    command: "/customers",
    title: "List customers",
    keywords: ["customers", "clients", "companies"],
  },
  {
    command: "/products",
    title: "Show products",
    keywords: ["products", "items", "catalog"],
  },
  {
    command: "/quotes",
    title: "Show quotes",
    keywords: ["quotes", "proposals", "estimates"],
  },
  {
    command: "/analytics",
    title: "Business analytics",
    keywords: ["analytics", "stats", "metrics"],
  },
];

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

  // Actions
  setCurrentChatId: (id: string | null) => void;
  setInput: (input: string) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

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

      // Basic setters
      setCurrentChatId: (id) => set({ currentChatId: id }),
      setInput: (input) => set({ input }),
      setIsLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

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

        set((state) => ({
          sessions: [session, ...state.sessions],
          currentChatId: id,
        }));

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
            const matchesKeywords = cmd.keywords.some((kw) =>
              kw.toLowerCase().includes(query)
            );
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
          selectedCommandIndex: Math.min(
            selectedCommandIndex + 1,
            filteredCommands.length - 1
          ),
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
        sessions: state.sessions.slice(0, 20), // Keep last 20 sessions
      }),
    }
  )
);

