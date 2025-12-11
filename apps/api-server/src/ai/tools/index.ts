// CRM Tools

// Financial Analysis Tools
export { getBurnRateTool } from "./get-burn-rate";
export { getCashFlowTool } from "./get-cash-flow";
export { getCustomerByIdTool, getCustomersTool, getIndustriesSummaryTool } from "./get-customers";
export { getExpensesTool } from "./get-expenses";
export { getFinancialHealthTool } from "./get-financial-health";
export { getForecastTool } from "./get-forecast";
export { getInvoicesTool, getOverdueInvoicesTool } from "./get-invoices";
export { getProductCategoriesSummaryTool, getProductsTool } from "./get-products";
export { getProfitLossTool } from "./get-profit-loss";
export { getQuoteConversionRateTool, getQuotesTool } from "./get-quotes";
export { getRevenueTool } from "./get-revenue";
export { getRunwayTool } from "./get-runway";
export { getSpendingInsightsTool } from "./get-spending-insights";

// All tools registry for easy access
export const allTools: Record<string, () => Promise<unknown>> = {
  // CRM Tools
  getInvoices: () => import("./get-invoices").then((m) => m.getInvoicesTool),
  getOverdueInvoices: () => import("./get-invoices").then((m) => m.getOverdueInvoicesTool),
  getCustomers: () => import("./get-customers").then((m) => m.getCustomersTool),
  getCustomerById: () => import("./get-customers").then((m) => m.getCustomerByIdTool),
  getIndustriesSummary: () => import("./get-customers").then((m) => m.getIndustriesSummaryTool),
  getProducts: () => import("./get-products").then((m) => m.getProductsTool),
  getProductCategories: () =>
    import("./get-products").then((m) => m.getProductCategoriesSummaryTool),
  getQuotes: () => import("./get-quotes").then((m) => m.getQuotesTool),
  getQuoteConversion: () => import("./get-quotes").then((m) => m.getQuoteConversionRateTool),

  // Financial Analysis Tools
  getBurnRate: () => import("./get-burn-rate").then((m) => m.getBurnRateTool),
  getRunway: () => import("./get-runway").then((m) => m.getRunwayTool),
  getCashFlow: () => import("./get-cash-flow").then((m) => m.getCashFlowTool),
  getRevenue: () => import("./get-revenue").then((m) => m.getRevenueTool),
  getExpenses: () => import("./get-expenses").then((m) => m.getExpensesTool),
  getForecast: () => import("./get-forecast").then((m) => m.getForecastTool),
  getProfitLoss: () => import("./get-profit-loss").then((m) => m.getProfitLossTool),
  getFinancialHealth: () => import("./get-financial-health").then((m) => m.getFinancialHealthTool),
  getSpendingInsights: () =>
    import("./get-spending-insights").then((m) => m.getSpendingInsightsTool),
};
