/**
 * Artifact Types - Configuration for chat artifacts/canvas
 */

export type ArtifactType =
  | "burn-rate"
  | "runway"
  | "cash-flow"
  | "revenue"
  | "profit-loss"
  | "forecast"
  | "financial-health"
  | "spending"
  | "transactions"
  | "invoices"
  | "customers";

export type ArtifactStage = "loading" | "chart_ready" | "metrics_ready" | "analysis_ready";

// Map tool names to artifact types
export const TOOL_TO_ARTIFACT_MAP: Record<string, ArtifactType> = {
  getBurnRate: "burn-rate",
  getRunway: "runway",
  getCashFlow: "cash-flow",
  getRevenue: "revenue",
  getProfitLoss: "profit-loss",
  getForecast: "forecast",
  getFinancialHealth: "financial-health",
  getSpendingInsights: "spending",
  getTransactions: "transactions",
  getInvoices: "invoices",
  getCustomers: "customers",
};

// Artifact metadata
export const ARTIFACT_CONFIG: Record<
  ArtifactType,
  {
    title: string;
    description: string;
    icon: string;
    color: string;
  }
> = {
  "burn-rate": {
    title: "Burn Rate Analysis",
    description: "Monthly spending and burn rate trends",
    icon: "TrendingDown",
    color: "red",
  },
  runway: {
    title: "Runway Projection",
    description: "Financial runway based on current burn rate",
    icon: "Plane",
    color: "blue",
  },
  "cash-flow": {
    title: "Cash Flow",
    description: "Income vs expenses over time",
    icon: "ArrowRightLeft",
    color: "green",
  },
  revenue: {
    title: "Revenue Analysis",
    description: "Revenue trends and breakdown",
    icon: "DollarSign",
    color: "emerald",
  },
  "profit-loss": {
    title: "Profit & Loss",
    description: "P&L statement and margins",
    icon: "TrendingUp",
    color: "purple",
  },
  forecast: {
    title: "Financial Forecast",
    description: "Revenue and expense projections",
    icon: "LineChart",
    color: "cyan",
  },
  "financial-health": {
    title: "Business Health Score",
    description: "Overall financial health metrics",
    icon: "HeartPulse",
    color: "pink",
  },
  spending: {
    title: "Spending Insights",
    description: "Expense breakdown by category",
    icon: "PieChart",
    color: "orange",
  },
  transactions: {
    title: "Transactions",
    description: "Recent transaction activity",
    icon: "History",
    color: "slate",
  },
  invoices: {
    title: "Invoices",
    description: "Invoice status and amounts",
    icon: "FileText",
    color: "indigo",
  },
  customers: {
    title: "Customers",
    description: "Customer breakdown",
    icon: "Users",
    color: "teal",
  },
};

export function getArtifactTypeFromTool(toolName: string | null): ArtifactType | null {
  if (!toolName) return null;
  return TOOL_TO_ARTIFACT_MAP[toolName] || null;
}
