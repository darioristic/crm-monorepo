"use client";

/* eslint-disable react/no-array-index-key */

import type { Company, Order } from "@crm/types";
import {
  flexRender,
  getCoreRowModel,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { OrderSheet } from "@/components/order";
import { getOrderColumns, type OrderWithCompany } from "@/components/sales/orders/OrderColumns";
import { OrderToolbar } from "@/components/sales/orders/OrderToolbar";
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
import { useAuth } from "@/contexts/auth-context";
import { useMutation, usePaginatedApi } from "@/hooks/use-api";
import { companiesApi, ordersApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";

type OrdersDataTableProps = {
  refreshTrigger?: number;
};

export function OrdersDataTable({ refreshTrigger }: OrdersDataTableProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const [searchValue, setSearchValue] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedOrder, setSelectedOrder] = React.useState<OrderWithCompany | null>(null);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = React.useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false);
  const [sorting, setSorting] = React.useState<SortingState>([]);

  // Open order in sheet
  const handleOpenSheet = React.useCallback(
    (orderId: string) => {
      router.push(`${pathname}?type=edit&orderId=${orderId}`);
    },
    [router, pathname]
  );

  // Fetch companies for name lookup - use paginated API to get all companies
  const { data: companies } = usePaginatedApi<Company>(
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

  // Fetch orders with server-side pagination
  // Use useMemo to avoid recreating initialFilters object on every render
  const initialFilters = React.useMemo(
    () => ({
      search: searchValue,
      status: statusFilter === "all" ? undefined : statusFilter,
      companyId: user?.companyId,
      sortBy: sorting[0]?.id,
      sortOrder: sorting[0] ? ((sorting[0].desc ? "desc" : "asc") as "asc" | "desc") : undefined,
    }),
    [searchValue, statusFilter, user?.companyId, sorting]
  );

  const {
    data: orders,
    isLoading,
    error,
    refetch,
    page,
    pageSize,
    totalCount,
    totalPages,
    setPage,
    setFilters,
  } = usePaginatedApi<Order>((params) => ordersApi.getAll(params), initialFilters);

  // Refresh data when refreshTrigger changes
  React.useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      refetch();
    }
  }, [refreshTrigger, refetch]);

  // Delete mutation
  const deleteMutation = useMutation<void, string>((id) => ordersApi.delete(id));

  // Enrich orders with company names
  const enrichedOrders: OrderWithCompany[] = React.useMemo(() => {
    if (!orders || !Array.isArray(orders)) {
      return [];
    }
    return orders.map((order) => ({
      ...order,
      companyName: companyMap.get(order.companyId) || "Unknown Company",
    }));
  }, [orders, companyMap]);

  // Handle search with debounce - update filters when they change
  const prevFiltersRef = React.useRef({
    search: searchValue,
    status: statusFilter,
  });
  React.useEffect(() => {
    const newFilters = {
      search: searchValue,
      status: statusFilter === "all" ? undefined : statusFilter,
    };

    // Only update if filters actually changed
    if (
      newFilters.search !== prevFiltersRef.current.search ||
      newFilters.status !== prevFiltersRef.current.status
    ) {
      prevFiltersRef.current = { search: searchValue, status: statusFilter };
      const timer = setTimeout(() => {
        setFilters(newFilters);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchValue, statusFilter, setFilters]);

  // Handle delete
  const handleDelete = async () => {
    if (!selectedOrder) return;

    const result = await deleteMutation.mutate(selectedOrder.id);

    if (result.success) {
      toast.success("Order deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedOrder(null);
      refetch();
    } else {
      toast.error(getErrorMessage(result.error, "Failed to delete order"));
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    const selectedIds = Object.keys(rowSelection);
    if (selectedIds.length === 0) return;

    setIsBulkDeleting(true);
    try {
      const deletePromises = selectedIds.map((id) => ordersApi.delete(id));
      await Promise.all(deletePromises);
      toast.success(`Deleted ${selectedIds.length} order(s) successfully`);
      setBulkDeleteDialogOpen(false);
      setRowSelection({});
      refetch();
    } catch {
      toast.error("Failed to delete orders");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const columns = React.useMemo(
    () =>
      getOrderColumns({
        onEdit: (order) => handleOpenSheet(order.id),
        onDelete: (order) => {
          setSelectedOrder(order);
          setDeleteDialogOpen(true);
        },
        onConvertToInvoice: async (order) => {
          try {
            await ordersApi.convertToInvoice(order.id);
            toast.success("Order successfully converted to invoice!");
            refetch();
          } catch (error) {
            toast.error("Failed to convert order to invoice");
            console.error(error);
          }
        },
        onConvertToDeliveryNote: async (order) => {
          try {
            await ordersApi.convertToDeliveryNote(order.id);
            toast.success("Order successfully converted to delivery note!");
            refetch();
          } catch (error) {
            toast.error("Failed to convert order to delivery note");
            console.error(error);
          }
        },
      }),
    [handleOpenSheet, refetch]
  );

  const table = useReactTable({
    data: enrichedOrders,
    columns,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
      sorting,
    },
    manualPagination: true,
    pageCount: totalPages,
    manualSorting: true,
    onSortingChange: setSorting,
  });

  const selectedCount = Object.keys(rowSelection).length;

  if (error) {
    return (
      <div className="rounded-md border border-destructive bg-destructive/10 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-destructive">Failed to load orders</p>
            <p className="text-sm text-destructive/80 mt-1">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <OrderToolbar
          search={searchValue}
          onSearchChange={setSearchValue}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onRefresh={refetch}
          isLoading={isLoading}
          onNewOrder={() => router.push(`${pathname}?type=create`)}
        />

        {selectedCount > 0 && (
          <div className="flex items-center justify-between rounded-md border bg-muted/50 p-2">
            <span className="text-sm text-muted-foreground">{selectedCount} order(s) selected</span>
            <Button variant="destructive" size="sm" onClick={() => setBulkDeleteDialogOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Selected
            </Button>
          </div>
        )}

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
              {isLoading ? (
                ["row-1", "row-2", "row-3", "row-4", "row-5"].map((rowKey) => (
                  <TableRow key={`skeleton-${rowKey}`}>
                    <TableCell colSpan={columns.length}>
                      <div className="grid grid-cols-12 gap-2">
                        <Skeleton className="h-4 col-span-3" />
                        <Skeleton className="h-4 col-span-3" />
                        <Skeleton className="h-4 col-span-2" />
                        <Skeleton className="h-4 col-span-2" />
                        <Skeleton className="h-4 col-span-2" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : table.getRowModel().rows?.length ? (
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
                    No orders found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of{" "}
              {totalCount} orders
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1 || isLoading}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages || isLoading}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Delete Dialog */}
        <DeleteDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={handleDelete}
          title="Delete Order"
          description={`Are you sure you want to delete order ${selectedOrder?.orderNumber}? This action cannot be undone.`}
          isLoading={deleteMutation.isLoading}
        />

        {/* Bulk Delete Dialog */}
        <DeleteDialog
          open={bulkDeleteDialogOpen}
          onOpenChange={setBulkDeleteDialogOpen}
          onConfirm={handleBulkDelete}
          title="Delete Orders"
          description={`Are you sure you want to delete ${selectedCount} order(s)? This action cannot be undone.`}
          isLoading={isBulkDeleting}
        />
      </div>

      {/* Order Sheet */}
      <OrderSheet />
    </>
  );
}
