"use client";

import { AlertCircleIcon, BotIcon, CheckCircle2Icon, RefreshCwIcon, UserIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ToolCallResult } from "./tool-call-indicator";

interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  state: "call" | "partial-call" | "result";
  result?: unknown;
}

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string | Array<string | { text?: string }>;
  text?: string;
  display?: string;
  toolInvocations?: ToolInvocation[];
};

interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

export function ChatMessages({ messages, isLoading, error, onRetry }: ChatMessagesProps) {
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {isLoading && (
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <BotIcon className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="flex space-x-1">
              <div
                className="h-2 w-2 rounded-full bg-current animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <div
                className="h-2 w-2 rounded-full bg-current animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <div
                className="h-2 w-2 rounded-full bg-current animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertCircleIcon className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <p className="text-sm text-destructive font-medium">Something went wrong</p>
            <p className="text-sm text-muted-foreground">
              {error.message || "Failed to get response from AI"}
            </p>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
                <RefreshCwIcon className="h-3 w-3 mr-2" />
                Try Again
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getMessageText(message: ChatMessage): string {
  const m = message;
  if (typeof m.content === "string") return m.content;
  if (Array.isArray(m.content)) {
    const parts = m.content.map((p) => (typeof p === "string" ? p : p?.text || "")).filter(Boolean);
    if (parts.length) return parts.join("\n\n");
  }
  if (typeof m.text === "string") return m.text;
  if (typeof m.display === "string") return m.display;
  return "";
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const messageText = getMessageText(message);
  const completedToolCalls = message.toolInvocations?.filter((t) => t.state === "result") || [];

  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-primary/10"
        )}
      >
        {isUser ? <UserIcon className="h-4 w-4" /> : <BotIcon className="h-4 w-4" />}
      </div>

      <div className="flex flex-col gap-2 max-w-[85%]">
        {/* Show completed tool calls before the message */}
        {completedToolCalls.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {completedToolCalls.map((tool) => (
              <div
                key={tool.toolCallId}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/10 text-green-600 dark:text-green-400 text-xs"
              >
                <CheckCircle2Icon className="h-3 w-3" />
                <span>{formatToolName(tool.toolName)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Message content */}
        {messageText && (
          <div
            className={cn(
              "rounded-2xl px-4 py-3",
              isUser ? "bg-primary text-primary-foreground" : "bg-muted"
            )}
          >
            {isUser ? (
              <p className="text-sm whitespace-pre-wrap">{messageText}</p>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    table: ({ children }) => (
                      <div className="overflow-x-auto my-4">
                        <table className="min-w-full divide-y divide-border">{children}</table>
                      </div>
                    ),
                    thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
                    th: ({ children }) => (
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="px-3 py-2 text-sm whitespace-nowrap">{children}</td>
                    ),
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {children}
                      </a>
                    ),
                    code: ({ className, children }) => {
                      const isInline = !className;
                      return isInline ? (
                        <code className="bg-muted px-1.5 py-0.5 rounded text-sm">{children}</code>
                      ) : (
                        <code className={className}>{children}</code>
                      );
                    },
                  }}
                >
                  {messageText}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* Show tool call details if requested */}
        {completedToolCalls.length > 0 && !messageText && (
          <div className="space-y-2">
            {completedToolCalls.map((tool) => (
              <ToolCallResult
                key={tool.toolCallId}
                toolName={tool.toolName}
                result={typeof tool.result === "string" ? tool.result : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Format tool name for display
function formatToolName(toolName: string): string {
  const nameMap: Record<string, string> = {
    getInvoices: "Invoices",
    getOverdueInvoices: "Overdue Invoices",
    createInvoice: "Created Invoice",
    getCustomers: "Customers",
    getCustomerById: "Customer Details",
    getProducts: "Products",
    getQuotes: "Quotes",
    createCustomer: "Created Customer",
    getBurnRate: "Burn Rate",
    getRunway: "Runway",
    getCashFlow: "Cash Flow",
    getRevenue: "Revenue",
    getExpenses: "Expenses",
    getForecast: "Forecast",
    getProfitLoss: "P&L",
    getFinancialHealth: "Health Score",
    getSpendingInsights: "Spending Analysis",
    compareProducts: "Product Comparison",
    analyzeAffordability: "Affordability",
    marketResearch: "Market Research",
    getDocuments: "Documents",
    getInboxItems: "Inbox",
    getAccountBalances: "Balances",
    getTimeEntries: "Time Entries",
    getProjectTime: "Project Time",
    getTeamUtilization: "Utilization",
    getTransactions: "Transactions",
    searchTransactions: "Search Results",
    getRecurringTransactions: "Recurring",
  };

  return nameMap[toolName] || toolName;
}
