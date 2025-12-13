/**
 * Smart Filter Schemas
 * Zod schemas for AI-powered filter generation
 */

import { z } from "zod";

// Transactions filter schema
export const transactionsFilterSchema = z.object({
  name: z.string().optional().describe("Merchant, vendor, or company name to search for"),
  start: z.string().optional().describe("Start date in ISO-8601 format (YYYY-MM-DD)"),
  end: z.string().optional().describe("End date in ISO-8601 format (YYYY-MM-DD)"),
  categories: z.array(z.string()).optional().describe("Category names to filter by"),
  tags: z.array(z.string()).optional().describe("Tag names to filter by"),
  amountMin: z.number().optional().describe("Minimum amount"),
  amountMax: z.number().optional().describe("Maximum amount"),
  recurring: z
    .enum(["all", "weekly", "biweekly", "monthly", "annually"])
    .optional()
    .describe("Filter by recurring frequency"),
  hasAttachments: z.boolean().optional().describe("Filter by whether transaction has attachments"),
});

// Invoices filter schema
export const invoicesFilterSchema = z.object({
  q: z
    .string()
    .optional()
    .describe("Search query for invoice number, customer name, or description"),
  start: z.string().optional().describe("Invoice date start in ISO-8601 format (YYYY-MM-DD)"),
  end: z.string().optional().describe("Invoice date end in ISO-8601 format (YYYY-MM-DD)"),
  dueDateStart: z.string().optional().describe("Due date start in ISO-8601 format (YYYY-MM-DD)"),
  dueDateEnd: z.string().optional().describe("Due date end in ISO-8601 format (YYYY-MM-DD)"),
  status: z
    .enum(["draft", "sent", "paid", "overdue", "cancelled"])
    .optional()
    .describe("Invoice status"),
  customerName: z.string().optional().describe("Customer name to filter by"),
  amountMin: z.number().optional().describe("Minimum invoice amount"),
  amountMax: z.number().optional().describe("Maximum invoice amount"),
  currency: z.string().optional().describe("Currency code (e.g., EUR, USD, RSD)"),
});

// Customers filter schema
export const customersFilterSchema = z.object({
  q: z.string().optional().describe("Search query for customer name, email, or company"),
  industry: z.string().optional().describe("Industry name to filter by"),
  country: z.string().optional().describe("Country name to filter by"),
  city: z.string().optional().describe("City name to filter by"),
  hasInvoices: z.boolean().optional().describe("Filter customers with/without invoices"),
  createdAfter: z.string().optional().describe("Created after date in ISO-8601 format"),
  createdBefore: z.string().optional().describe("Created before date in ISO-8601 format"),
});

// Documents/Vault filter schema
export const documentsFilterSchema = z.object({
  q: z.string().optional().describe("Search query for document title, content, or tags"),
  type: z.enum(["invoice", "receipt", "contract", "other"]).optional().describe("Document type"),
  tags: z.array(z.string()).optional().describe("Tags to filter by"),
  start: z.string().optional().describe("Document date start in ISO-8601 format"),
  end: z.string().optional().describe("Document date end in ISO-8601 format"),
  vendorName: z.string().optional().describe("Vendor name from document"),
  hasOcrText: z.boolean().optional().describe("Filter documents with/without OCR text"),
});

// Products filter schema
export const productsFilterSchema = z.object({
  q: z.string().optional().describe("Search query for product name, SKU, or description"),
  category: z.string().optional().describe("Product category name"),
  priceMin: z.number().optional().describe("Minimum price"),
  priceMax: z.number().optional().describe("Maximum price"),
  inStock: z.boolean().optional().describe("Filter by in-stock status"),
  active: z.boolean().optional().describe("Filter by active status"),
});

// Global search filter schema
export const globalSearchFilterSchema = z.object({
  searchTerm: z.string().optional().describe("Main search term"),
  types: z
    .array(z.enum(["transactions", "invoices", "customers", "documents", "products"]))
    .optional()
    .describe("Entity types to search in"),
  startDate: z.string().optional().describe("Start date in ISO-8601 format"),
  endDate: z.string().optional().describe("End date in ISO-8601 format"),
  amount: z.number().optional().describe("Exact amount to match"),
  amountMin: z.number().optional().describe("Minimum amount"),
  amountMax: z.number().optional().describe("Maximum amount"),
  status: z.string().optional().describe("Status filter"),
  currency: z.string().optional().describe("Currency code"),
});

export type TransactionsFilter = z.infer<typeof transactionsFilterSchema>;
export type InvoicesFilter = z.infer<typeof invoicesFilterSchema>;
export type CustomersFilter = z.infer<typeof customersFilterSchema>;
export type DocumentsFilter = z.infer<typeof documentsFilterSchema>;
export type ProductsFilter = z.infer<typeof productsFilterSchema>;
export type GlobalSearchFilter = z.infer<typeof globalSearchFilterSchema>;
