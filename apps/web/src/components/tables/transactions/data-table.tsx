"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  type RowSelectionState,
  useReactTable,
} from "@tanstack/react-table";
import { AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useInView } from "react-intersection-observer";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useTransactionParams } from "@/hooks/use-transaction-params";
import { paymentsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { BottomBar } from "./bottom-bar";
import { columns, type TransactionRow } from "./columns";
import { NoResults, NoTransactions } from "./empty-states";
import { Loading } from "./loading";

interface FilterParams {
  search?: string;
  status?: string;
  method?: string;
  tagId?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface DataTableProps {
  filters?: FilterParams;
}

export function DataTable({ filters = {} }: DataTableProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { ref, inView } = useInView();
  const { setTransactionId } = useTransactionParams();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

  const hasFilters = Object.values(filters).some((v) => v !== undefined && v !== "");

  // Fetch transactions with infinite query
  const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ["transactions", filters],
      queryFn: async ({ pageParam }) => {
        const response = await paymentsApi.getAll({
          pageSize: 50,
          page: pageParam,
          search: filters.search,
          status: filters.status,
          paymentMethod: filters.method,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
        });
        return {
          data: response.data || [],
          meta: response.meta,
        };
      },
      getNextPageParam: (lastPage) => {
        if (!lastPage.meta) return undefined;
        const { page, totalPages } = lastPage.meta;
        return page < totalPages ? page + 1 : undefined;
      },
      initialPageParam: 1,
    });

  // Flatten pages into single array
  const transactions = useMemo(() => {
    return (data?.pages.flatMap((page) => page.data) ?? []) as TransactionRow[];
  }, [data]);

  // Get total count from first page meta
  const totalCount = data?.pages[0]?.meta?.totalCount ?? transactions.length;

  // Load more when scrolling
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Handle shift-click range selection
  const handleShiftClickRange = useCallback(
    (startIndex: number, endIndex: number) => {
      const start = Math.min(startIndex, endIndex);
      const end = Math.max(startIndex, endIndex);

      // Check if all in range are selected
      let allSelected = true;
      for (let i = start; i <= end; i++) {
        const row = transactions[i];
        if (row && !rowSelection[row.id]) {
          allSelected = false;
          break;
        }
      }

      // Toggle selection
      setRowSelection((prev) => {
        const newSelection = { ...prev };
        for (let i = start; i <= end; i++) {
          const row = transactions[i];
          if (row) {
            if (allSelected) {
              delete newSelection[row.id];
            } else {
              newSelection[row.id] = true;
            }
          }
        }
        return newSelection;
      });
    },
    [transactions, rowSelection]
  );

  // Copy transaction URL
  const handleCopyUrl = useCallback((id: string) => {
    const url = `${window.location.origin}/dashboard/payments?transactionId=${id}`;
    navigator.clipboard.writeText(url);
    toast.success("URL copied to clipboard");
  }, []);

  // View invoice
  const handleViewInvoice = useCallback(
    (invoiceId: string) => {
      router.push(`/dashboard/sales/invoices/${invoiceId}`);
    },
    [router]
  );

  // Delete transaction
  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await paymentsApi.delete(id);
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        toast.success("Transaction deleted");
      } catch {
        toast.error("Failed to delete transaction");
      }
    },
    [queryClient]
  );

  // Table instance
  const table = useReactTable({
    data: transactions,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
    state: {
      rowSelection,
    },
    meta: {
      onViewDetails: setTransactionId,
      onCopyUrl: handleCopyUrl,
      onDelete: handleDelete,
      onViewInvoice: handleViewInvoice,
      lastClickedIndex,
      setLastClickedIndex,
      handleShiftClickRange,
    },
  });

  const selectedIds = Object.keys(rowSelection).filter((key) => rowSelection[key]);

  // Empty states
  if (isLoading) {
    return <Loading />;
  }

  if (!transactions.length && !hasFilters) {
    return (
      <div className="relative h-[calc(100vh-300px)] overflow-hidden">
        <NoTransactions />
      </div>
    );
  }

  if (!transactions.length && hasFilters) {
    return (
      <div className="relative h-[calc(100vh-300px)] overflow-hidden">
        <NoResults />
      </div>
    );
  }

  return (
    <div className="relative">
      <TooltipProvider delayDuration={20}>
        <div className="rounded-md border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={cn(
                          header.column.id === "select" && "w-[40px]",
                          header.column.id === "actions" && "w-[60px]"
                        )}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
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
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setTransactionId(row.original.id)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          onClick={(e) => {
                            // Don't open sheet for select/actions columns
                            if (cell.column.id === "select" || cell.column.id === "actions") {
                              e.stopPropagation();
                            }
                          }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Pagination footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <span className="text-sm text-muted-foreground">
            Showing {transactions.length} of {totalCount} transactions
          </span>
          {hasNextPage && (
            <div ref={ref} className="flex items-center gap-2">
              {isFetchingNextPage ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Loading more...</span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">Scroll for more</span>
              )}
            </div>
          )}
          {!hasNextPage && transactions.length > 0 && (
            <span className="text-sm text-muted-foreground">All loaded</span>
          )}
        </div>
      </TooltipProvider>

      {/* Bottom bar for bulk actions */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <BottomBar selectedIds={selectedIds} onClearSelection={() => setRowSelection({})} />
        )}
      </AnimatePresence>
    </div>
  );
}
