"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable
} from "@tanstack/react-table";
import type { DeliveryNote, Company } from "@crm/types";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { deliveryNotesApi, companiesApi } from "@/lib/api";
import { usePaginatedApi, useMutation, useApi } from "@/hooks/use-api";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { toast } from "sonner";
import { getDeliveryColumns, type DeliveryNoteWithCompany } from "@/components/sales/delivery/DeliveryColumns";
import { DeliveryToolbar } from "@/components/sales/delivery/DeliveryToolbar";

export function DeliveryNotesDataTable() {
  const [searchValue, setSearchValue] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedNote, setSelectedNote] = React.useState<DeliveryNoteWithCompany | null>(null);

  // Fetch companies for name lookup
  const { data: companies } = useApi<Company[]>(
    () => companiesApi.getAll(),
    { autoFetch: true }
  );

  // Create company lookup map
  const companyMap = React.useMemo(() => {
    const map = new Map<string, string>();
    companies?.forEach((company) => {
      map.set(company.id, company.name);
    });
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
    setFilters
  } = usePaginatedApi<DeliveryNote>(
    (params) => deliveryNotesApi.getAll(params),
    { search: searchValue, status: statusFilter === "all" ? undefined : statusFilter }
  );

  // Delete mutation
  const deleteMutation = useMutation<void, string>((id) => deliveryNotesApi.delete(id));

  // Enrich delivery notes with company names
  const enrichedNotes: DeliveryNoteWithCompany[] = React.useMemo(() => {
    return (deliveryNotes || []).map((note) => ({
      ...note,
      companyName: companyMap.get(note.companyId) || "Unknown Company"
    }));
  }, [deliveryNotes, companyMap]);

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
    if (!selectedNote) return;

    const result = await deleteMutation.mutate(selectedNote.id);
    if (result.success) {
      toast.success("Delivery note deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedNote(null);
      refetch();
    } else {
      toast.error(result.error || "Failed to delete delivery note");
    }
  };

  const handleMarkDelivered = async (note: DeliveryNoteWithCompany) => {
    const result = await deliveryNotesApi.update(note.id, { status: "delivered" });
    if (result.success) {
      toast.success("Delivery marked as delivered");
      refetch();
    } else {
      toast.error(result.error?.message || "Failed to update delivery status");
    }
  };

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
    pageCount: totalPages
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
      <DeliveryToolbar
        search={searchValue}
        onSearchChange={setSearchValue}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onRefresh={refetch}
        isLoading={isLoading}
      />

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
                <TableRow key={row.id}>
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
          Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} delivery notes
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
    </div>
  );
}
