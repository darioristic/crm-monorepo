/**
 * Smart Filter Hook
 * AI-powered natural language to filter conversion
 */

import { useCallback, useState } from "react";

export type FilterEntity =
  | "transactions"
  | "invoices"
  | "customers"
  | "documents"
  | "products"
  | "search";

export interface TransactionsFilter {
  name?: string;
  start?: string;
  end?: string;
  categories?: string[];
  tags?: string[];
  amountMin?: number;
  amountMax?: number;
  recurring?: "all" | "weekly" | "biweekly" | "monthly" | "annually";
  hasAttachments?: boolean;
}

export interface InvoicesFilter {
  q?: string;
  start?: string;
  end?: string;
  dueDateStart?: string;
  dueDateEnd?: string;
  status?: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  customerName?: string;
  amountMin?: number;
  amountMax?: number;
  currency?: string;
}

export interface CustomersFilter {
  q?: string;
  industry?: string;
  country?: string;
  city?: string;
  hasInvoices?: boolean;
  createdAfter?: string;
  createdBefore?: string;
}

export interface DocumentsFilter {
  q?: string;
  type?: "invoice" | "receipt" | "contract" | "other";
  tags?: string[];
  start?: string;
  end?: string;
  vendorName?: string;
  hasOcrText?: boolean;
}

export interface ProductsFilter {
  q?: string;
  category?: string;
  priceMin?: number;
  priceMax?: number;
  inStock?: boolean;
  active?: boolean;
}

export interface GlobalSearchFilter {
  searchTerm?: string;
  types?: ("transactions" | "invoices" | "customers" | "documents" | "products")[];
  startDate?: string;
  endDate?: string;
  amount?: number;
  amountMin?: number;
  amountMax?: number;
  status?: string;
  currency?: string;
}

type FilterType<T extends FilterEntity> = T extends "transactions"
  ? TransactionsFilter
  : T extends "invoices"
    ? InvoicesFilter
    : T extends "customers"
      ? CustomersFilter
      : T extends "documents"
        ? DocumentsFilter
        : T extends "products"
          ? ProductsFilter
          : GlobalSearchFilter;

interface UseSmartFilterOptions<T extends FilterEntity> {
  entity: T;
  onFilterApplied?: (filters: FilterType<T>) => void;
  context?: {
    categories?: string[];
    tags?: string[];
    customers?: string[];
    industries?: string[];
    countries?: string[];
  };
}

interface UseSmartFilterReturn<T extends FilterEntity> {
  generateFilters: (query: string) => Promise<FilterType<T> | null>;
  isLoading: boolean;
  error: Error | null;
  lastFilters: FilterType<T> | null;
}

/**
 * Hook for generating smart filters from natural language queries
 */
export function useSmartFilter<T extends FilterEntity>({
  entity,
  onFilterApplied,
  context,
}: UseSmartFilterOptions<T>): UseSmartFilterReturn<T> {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastFilters, setLastFilters] = useState<FilterType<T> | null>(null);

  const generateFilters = useCallback(
    async (query: string): Promise<FilterType<T> | null> => {
      if (!query || query.trim().length === 0) {
        return null;
      }

      // Single-word queries don't need AI processing
      const words = query.trim().split(/\s+/);
      if (words.length === 1) {
        const simpleFilter = (
          entity === "search" ? { searchTerm: query } : { q: query }
        ) as FilterType<T>;
        setLastFilters(simpleFilter);
        onFilterApplied?.(simpleFilter);
        return simpleFilter;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/ai/filters/${entity}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            context,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to generate filters: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success || !data.data?.filters) {
          throw new Error("Invalid response from filter API");
        }

        const filters = data.data.filters as FilterType<T>;
        setLastFilters(filters);
        onFilterApplied?.(filters);
        return filters;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [entity, context, onFilterApplied]
  );

  return {
    generateFilters,
    isLoading,
    error,
    lastFilters,
  };
}

/**
 * Check if a query should use AI filter generation
 * Multi-word queries trigger AI processing
 */
export function shouldUseAIFilter(query: string): boolean {
  if (!query) return false;
  return query.trim().split(/\s+/).length > 1;
}

/**
 * Normalize filter values for API consumption
 */
export function normalizeFilters<T extends Record<string, unknown>>(filters: T): Partial<T> {
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(filters)) {
    // Skip null, undefined, empty strings
    if (value === null || value === undefined || value === "") {
      continue;
    }

    // Skip empty arrays
    if (Array.isArray(value) && value.length === 0) {
      continue;
    }

    normalized[key] = value;
  }

  return normalized as Partial<T>;
}

export default useSmartFilter;
