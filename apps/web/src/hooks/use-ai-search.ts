"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import {
  type CustomerFilterResult,
  describeFilter,
  type InvoiceFilterResult,
  type ProductFilterResult,
  useCustomerAIFilter,
  useInvoiceAIFilter,
  useProductAIFilter,
  useVaultAIFilter,
  type VaultFilterResult,
} from "./use-ai-filter";

/**
 * AI Search Hook
 *
 * Higher-level hook that combines AI filter parsing with debouncing
 * and provides a unified search experience across different entity types.
 */

// ============================================================================
// Types
// ============================================================================

export interface AISearchState<T> {
  query: string;
  debouncedQuery: string;
  filters: T | null;
  filterDescription: string;
  isLoading: boolean;
  isParsing: boolean;
  error: string | null;
}

interface AISearchActions<T> {
  setQuery: (query: string) => void;
  search: () => Promise<T | null>;
  clear: () => void;
  applyFilter: (filter: Partial<T>) => void;
}

type AISearchResult<T> = AISearchState<T> & AISearchActions<T>;

// ============================================================================
// Debounce Hook (if not exists)
// ============================================================================

// Simple debounce hook if not already available
function useDebounceValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useMemo(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// ============================================================================
// Invoice AI Search
// ============================================================================

/**
 * AI-powered invoice search hook
 *
 * @example
 * const { query, setQuery, filters, isLoading, filterDescription } = useInvoiceAISearch();
 *
 * // User types in search box
 * setQuery("unpaid invoices over $1000");
 *
 * // After debounce, filters are automatically parsed:
 * // filters = { status: ["sent", "overdue"], amountRange: { min: 1000 } }
 * // filterDescription = "Status: sent, overdue | Min amount: $1000"
 */
export function useInvoiceAISearch(debounceMs = 500): AISearchResult<InvoiceFilterResult> {
  const [query, setQuery] = useState("");
  const [manualFilters, setManualFilters] = useState<Partial<InvoiceFilterResult>>({});
  const [isPending, startTransition] = useTransition();

  const debouncedQuery = useDebounceValue(query, debounceMs);
  const aiFilter = useInvoiceAIFilter();

  // Auto-parse when debounced query changes
  useMemo(() => {
    if (debouncedQuery.trim()) {
      startTransition(() => {
        aiFilter.parseQuery(debouncedQuery);
      });
    }
  }, [debouncedQuery]);

  // Combine AI-parsed filters with manual filters
  const combinedFilters = useMemo(() => {
    if (!aiFilter.result && Object.keys(manualFilters).length === 0) {
      return null;
    }
    return { ...aiFilter.result, ...manualFilters } as InvoiceFilterResult;
  }, [aiFilter.result, manualFilters]);

  const filterDescription = useMemo(() => {
    return combinedFilters ? describeFilter(combinedFilters, "invoices") : "";
  }, [combinedFilters]);

  const search = useCallback(async () => {
    if (!query.trim()) return null;
    return aiFilter.parseQuery(query);
  }, [query, aiFilter.parseQuery]);

  const clear = useCallback(() => {
    setQuery("");
    setManualFilters({});
    aiFilter.clear();
  }, [aiFilter.clear]);

  const applyFilter = useCallback((filter: Partial<InvoiceFilterResult>) => {
    setManualFilters((prev) => ({ ...prev, ...filter }));
  }, []);

  return {
    query,
    debouncedQuery,
    filters: combinedFilters,
    filterDescription,
    isLoading: aiFilter.isLoading,
    isParsing: isPending,
    error: aiFilter.error,
    setQuery,
    search,
    clear,
    applyFilter,
  };
}

// ============================================================================
// Customer AI Search
// ============================================================================

/**
 * AI-powered customer search hook
 */
export function useCustomerAISearch(debounceMs = 500): AISearchResult<CustomerFilterResult> {
  const [query, setQuery] = useState("");
  const [manualFilters, setManualFilters] = useState<Partial<CustomerFilterResult>>({});
  const [isPending, startTransition] = useTransition();

  const debouncedQuery = useDebounceValue(query, debounceMs);
  const aiFilter = useCustomerAIFilter();

  useMemo(() => {
    if (debouncedQuery.trim()) {
      startTransition(() => {
        aiFilter.parseQuery(debouncedQuery);
      });
    }
  }, [debouncedQuery]);

  const combinedFilters = useMemo(() => {
    if (!aiFilter.result && Object.keys(manualFilters).length === 0) {
      return null;
    }
    return { ...aiFilter.result, ...manualFilters } as CustomerFilterResult;
  }, [aiFilter.result, manualFilters]);

  const filterDescription = useMemo(() => {
    return combinedFilters ? describeFilter(combinedFilters, "customers") : "";
  }, [combinedFilters]);

  const search = useCallback(async () => {
    if (!query.trim()) return null;
    return aiFilter.parseQuery(query);
  }, [query, aiFilter.parseQuery]);

  const clear = useCallback(() => {
    setQuery("");
    setManualFilters({});
    aiFilter.clear();
  }, [aiFilter.clear]);

  const applyFilter = useCallback((filter: Partial<CustomerFilterResult>) => {
    setManualFilters((prev) => ({ ...prev, ...filter }));
  }, []);

  return {
    query,
    debouncedQuery,
    filters: combinedFilters,
    filterDescription,
    isLoading: aiFilter.isLoading,
    isParsing: isPending,
    error: aiFilter.error,
    setQuery,
    search,
    clear,
    applyFilter,
  };
}

// ============================================================================
// Product AI Search
// ============================================================================

/**
 * AI-powered product search hook
 */
export function useProductAISearch(debounceMs = 500): AISearchResult<ProductFilterResult> {
  const [query, setQuery] = useState("");
  const [manualFilters, setManualFilters] = useState<Partial<ProductFilterResult>>({});
  const [isPending, startTransition] = useTransition();

  const debouncedQuery = useDebounceValue(query, debounceMs);
  const aiFilter = useProductAIFilter();

  useMemo(() => {
    if (debouncedQuery.trim()) {
      startTransition(() => {
        aiFilter.parseQuery(debouncedQuery);
      });
    }
  }, [debouncedQuery]);

  const combinedFilters = useMemo(() => {
    if (!aiFilter.result && Object.keys(manualFilters).length === 0) {
      return null;
    }
    return { ...aiFilter.result, ...manualFilters } as ProductFilterResult;
  }, [aiFilter.result, manualFilters]);

  const filterDescription = useMemo(() => {
    return combinedFilters ? describeFilter(combinedFilters, "products") : "";
  }, [combinedFilters]);

  const search = useCallback(async () => {
    if (!query.trim()) return null;
    return aiFilter.parseQuery(query);
  }, [query, aiFilter.parseQuery]);

  const clear = useCallback(() => {
    setQuery("");
    setManualFilters({});
    aiFilter.clear();
  }, [aiFilter.clear]);

  const applyFilter = useCallback((filter: Partial<ProductFilterResult>) => {
    setManualFilters((prev) => ({ ...prev, ...filter }));
  }, []);

  return {
    query,
    debouncedQuery,
    filters: combinedFilters,
    filterDescription,
    isLoading: aiFilter.isLoading,
    isParsing: isPending,
    error: aiFilter.error,
    setQuery,
    search,
    clear,
    applyFilter,
  };
}

// ============================================================================
// Vault AI Search
// ============================================================================

/**
 * AI-powered vault/document search hook
 */
export function useVaultAISearch(debounceMs = 500): AISearchResult<VaultFilterResult> {
  const [query, setQuery] = useState("");
  const [manualFilters, setManualFilters] = useState<Partial<VaultFilterResult>>({});
  const [isPending, startTransition] = useTransition();

  const debouncedQuery = useDebounceValue(query, debounceMs);
  const aiFilter = useVaultAIFilter();

  useMemo(() => {
    if (debouncedQuery.trim()) {
      startTransition(() => {
        aiFilter.parseQuery(debouncedQuery);
      });
    }
  }, [debouncedQuery]);

  const combinedFilters = useMemo(() => {
    if (!aiFilter.result && Object.keys(manualFilters).length === 0) {
      return null;
    }
    return { ...aiFilter.result, ...manualFilters } as VaultFilterResult;
  }, [aiFilter.result, manualFilters]);

  const filterDescription = useMemo(() => {
    return combinedFilters ? describeFilter(combinedFilters, "vault") : "";
  }, [combinedFilters]);

  const search = useCallback(async () => {
    if (!query.trim()) return null;
    return aiFilter.parseQuery(query);
  }, [query, aiFilter.parseQuery]);

  const clear = useCallback(() => {
    setQuery("");
    setManualFilters({});
    aiFilter.clear();
  }, [aiFilter.clear]);

  const applyFilter = useCallback((filter: Partial<VaultFilterResult>) => {
    setManualFilters((prev) => ({ ...prev, ...filter }));
  }, []);

  return {
    query,
    debouncedQuery,
    filters: combinedFilters,
    filterDescription,
    isLoading: aiFilter.isLoading,
    isParsing: isPending,
    error: aiFilter.error,
    setQuery,
    search,
    clear,
    applyFilter,
  };
}
