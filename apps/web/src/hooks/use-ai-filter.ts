"use client";

import { useCallback, useState } from "react";

/**
 * AI Filter Hooks
 *
 * Provides hooks for parsing natural language queries into structured filters
 * using AI endpoints for invoices, customers, products, and vault.
 */

// ============================================================================
// Types
// ============================================================================

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled" | "partial";
export type CustomerType = "lead" | "prospect" | "customer" | "churned" | "partner";
export type ProductStatus = "active" | "inactive" | "discontinued" | "out_of_stock";

export interface DateRange {
  start?: string;
  end?: string;
}

export interface AmountRange {
  min?: number;
  max?: number;
}

// Invoice filter result
export interface InvoiceFilterResult {
  status?: InvoiceStatus[];
  dateRange?: DateRange;
  dueDateRange?: DateRange;
  amountRange?: AmountRange;
  customerName?: string;
  searchQuery?: string;
  sortBy?: "date" | "amount" | "dueDate" | "customer";
  sortOrder?: "asc" | "desc";
}

// Customer filter result
export interface CustomerFilterResult {
  type?: CustomerType[];
  industry?: string[];
  country?: string;
  city?: string;
  hasRecentActivity?: boolean;
  createdDateRange?: DateRange;
  revenueRange?: AmountRange;
  searchQuery?: string;
  sortBy?: "name" | "revenue" | "createdAt" | "lastActivity";
  sortOrder?: "asc" | "desc";
}

// Product filter result
export interface ProductFilterResult {
  status?: ProductStatus[];
  category?: string[];
  priceRange?: AmountRange;
  inStock?: boolean;
  isRecurring?: boolean;
  hasTax?: boolean;
  searchQuery?: string;
  sortBy?: "name" | "price" | "createdAt" | "popularity";
  sortOrder?: "asc" | "desc";
}

// Vault filter result
export interface VaultFilterResult {
  tags?: string[];
  dateRange?: DateRange;
  searchQuery?: string;
}

// Generic filter state
interface AIFilterState<T> {
  result: T | null;
  isLoading: boolean;
  error: string | null;
  query: string;
}

// ============================================================================
// Base Hook
// ============================================================================

function useAIFilterBase<T>(endpoint: string) {
  const [state, setState] = useState<AIFilterState<T>>({
    result: null,
    isLoading: false,
    error: null,
    query: "",
  });

  const parseQuery = useCallback(
    async (query: string, extraParams?: Record<string, unknown>): Promise<T | null> => {
      if (!query.trim()) {
        setState((prev) => ({ ...prev, result: null, query: "" }));
        return null;
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null, query }));

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, ...extraParams }),
        });

        if (!response.ok) {
          throw new Error(`Failed to parse query: ${response.statusText}`);
        }

        const result = (await response.json()) as T;
        setState((prev) => ({ ...prev, result, isLoading: false }));
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to parse query";
        setState((prev) => ({ ...prev, error: errorMessage, isLoading: false }));
        return null;
      }
    },
    [endpoint]
  );

  const clear = useCallback(() => {
    setState({ result: null, isLoading: false, error: null, query: "" });
  }, []);

  return {
    ...state,
    parseQuery,
    clear,
  };
}

// ============================================================================
// Specialized Hooks
// ============================================================================

/**
 * Hook for parsing invoice search queries
 *
 * @example
 * const { parseQuery, result, isLoading } = useInvoiceAIFilter();
 *
 * // Parse a natural language query
 * await parseQuery("unpaid invoices over $1000 from last month");
 *
 * // Result: { status: ["sent", "overdue"], amountRange: { min: 1000 }, dateRange: {...} }
 */
export function useInvoiceAIFilter() {
  return useAIFilterBase<InvoiceFilterResult>("/api/ai/filters/invoices");
}

/**
 * Hook for parsing customer search queries
 *
 * @example
 * const { parseQuery, result, isLoading } = useCustomerAIFilter();
 *
 * // Parse a natural language query
 * await parseQuery("tech companies in California");
 *
 * // Result: { industry: ["Technology"], country: "USA", city: "California" }
 */
export function useCustomerAIFilter() {
  const base = useAIFilterBase<CustomerFilterResult>("/api/ai/filters/customers");

  const parseQueryWithIndustries = useCallback(
    async (query: string, availableIndustries?: string[]) => {
      return base.parseQuery(query, { availableIndustries });
    },
    [base.parseQuery]
  );

  return {
    ...base,
    parseQuery: parseQueryWithIndustries,
  };
}

/**
 * Hook for parsing product search queries
 *
 * @example
 * const { parseQuery, result, isLoading } = useProductAIFilter();
 *
 * // Parse a natural language query
 * await parseQuery("premium software subscriptions");
 *
 * // Result: { category: ["Software"], priceRange: { min: 500 }, isRecurring: true }
 */
export function useProductAIFilter() {
  const base = useAIFilterBase<ProductFilterResult>("/api/ai/filters/products");

  const parseQueryWithCategories = useCallback(
    async (query: string, availableCategories?: string[]) => {
      return base.parseQuery(query, { availableCategories });
    },
    [base.parseQuery]
  );

  return {
    ...base,
    parseQuery: parseQueryWithCategories,
  };
}

/**
 * Hook for parsing vault/document search queries
 *
 * @example
 * const { parseQuery, result, isLoading } = useVaultAIFilter();
 *
 * // Parse a natural language query
 * await parseQuery("invoices from last month");
 *
 * // Result: { tags: ["invoice"], dateRange: { start: "...", end: "..." } }
 */
export function useVaultAIFilter() {
  const base = useAIFilterBase<VaultFilterResult>("/api/ai/filters/vault");

  const parseQueryWithTags = useCallback(
    async (query: string, availableTags?: string[]) => {
      return base.parseQuery(query, { availableTags });
    },
    [base.parseQuery]
  );

  return {
    ...base,
    parseQuery: parseQueryWithTags,
  };
}

// ============================================================================
// Combined Hook
// ============================================================================

type FilterType = "invoices" | "customers" | "products" | "vault";
type FilterResult =
  | InvoiceFilterResult
  | CustomerFilterResult
  | ProductFilterResult
  | VaultFilterResult;

/**
 * Combined hook for all AI filters
 *
 * @example
 * const { parseQuery, result, isLoading } = useAIFilter("invoices");
 * await parseQuery("overdue invoices");
 */
export function useAIFilter(type: FilterType) {
  const endpoints: Record<FilterType, string> = {
    invoices: "/api/ai/filters/invoices",
    customers: "/api/ai/filters/customers",
    products: "/api/ai/filters/products",
    vault: "/api/ai/filters/vault",
  };

  return useAIFilterBase<FilterResult>(endpoints[type]);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert AI filter result to URL search params
 */
export function filterResultToSearchParams(result: FilterResult): URLSearchParams {
  const params = new URLSearchParams();

  if (!result) return params;

  for (const [key, value] of Object.entries(result)) {
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      params.set(key, value.join(","));
    } else if (typeof value === "object") {
      // Handle nested objects like dateRange, amountRange
      for (const [subKey, subValue] of Object.entries(value)) {
        if (subValue !== undefined && subValue !== null) {
          params.set(`${key}.${subKey}`, String(subValue));
        }
      }
    } else {
      params.set(key, String(value));
    }
  }

  return params;
}

/**
 * Build filter description from result
 */
export function describeFilter(result: FilterResult, _type: FilterType): string {
  if (!result) return "";

  const parts: string[] = [];

  if ("status" in result && result.status?.length) {
    parts.push(`Status: ${result.status.join(", ")}`);
  }

  if ("type" in result && result.type?.length) {
    parts.push(`Type: ${result.type.join(", ")}`);
  }

  if ("category" in result && result.category?.length) {
    parts.push(`Category: ${result.category.join(", ")}`);
  }

  if ("industry" in result && result.industry?.length) {
    parts.push(`Industry: ${result.industry.join(", ")}`);
  }

  if ("dateRange" in result && result.dateRange) {
    const { start, end } = result.dateRange;
    if (start && end) {
      parts.push(`Date: ${start} to ${end}`);
    } else if (start) {
      parts.push(`From: ${start}`);
    } else if (end) {
      parts.push(`Until: ${end}`);
    }
  }

  if ("amountRange" in result && result.amountRange) {
    const { min, max } = result.amountRange;
    if (min && max) {
      parts.push(`Amount: $${min} - $${max}`);
    } else if (min) {
      parts.push(`Min amount: $${min}`);
    } else if (max) {
      parts.push(`Max amount: $${max}`);
    }
  }

  if ("priceRange" in result && result.priceRange) {
    const { min, max } = result.priceRange;
    if (min && max) {
      parts.push(`Price: $${min} - $${max}`);
    } else if (min) {
      parts.push(`Min price: $${min}`);
    } else if (max) {
      parts.push(`Max price: $${max}`);
    }
  }

  if ("searchQuery" in result && result.searchQuery) {
    parts.push(`Search: "${result.searchQuery}"`);
  }

  return parts.join(" | ");
}
