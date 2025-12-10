"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

type Props = {
  children: ReactNode;
};

export function QueryProvider({ children }: Props) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Stale time: data is considered fresh for 5 minutes
            // This reduces unnecessary refetches
            staleTime: 5 * 60 * 1000, // 5 minutes

            // Garbage collection time: unused queries are kept in cache for 10 minutes
            // This allows instant navigation back to previously viewed pages
            gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)

            // Retry configuration for failed requests
            retry: 2,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

            // Refetch behavior
            refetchOnWindowFocus: false, // Don't refetch when window regains focus
            refetchOnReconnect: true, // Refetch when network reconnects
            refetchOnMount: true, // Refetch on component mount if data is stale

            // Network mode
            networkMode: "online", // Only run queries when online
          },
          mutations: {
            // Retry failed mutations once
            retry: 1,
            retryDelay: 1000,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
