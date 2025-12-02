export { getInvoicesTool, getOverdueInvoicesTool } from "./get-invoices";
export { getCustomersTool, getCustomerByIdTool, getIndustriesSummaryTool } from "./get-customers";
export { getProductsTool, getProductCategoriesSummaryTool } from "./get-products";
export { getQuotesTool, getQuoteConversionRateTool } from "./get-quotes";

// All tools registry for easy access
export const allTools = {
  getInvoices: () => import("./get-invoices").then((m) => m.getInvoicesTool),
  getOverdueInvoices: () => import("./get-invoices").then((m) => m.getOverdueInvoicesTool),
  getCustomers: () => import("./get-customers").then((m) => m.getCustomersTool),
  getCustomerById: () => import("./get-customers").then((m) => m.getCustomerByIdTool),
  getIndustriesSummary: () => import("./get-customers").then((m) => m.getIndustriesSummaryTool),
  getProducts: () => import("./get-products").then((m) => m.getProductsTool),
  getProductCategories: () => import("./get-products").then((m) => m.getProductCategoriesSummaryTool),
  getQuotes: () => import("./get-quotes").then((m) => m.getQuotesTool),
  getQuoteConversion: () => import("./get-quotes").then((m) => m.getQuoteConversionRateTool),
};

