/**
 * Smart Filters - AI-powered natural language filter generation
 *
 * Converts natural language queries like "invoices from last month" or
 * "payments over 1000 euros" into structured filter objects.
 */

import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import type { ZodType } from "zod";
import { logger } from "../../lib/logger";
import {
  type CustomersFilter,
  customersFilterSchema,
  type DocumentsFilter,
  documentsFilterSchema,
  type GlobalSearchFilter,
  globalSearchFilterSchema,
  type InvoicesFilter,
  invoicesFilterSchema,
  type ProductsFilter,
  productsFilterSchema,
  type TransactionsFilter,
  transactionsFilterSchema,
} from "./filter-schemas";

export * from "./filter-schemas";

// Filter type union
export type FilterEntity =
  | "transactions"
  | "invoices"
  | "customers"
  | "documents"
  | "products"
  | "global";

// Schema mapping
const filterSchemas: Record<FilterEntity, ZodType> = {
  transactions: transactionsFilterSchema,
  invoices: invoicesFilterSchema,
  customers: customersFilterSchema,
  documents: documentsFilterSchema,
  products: productsFilterSchema,
  global: globalSearchFilterSchema,
};

// System prompts for each entity type
const systemPrompts: Record<FilterEntity, string> = {
  transactions: `You are an AI assistant that converts natural language queries into transaction filters.
Extract relevant filter parameters from the user's query.

Examples:
- "show me transactions from last month" → { start: "2024-11-01", end: "2024-11-30" }
- "payments over 1000 euros" → { amountMin: 1000 }
- "software subscriptions" → { categories: ["software"] }
- "GitHub payments this year" → { name: "GitHub", start: "2024-01-01" }
- "recurring monthly expenses" → { recurring: "monthly" }`,

  invoices: `You are an AI assistant that converts natural language queries into invoice filters.
Extract relevant filter parameters from the user's query.

Examples:
- "unpaid invoices" → { status: "unpaid" }
- "overdue invoices from Acme Corp" → { status: "overdue", customerName: "Acme Corp" }
- "invoices over 5000 EUR" → { amountMin: 5000, currency: "EUR" }
- "invoices due this week" → { dueDateStart: "...", dueDateEnd: "..." }
- "paid invoices from January" → { status: "paid", start: "2024-01-01", end: "2024-01-31" }`,

  customers: `You are an AI assistant that converts natural language queries into customer filters.
Extract relevant filter parameters from the user's query.

Examples:
- "customers in Germany" → { country: "Germany" }
- "tech companies" → { industry: "Technology" }
- "customers from Belgrade" → { city: "Belgrade" }
- "new customers this year" → { createdAfter: "2024-01-01" }
- "customers with invoices" → { hasInvoices: true }`,

  documents: `You are an AI assistant that converts natural language queries into document filters.
Extract relevant filter parameters from the user's query.

Examples:
- "invoices from Amazon" → { type: "invoice", vendorName: "Amazon" }
- "receipts from last month" → { type: "receipt", start: "...", end: "..." }
- "documents tagged as important" → { tags: ["important"] }
- "contracts from 2024" → { type: "contract", start: "2024-01-01", end: "2024-12-31" }`,

  products: `You are an AI assistant that converts natural language queries into product filters.
Extract relevant filter parameters from the user's query.

Examples:
- "products under 100 EUR" → { priceMax: 100 }
- "electronics in stock" → { category: "Electronics", inStock: true }
- "active products over 500" → { active: true, priceMin: 500 }`,

  global: `You are an AI assistant that converts natural language search queries into structured filters.
Extract relevant filter parameters for searching across multiple entity types.

Examples:
- "everything from last month over 1000" → { startDate: "...", endDate: "...", amountMin: 1000 }
- "unpaid invoices and overdue payments" → { types: ["invoices", "transactions"], status: "unpaid" }
- "documents and invoices from Amazon" → { types: ["documents", "invoices"], searchTerm: "Amazon" }`,
};

interface GenerateFilterOptions {
  entity: FilterEntity;
  query: string;
  timezone?: string;
  context?: string;
  currentDate?: string;
}

/**
 * Generate filters from natural language query using AI
 */
export async function generateSmartFilters<T = unknown>(
  options: GenerateFilterOptions
): Promise<T | null> {
  const { entity, query, timezone, context, currentDate } = options;

  if (!query || query.trim().length === 0) {
    return null;
  }

  // Single-word queries don't need AI processing
  const words = query.trim().split(/\s+/);
  if (words.length === 1) {
    // Return simple search filter
    const simpleFilter =
      entity === "global"
        ? { searchTerm: query }
        : entity === "transactions"
          ? { name: query }
          : { q: query };
    return simpleFilter as T;
  }

  const schema = filterSchemas[entity];
  if (!schema) {
    logger.warn({ entity }, "Unknown filter entity type");
    return null;
  }

  const systemPrompt = systemPrompts[entity];
  const dateStr = currentDate || new Date().toISOString().split("T")[0];
  const tz = timezone || "Europe/Belgrade";

  try {
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      system: `${systemPrompt}

Current date: ${dateStr}
Timezone: ${tz}
${context ? `\nAvailable context:\n${context}` : ""}

Important:
- Always return dates in ISO-8601 format (YYYY-MM-DD)
- Only include filters that are explicitly mentioned or strongly implied
- Return empty object {} if no filters can be extracted
- For relative dates like "last month" or "this week", calculate the actual dates`,
      schema,
      prompt: query,
      temperature: 0.1, // Low temperature for consistent outputs
    });

    logger.info({ entity, query, filters: object }, "Generated smart filters");
    return object as T;
  } catch (error) {
    logger.error({ error, entity, query }, "Failed to generate smart filters");
    return null;
  }
}

/**
 * Generate transaction filters from natural language
 */
export async function generateTransactionFilters(
  query: string,
  options?: { timezone?: string; categories?: string[]; tags?: string[] }
): Promise<TransactionsFilter | null> {
  const context = [
    options?.categories?.length ? `Available categories: ${options.categories.join(", ")}` : "",
    options?.tags?.length ? `Available tags: ${options.tags.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return generateSmartFilters<TransactionsFilter>({
    entity: "transactions",
    query,
    timezone: options?.timezone,
    context: context || undefined,
  });
}

/**
 * Generate invoice filters from natural language
 */
export async function generateInvoiceFilters(
  query: string,
  options?: { timezone?: string; customers?: string[] }
): Promise<InvoicesFilter | null> {
  const context = options?.customers?.length
    ? `Available customers: ${options.customers.join(", ")}`
    : undefined;

  return generateSmartFilters<InvoicesFilter>({
    entity: "invoices",
    query,
    timezone: options?.timezone,
    context,
  });
}

/**
 * Generate customer filters from natural language
 */
export async function generateCustomerFilters(
  query: string,
  options?: { timezone?: string; industries?: string[]; countries?: string[] }
): Promise<CustomersFilter | null> {
  const context = [
    options?.industries?.length ? `Available industries: ${options.industries.join(", ")}` : "",
    options?.countries?.length ? `Available countries: ${options.countries.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return generateSmartFilters<CustomersFilter>({
    entity: "customers",
    query,
    timezone: options?.timezone,
    context: context || undefined,
  });
}

/**
 * Generate document filters from natural language
 */
export async function generateDocumentFilters(
  query: string,
  options?: { timezone?: string; tags?: string[] }
): Promise<DocumentsFilter | null> {
  const context = options?.tags?.length ? `Available tags: ${options.tags.join(", ")}` : undefined;

  return generateSmartFilters<DocumentsFilter>({
    entity: "documents",
    query,
    timezone: options?.timezone,
    context,
  });
}

/**
 * Generate product filters from natural language
 */
export async function generateProductFilters(
  query: string,
  options?: { timezone?: string; categories?: string[] }
): Promise<ProductsFilter | null> {
  const context = options?.categories?.length
    ? `Available categories: ${options.categories.join(", ")}`
    : undefined;

  return generateSmartFilters<ProductsFilter>({
    entity: "products",
    query,
    timezone: options?.timezone,
    context,
  });
}

/**
 * Generate global search filters from natural language
 */
export async function generateGlobalSearchFilters(
  query: string,
  options?: { timezone?: string }
): Promise<GlobalSearchFilter | null> {
  return generateSmartFilters<GlobalSearchFilter>({
    entity: "global",
    query,
    timezone: options?.timezone,
  });
}

export default {
  generateSmartFilters,
  generateTransactionFilters,
  generateInvoiceFilters,
  generateCustomerFilters,
  generateDocumentFilters,
  generateProductFilters,
  generateGlobalSearchFilters,
};
