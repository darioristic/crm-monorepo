"use client";

import { NoResults } from "@/components/vault/empty-states";
import { VaultGetStarted } from "@/components/vault/vault-get-started";
import { VaultGridSkeleton } from "@/components/vault/vault-grid-skeleton";
import { useDocumentFilterParams } from "@/hooks/use-document-filter-params";
import { useDocumentParams } from "@/hooks/use-document-params";
import { useDocumentsStore } from "@/store/vault-store";
import { documentsApi, type DocumentWithTags } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import {
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo } from "react";
import { useInView } from "react-intersection-observer";
import { BottomBar } from "./bottom-bar";
import { columns } from "./columns";
import { Loader2 } from "lucide-react";

export function DataTable() {
	const queryClient = useQueryClient();
	const { ref, inView } = useInView();
	const { filter, hasFilters } = useDocumentFilterParams();
	const { setParams } = useDocumentParams();
	const { rowSelection, setRowSelection, clearSelection } = useDocumentsStore();
  const { user } = useAuth();

	const {
		data,
		fetchNextPage,
		hasNextPage,
		isFetching,
		isFetchingNextPage,
		isLoading,
	} = useInfiniteQuery({
		queryKey: ["documents", filter, user?.companyId],
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

	const table = useReactTable({
		data: documents,
		columns,
		getCoreRowModel: getCoreRowModel(),
		onRowSelectionChange: setRowSelection,
		state: {
			rowSelection,
		},
		getRowId: (row) => row.id,
	});

	const selectedDocumentIds = Object.keys(rowSelection).filter(
		(key) => rowSelection[key]
	);

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
		<div className="relative">
			<div className="rounded-md border">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead key={header.id}>
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef.header,
													header.getContext()
											  )}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									data-state={row.getIsSelected() && "selected"}
									className="cursor-pointer"
									onClick={() => setParams({ documentId: row.original.id })}
								>
									{row.getVisibleCells().map((cell) => (
										<TableCell
											key={cell.id}
											onClick={(e) => {
												if (cell.column.id === "select") {
													e.stopPropagation();
												}
											}}
										>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext()
											)}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="h-24 text-center"
								>
									No results.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			{/* Load more trigger */}
			{hasNextPage && (
				<div ref={ref} className="flex justify-center py-8">
					{isFetchingNextPage && (
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					)}
				</div>
			)}

			{/* Bottom bar for selection actions */}
			<AnimatePresence>
				{selectedDocumentIds.length > 0 && (
					<BottomBar data={selectedDocumentIds} />
				)}
			</AnimatePresence>
		</div>
	);
}
