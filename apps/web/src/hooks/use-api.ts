"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ApiResponse, FilterParams, PaginationParams } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";

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
	options: UseApiOptions<T> = {},
): UseApiResult<T> {
	const { initialData, autoFetch = true } = options;
	const [data, setData] = useState<T | undefined>(initialData);
	const [error, setError] = useState<string | undefined>();
	const [isLoading, setIsLoading] = useState(autoFetch);
	const [meta, setMeta] = useState<UseApiResult<T>["meta"]>();

	// Store fetchFn in a ref to avoid dependency changes
	const fetchFnRef = useRef(fetchFn);
	fetchFnRef.current = fetchFn;

	const fetchData = useCallback(async () => {
		setIsLoading(true);
		setError(undefined);

		try {
			const response = await fetchFnRef.current();

			if (response.success) {
				setData(response.data);
				setMeta(response.meta);
			} else {
				setError(getErrorMessage(response.error, "Unknown error"));
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to fetch data");
		} finally {
			setIsLoading(false);
		}
	}, []);

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
	fetchFn: (
		params: FilterParams & PaginationParams,
	) => Promise<ApiResponse<T[]>>,
	initialFilters: FilterParams = {},
): UsePaginatedApiResult<T> {
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(20);
	const [filters, setFilters] = useState<FilterParams>(initialFilters);
	const [data, setData] = useState<T[]>([]);
	const [error, setError] = useState<string | undefined>();
	const [isLoading, setIsLoading] = useState(true);
	const [totalCount, setTotalCount] = useState(0);
	const [totalPages, setTotalPages] = useState(0);

	// Store fetchFn in a ref to avoid dependency changes
	const fetchFnRef = useRef(fetchFn);
	fetchFnRef.current = fetchFn;

	// Track the latest fetch request to prevent race conditions
	const fetchIdRef = useRef(0);

	const fetchData = useCallback(async () => {
		const currentFetchId = ++fetchIdRef.current;
		setIsLoading(true);
		setError(undefined);

		try {
			const response = await fetchFnRef.current({ ...filters, page, pageSize });

			// Only update state if this is still the latest fetch
			if (currentFetchId !== fetchIdRef.current) {
				return;
			}

			if (response.success) {
				const newData = response.data || [];
				// Use functional update to ensure we're setting the latest data
				setData(() => newData);
				if (response.meta) {
					setTotalCount(response.meta.totalCount);
					setTotalPages(response.meta.totalPages);
				}
			} else {
				setError(getErrorMessage(response.error, "Unknown error"));
			}
		} catch (e) {
			// Only update error if this is still the latest fetch
			if (currentFetchId === fetchIdRef.current) {
				setError(e instanceof Error ? e.message : "Failed to fetch data");
			}
		} finally {
			// Only update loading state if this is still the latest fetch
			if (currentFetchId === fetchIdRef.current) {
				setIsLoading(false);
			}
		}
	}, [filters, page, pageSize]);

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

	const handleSetFilters = useCallback(
		(newFilters: FilterParams) => {
			// Only update if filters actually changed
			const filtersChanged =
				JSON.stringify(newFilters) !== JSON.stringify(filters);
			if (filtersChanged) {
				setFilters(newFilters);
				setPage(1);
			}
		},
		[filters],
	);

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
	mutationFn: (variables: TVariables) => Promise<ApiResponse<TData>>,
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
					const errorMessage = getErrorMessage(response.error, "Unknown error");
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
		[mutationFn],
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

type UseQueryOptions = {
	enabled?: boolean;
};

export function useQuery<T>(
	queryKey: (string | undefined)[],
	queryFn: () => Promise<ApiResponse<T> | null>,
	options: UseQueryOptions = {},
) {
	const { enabled = true } = options;
	const [data, setData] = useState<ApiResponse<T> | null>(null);
	const [error, setError] = useState<string | undefined>();
	const [isLoading, setIsLoading] = useState(enabled);

	const fetchData = useCallback(async () => {
		if (!enabled) return;

		setIsLoading(true);
		setError(undefined);

		try {
			const response = await queryFn();
			setData(response);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to fetch data");
		} finally {
			setIsLoading(false);
		}
	}, [enabled, queryFn]);

	useEffect(() => {
		if (enabled) {
			fetchData();
		}
	}, [enabled, fetchData]);

	return {
		data,
		error,
		isLoading,
		refetch: fetchData,
	};
}
