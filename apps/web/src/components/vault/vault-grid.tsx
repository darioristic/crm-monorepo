"use client";

import { VaultItem } from "./vault-item";
import { useDocumentFilterParams } from "@/hooks/use-document-filter-params";
import { documentsApi, type DocumentWithTags } from "@/lib/api";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useInView } from "react-intersection-observer";
import { NoResults } from "./empty-states";
import { VaultGetStarted } from "./vault-get-started";
import { VaultGridSkeleton } from "./vault-grid-skeleton";
import { Loader2 } from "lucide-react";

export function VaultGrid() {
	const queryClient = useQueryClient();
	const { ref, inView } = useInView();
	const { filter, hasFilters } = useDocumentFilterParams();

	const {
		data,
		fetchNextPage,
		hasNextPage,
		isFetching,
		isFetchingNextPage,
		isLoading,
	} = useInfiniteQuery({
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
	});

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
					{isFetchingNextPage && (
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					)}
				</div>
			)}
		</div>
	);
}

