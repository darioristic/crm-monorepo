"use client";

import { useState, useEffect, useCallback } from "react";
import { ApiResponse, FilterParams, PaginationParams } from "@/lib/api";

type UseApiOptions<T> = {
  initialData?: T;
  autoFetch?: boolean;
};

type UseApiResult<T> = {
  data: T | undefined;
  error: string | undefined;
  isLoading: boolean;
  refetch: () => Promise<void>;
  meta?: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
};

export function useApi<T>(
  fetchFn: () => Promise<ApiResponse<T>>,
  options: UseApiOptions<T> = {}
): UseApiResult<T> {
  const { initialData, autoFetch = true } = options;
  const [data, setData] = useState<T | undefined>(initialData);
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(autoFetch);
  const [meta, setMeta] = useState<UseApiResult<T>["meta"]>();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      const response = await fetchFn();

      if (response.success) {
        setData(response.data);
        setMeta(response.meta);
      } else {
        setError(response.error?.message || "Unknown error");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    if (autoFetch) {
      fetchData();
    }
  }, [autoFetch, fetchData]);

  return {
    data,
    error,
    isLoading,
    refetch: fetchData,
    meta,
  };
}

type UsePaginatedApiResult<T> = UseApiResult<T[]> & {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  filters: FilterParams;
  setFilters: (filters: FilterParams) => void;
};

export function usePaginatedApi<T>(
  fetchFn: (params: FilterParams & PaginationParams) => Promise<ApiResponse<T[]>>,
  initialFilters: FilterParams = {}
): UsePaginatedApiResult<T> {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<FilterParams>(initialFilters);
  const [data, setData] = useState<T[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      const response = await fetchFn({ ...filters, page, pageSize });

      if (response.success) {
        setData(response.data || []);
        if (response.meta) {
          setTotalCount(response.meta.totalCount);
          setTotalPages(response.meta.totalPages);
        }
      } else {
        setError(response.error?.message || "Unknown error");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  }, [fetchFn, filters, page, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSetPage = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handleSetPageSize = useCallback((newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1);
  }, []);

  const handleSetFilters = useCallback((newFilters: FilterParams) => {
    setFilters(newFilters);
    setPage(1);
  }, []);

  return {
    data,
    error,
    isLoading,
    refetch: fetchData,
    page,
    pageSize,
    totalCount,
    totalPages,
    setPage: handleSetPage,
    setPageSize: handleSetPageSize,
    filters,
    setFilters: handleSetFilters,
    meta: { page, pageSize, totalCount, totalPages },
  };
}

export function useMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<ApiResponse<TData>>
) {
  const [data, setData] = useState<TData | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const mutate = useCallback(
    async (variables: TVariables) => {
      setIsLoading(true);
      setError(undefined);

      try {
        const response = await mutationFn(variables);

        if (response.success) {
          setData(response.data);
          return { success: true, data: response.data };
        } else {
          const errorMessage = response.error?.message || "Unknown error";
          setError(errorMessage);
          return { success: false, error: errorMessage };
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "Mutation failed";
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    [mutationFn]
  );

  return {
    mutate,
    data,
    error,
    isLoading,
    reset: () => {
      setData(undefined);
      setError(undefined);
    },
  };
}

