"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";
import { useInView } from "react-intersection-observer";
import { useDocumentFilterParams } from "@/hooks/use-document-filter-params";
import { useDocumentParams } from "@/hooks/use-document-params";
import { documentsApi } from "@/lib/api";
import { NoResults } from "./empty-states";
import { VaultGetStarted } from "./vault-get-started";
import { VaultGridSkeleton } from "./vault-grid-skeleton";
import { VaultItem } from "./vault-item";

export function VaultGrid() {
  const queryClient = useQueryClient();
  const { ref, inView } = useInView();
  const { filter, hasFilters } = useDocumentFilterParams();
  const { params } = useDocumentParams();

  const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, isLoading, refetch } =
    useInfiniteQuery({
      queryKey: ["documents", filter],
      queryFn: async ({ pageParam }) => {
        const response = await documentsApi.getAll({
          pageSize: 20,
          cursor: pageParam,
          q: filter.q ?? undefined,
          tags: filter.tags ?? undefined,
          start: filter.start ?? undefined,
          end: filter.end ?? undefined,
        });
        return response.data;
      },
      getNextPageParam: (lastPage) => lastPage?.meta?.cursor,
      initialPageParam: undefined as string | undefined,
      // Refetch when window regains focus
      refetchOnWindowFocus: true,
      // Keep data fresh
      staleTime: 30 * 1000, // 30 seconds
    });

  // Refetch documents when document sheet closes (potential changes)
  const handleRefetch = useCallback(() => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["documents"] });
  }, [refetch, queryClient]);

  // Listen for document changes (sheet close, uploads)
  useEffect(() => {
    // Refetch when document sheet closes
    if (!params.documentId) {
      handleRefetch();
    }
  }, [params.documentId, handleRefetch]);

  const documents = useMemo(() => {
    return data?.pages.flatMap((page) => page?.data ?? []) ?? [];
  }, [data]);

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return <VaultGridSkeleton />;
  }

  if (hasFilters && !documents?.length) {
    return <NoResults />;
  }

  if (!documents?.length && !isFetching) {
    return <VaultGetStarted />;
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 ultra:grid-cols-6 gap-8">
        {documents.map((document) => (
          <VaultItem key={document.id} data={document} />
        ))}
      </div>

      {/* Load more trigger */}
      {hasNextPage && (
        <div ref={ref} className="flex justify-center py-8">
          {isFetchingNextPage && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
        </div>
      )}
    </div>
  );
}
