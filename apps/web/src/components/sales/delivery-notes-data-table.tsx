"use client";

import type { Company, DeliveryNote } from "@crm/types";
import {
  flexRender,
  getCoreRowModel,
  type RowSelectionState,
  useReactTable,
} from "@tanstack/react-table";
import { Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import {
  type DeliveryNoteWithCompany,
  getDeliveryColumns,
} from "@/components/sales/delivery/DeliveryColumns";
import { DeliveryToolbar } from "@/components/sales/delivery/DeliveryToolbar";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMutation, usePaginatedApi } from "@/hooks/use-api";
import { companiesApi, deliveryNotesApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";

export function DeliveryNotesDataTable() {
  const [searchValue, setSearchValue] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedNote, setSelectedNote] = React.useState<DeliveryNoteWithCompany | null>(null);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = React.useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false);

  // Fetch companies for name lookup - use paginated API to get all companies
  const { data: companies } = usePaginatedApi<Company>(
    (params) => companiesApi.getAll({ ...params, pageSize: 1000, source: "customer" }), // Customers only
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

  // Fetch delivery notes with server-side pagination
  const {
    data: deliveryNotes,
    isLoading,
    error,
    refetch,
    page,
    pageSize,
    totalCount,
    totalPages,
    setPage,
    setFilters,
  } = usePaginatedApi<DeliveryNote>((params) => deliveryNotesApi.getAll(params), {
    search: searchValue,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  // Delete mutation
  const deleteMutation = useMutation<void, string>((id) => deliveryNotesApi.delete(id));

  // Enrich delivery notes with company names
  const enrichedNotes: DeliveryNoteWithCompany[] = React.useMemo(() => {
    return (deliveryNotes || []).map((note) => ({
      ...note,
      companyName: companyMap.get(note.companyId) || "Unknown Company",
    }));
  }, [deliveryNotes, companyMap]);

  // Handle search with debounce
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setFilters({
        search: searchValue,
        status: statusFilter === "all" ? undefined : statusFilter,
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue, statusFilter, setFilters]);

  // Handle delete
  const handleDelete = async () => {
    if (!selectedNote) return;

    const result = await deleteMutation.mutate(selectedNote.id);
    if (result.success) {
      toast.success("Delivery note deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedNote(null);
      refetch();
    } else {
      toast.error(getErrorMessage(result.error, "Failed to delete delivery note"));
    }
  };

  const handleMarkDelivered = async (note: DeliveryNoteWithCompany) => {
    const result = await deliveryNotesApi.update(note.id, { status: "delivered" });
    if (result.success) {
      toast.success("Delivery marked as delivered");
      refetch();
    } else {
      toast.error(getErrorMessage(result.error, "Failed to update delivery status"));
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
      const note = enrichedNotes[parseInt(rowIndex, 10)];
      if (note) {
        const result = await deleteMutation.mutate(note.id);
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
      toast.success(`Successfully deleted ${successCount} delivery note(s)`);
    }
    if (failCount > 0) {
      toast.error(`Failed to delete ${failCount} delivery note(s)`);
    }
    refetch();
  };

  const selectedCount = Object.keys(rowSelection).length;

  const columns = React.useMemo(
    () =>
      getDeliveryColumns({
        onDelete: (note) => {
          setSelectedNote(note);
          setDeleteDialogOpen(true);
        },
        onMarkDelivered: handleMarkDelivered,
      }),
    []
  );

  const table = useReactTable({
    data: enrichedNotes,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages,
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
    },
  });

  if (isLoading && !deliveryNotes?.length) {
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
          <DeliveryToolbar
            search={searchValue}
            onSearchChange={setSearchValue}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onRefresh={refetch}
            isLoading={isLoading}
          />
        </div>
        {selectedCount > 0 && (
          <Button variant="destructive" size="sm" onClick={() => setBulkDeleteDialogOpen(true)}>
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
                  No delivery notes found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between pt-4">
        <div className="text-sm text-muted-foreground">
          {selectedCount > 0 ? (
            <span>
              {selectedCount} of {totalCount} row(s) selected
            </span>
          ) : (
            <span>
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of{" "}
              {totalCount} delivery notes
            </span>
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
        title="Delete Delivery Note"
        description={`Are you sure you want to delete delivery note ${selectedNote?.deliveryNumber}? This action cannot be undone.`}
        onConfirm={handleDelete}
        isLoading={deleteMutation.isLoading}
      />

      <DeleteDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        title="Delete Selected Delivery Notes"
        description={`Are you sure you want to delete ${selectedCount} selected delivery note(s)? This action cannot be undone.`}
        onConfirm={handleBulkDelete}
        isLoading={isBulkDeleting}
      />
    </div>
  );
}
