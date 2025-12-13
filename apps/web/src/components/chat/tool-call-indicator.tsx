"use client";

import {
  ArrowRightLeft,
  Calculator,
  Clock,
  DollarSign,
  FileCheck,
  FileText,
  FolderOpen,
  HeartPulse,
  History,
  Inbox,
  LineChart,
  Loader2,
  Package,
  PieChart,
  Plane,
  Plus,
  Receipt,
  Repeat,
  Search,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Tool to icon mapping
const toolIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  // CRM Tools
  getInvoices: FileText,
  getOverdueInvoices: FileText,
  createInvoice: Plus,
  getCustomers: Users,
  getCustomerById: Users,
  getProducts: Package,
  getQuotes: FileCheck,
  createCustomer: UserPlus,

  // Financial Analysis Tools
  getBurnRate: TrendingDown,
  getRunway: Plane,
  getCashFlow: ArrowRightLeft,
  getRevenue: DollarSign,
  getExpenses: Receipt,
  getForecast: LineChart,
  getProfitLoss: TrendingUp,
  getFinancialHealth: HeartPulse,
  getSpendingInsights: PieChart,

  // Research Tools
  compareProducts: Search,
  analyzeAffordability: Calculator,
  marketResearch: Search,

  // Operations Tools
  getDocuments: FolderOpen,
  getInboxItems: Inbox,
  getAccountBalances: Wallet,

  // Time Tracking Tools
  getTimeEntries: Clock,
  getProjectTime: Clock,
  getTeamUtilization: UsersRound,

  // Transactions Tools
  getTransactions: History,
  searchTransactions: Search,
  getRecurringTransactions: Repeat,
};

// Tool to display name mapping
const toolNames: Record<string, string> = {
  // CRM Tools
  getInvoices: "Fetching invoices",
  getOverdueInvoices: "Finding overdue invoices",
  createInvoice: "Creating invoice",
  getCustomers: "Loading customers",
  getCustomerById: "Finding customer",
  getProducts: "Loading products",
  getQuotes: "Loading quotes",
  createCustomer: "Creating customer",

  // Financial Analysis Tools
  getBurnRate: "Calculating burn rate",
  getRunway: "Calculating runway",
  getCashFlow: "Analyzing cash flow",
  getRevenue: "Analyzing revenue",
  getExpenses: "Analyzing expenses",
  getForecast: "Generating forecast",
  getProfitLoss: "Generating P&L",
  getFinancialHealth: "Calculating health score",
  getSpendingInsights: "Analyzing spending",

  // Research Tools
  compareProducts: "Comparing products",
  analyzeAffordability: "Checking affordability",
  marketResearch: "Researching market",

  // Operations Tools
  getDocuments: "Loading documents",
  getInboxItems: "Loading inbox",
  getAccountBalances: "Fetching balances",

  // Time Tracking Tools
  getTimeEntries: "Loading time entries",
  getProjectTime: "Loading project time",
  getTeamUtilization: "Calculating utilization",

  // Transactions Tools
  getTransactions: "Loading transactions",
  searchTransactions: "Searching transactions",
  getRecurringTransactions: "Finding recurring payments",
};

interface ToolCallIndicatorProps {
  toolName: string;
  className?: string;
}

export function ToolCallIndicator({ toolName, className }: ToolCallIndicatorProps) {
  const Icon = toolIcons[toolName] || Loader2;
  const displayName = toolNames[toolName] || `Running ${toolName}`;

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm text-muted-foreground animate-pulse",
        className
      )}
    >
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 text-primary">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">{displayName}</span>
        <Loader2 className="h-3 w-3 animate-spin" />
      </div>
    </div>
  );
}

// Component to display completed tool calls in messages
interface ToolCallResultProps {
  toolName: string;
  result?: string;
  className?: string;
}

export function ToolCallResult({ toolName, result, className }: ToolCallResultProps) {
  const Icon = toolIcons[toolName] || FileText;
  const displayName =
    toolNames[toolName]?.replace(/ing$/, "ed").replace(/Loading/, "Loaded") || toolName;

  return (
    <div
      className={cn(
        "flex items-start gap-2 text-xs text-muted-foreground border rounded-md p-2 bg-muted/30",
        className
      )}
    >
      <Icon className="h-3.5 w-3.5 mt-0.5 text-primary" />
      <div className="flex-1 min-w-0">
        <span className="font-medium">{displayName}</span>
        {result && <p className="mt-1 text-xs opacity-70 truncate">{result}</p>}
      </div>
    </div>
  );
}
