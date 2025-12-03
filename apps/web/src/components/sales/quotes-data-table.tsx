"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  RowSelectionState,
} from "@tanstack/react-table";
import type { Quote, Company } from "@crm/types";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { quotesApi, companiesApi } from "@/lib/api";
import { usePaginatedApi, useMutation } from "@/hooks/use-api";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { getQuotesColumns, type QuoteWithCompany } from "@/components/sales/quotes/QuotesColumns";
import { QuotesToolbar } from "@/components/sales/quotes/QuotesToolbar";

export function QuotesDataTable() {
  const router = useRouter();
  const pathname = usePathname();
  const [searchValue, setSearchValue] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedQuote, setSelectedQuote] = React.useState<QuoteWithCompany | null>(null);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = React.useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false);

  // Open quote in sheet
  const handleOpenSheet = React.useCallback((quoteId: string) => {
    router.push(`${pathname}?type=edit&quoteId=${quoteId}`);
  }, [router, pathname]);

  // Fetch companies for name lookup - use paginated API to get all companies
  const {
    data: companies,
  } = usePaginatedApi<Company>(
    (params) => companiesApi.getAll({ ...params, pageSize: 1000 }), // Get all companies
    {}
  );

  // Create company lookup map
  const companyMap = React.useMemo(() => {
    const map = new Map<string, string>();
    if (companies && Array.isArray(companies)) {
      companies.forEach((company) => {
        if (company?.id && company?.name) {
          map.set(company.id, company.name);
        }
      });
    }
    return map;
  }, [companies]);

  // Fetch quotes with server-side pagination
  const {
    data: quotes,
    isLoading,
    error,
    refetch,
    page,
    pageSize,
    totalCount,
    totalPages,
    setPage,
    setFilters
  } = usePaginatedApi<Quote>(
    (params) => quotesApi.getAll(params),
    { search: searchValue, status: statusFilter === "all" ? undefined : statusFilter }
  );

  // Delete mutation
  const deleteMutation = useMutation<void, string>((id) => quotesApi.delete(id));

  // Enrich quotes with company names
  const enrichedQuotes: QuoteWithCompany[] = React.useMemo(() => {
    return (quotes || []).map((quote) => ({
      ...quote,
      companyName: companyMap.get(quote.companyId) || "Unknown Company"
    }));
  }, [quotes, companyMap]);

  // Handle search with debounce
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setFilters({ 
        search: searchValue, 
        status: statusFilter === "all" ? undefined : statusFilter 
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue, statusFilter, setFilters]);

  // Handle delete
  const handleDelete = async () => {
    if (!selectedQuote) return;

    const result = await deleteMutation.mutate(selectedQuote.id);
    if (result.success) {
      toast.success("Quote deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedQuote(null);
      refetch();
    } else {
      toast.error(getErrorMessage(result.error, "Failed to delete quote"));
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    const selectedRows = Object.keys(rowSelection);
    if (selectedRows.length === 0) return;

    setIsBulkDeleting(true);
    let successCount = 0;
    let failCount = 0;

    for (const rowIndex of selectedRows) {
      const quote = enrichedQuotes[parseInt(rowIndex)];
      if (quote) {
        const result = await deleteMutation.mutate(quote.id);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      }
    }

    setIsBulkDeleting(false);
    setBulkDeleteDialogOpen(false);
    setRowSelection({});

    if (successCount > 0) {
      toast.success(`Successfully deleted ${successCount} quote(s)`);
    }
    if (failCount > 0) {
      toast.error(`Failed to delete ${failCount} quote(s)`);
    }
    refetch();
  };

  const selectedCount = Object.keys(rowSelection).length;

  const columns = React.useMemo(
    () =>
      getQuotesColumns({
        onEdit: (quote) => {
          handleOpenSheet(quote.id);
        },
        onDelete: (quote) => {
          setSelectedQuote(quote);
          setDeleteDialogOpen(true);
        },
      }),
    [handleOpenSheet]
  );

  const table = useReactTable({
    data: enrichedQuotes,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages,
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
    },
  });

  if (isLoading && !quotes?.length) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={() => refetch()}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <QuotesToolbar
            search={searchValue}
            onSearchChange={setSearchValue}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onRefresh={refetch}
            isLoading={isLoading}
          />
        </div>
        {selectedCount > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setBulkDeleteDialogOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete ({selectedCount})
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
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
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No quotes found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between pt-4">
        <div className="text-sm text-muted-foreground">
          {selectedCount > 0 ? (
            <span>{selectedCount} of {totalCount} row(s) selected</span>
          ) : (
            <span>Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} quotes</span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page - 1)}
            disabled={page <= 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page + 1)}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </div>
      </div>

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Quote"
        description={`Are you sure you want to delete quote ${selectedQuote?.quoteNumber}? This action cannot be undone.`}
        onConfirm={handleDelete}
        isLoading={deleteMutation.isLoading}
      />

      <DeleteDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        title="Delete Selected Quotes"
        description={`Are you sure you want to delete ${selectedCount} selected quote(s)? This action cannot be undone.`}
        onConfirm={handleBulkDelete}
        isLoading={isBulkDeleting}
      />
    </div>
  );
}
