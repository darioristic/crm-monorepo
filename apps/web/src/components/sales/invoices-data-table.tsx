"use client";

import type { Company, Invoice } from "@crm/types";
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
import {
  getInvoicesColumns,
  type InvoiceWithCompany,
} from "@/components/sales/invoices/InvoicesColumns";
import { InvoicesToolbar } from "@/components/sales/invoices/InvoicesToolbar";
import { PaymentDialog } from "@/components/sales/invoices/PaymentDialog";
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
import { companiesApi, invoicesApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";

export function InvoicesDataTable({ refreshTrigger }: { refreshTrigger?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const selectedCompanyId = user?.companyId;
  const [searchValue, setSearchValue] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedInvoice, setSelectedInvoice] = React.useState<InvoiceWithCompany | null>(null);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = React.useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false);
  const [sorting, setSorting] = React.useState<SortingState>([]);

  // Open invoice in sheet
  const handleOpenSheet = React.useCallback(
    (invoiceId: string) => {
      router.push(`${pathname}?type=edit&invoiceId=${invoiceId}`);
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

  // Fetch invoices with server-side pagination
  const {
    data: invoices,
    isLoading,
    error,
    refetch,
    page,
    pageSize,
    totalCount,
    totalPages,
    setPage,
    setFilters,
  } = usePaginatedApi<Invoice>((params) => invoicesApi.getAll(params), {
    search: searchValue,
    status: statusFilter === "all" ? undefined : statusFilter,
    companyId: selectedCompanyId,
    sortBy: sorting[0]?.id,
    sortOrder: sorting[0] ? (sorting[0].desc ? "desc" : "asc") : undefined,
  });

  // Delete mutation
  const deleteMutation = useMutation<void, string>((id) => invoicesApi.delete(id));

  // Enrich invoices with company names
  const enrichedInvoices: InvoiceWithCompany[] = React.useMemo(() => {
    return (invoices || []).map((invoice) => ({
      ...invoice,
      companyName: companyMap.get(invoice.companyId) || "Unknown Company",
    }));
  }, [invoices, companyMap]);

  // Handle search with debounce
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setFilters({
        search: searchValue,
        status: statusFilter === "all" ? undefined : statusFilter,
        companyId: selectedCompanyId,
        sortBy: sorting[0]?.id,
        sortOrder: sorting[0] ? (sorting[0].desc ? "desc" : "asc") : undefined,
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue, statusFilter, selectedCompanyId, sorting, setFilters]);

  // Handle external refresh trigger
  React.useEffect(() => {
    if (refreshTrigger) {
      refetch();
    }
  }, [refreshTrigger, refetch]);

  // Surface backend error details to the user
  React.useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  // Handle delete
  const handleDelete = async () => {
    if (!selectedInvoice) return;

    const result = await deleteMutation.mutate(selectedInvoice.id);
    if (result.success) {
      toast.success("Invoice deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedInvoice(null);
      refetch();
    } else {
      toast.error(getErrorMessage(result.error, "Failed to delete invoice"));
    }
  };

  const [paymentDialogOpen, setPaymentDialogOpen] = React.useState(false);
  const [paymentInvoice, setPaymentInvoice] = React.useState<InvoiceWithCompany | null>(null);

  const handleRecordPayment = async (invoiceId: string, amount: number) => {
    const result = await invoicesApi.recordPayment(invoiceId, amount);
    if (result.success) {
      toast.success("Payment recorded successfully");
      setPaymentDialogOpen(false);
      setPaymentInvoice(null);
      refetch();
    } else {
      toast.error(getErrorMessage(result.error, "Failed to record payment"));
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
      const invoice = enrichedInvoices[parseInt(rowIndex, 10)];
      if (invoice) {
        const result = await deleteMutation.mutate(invoice.id);
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
      toast.success(`Successfully deleted ${successCount} invoice(s)`);
    }
    if (failCount > 0) {
      toast.error(`Failed to delete ${failCount} invoice(s)`);
    }
    refetch();
  };

  const selectedCount = Object.keys(rowSelection).length;

  const columns = React.useMemo(
    () =>
      getInvoicesColumns({
        onDelete: (invoice) => {
          setSelectedInvoice(invoice);
          setDeleteDialogOpen(true);
        },
        onRecordPayment: (invoice) => {
          setPaymentInvoice(invoice);
          setPaymentDialogOpen(true);
        },
        onOpenSheet: handleOpenSheet,
        onConvertToDeliveryNote: async (invoice) => {
          try {
            await invoicesApi.convertToDeliveryNote(invoice.id);
            toast.success("Invoice successfully converted to delivery note!");
            refetch();
          } catch (error) {
            toast.error("Failed to convert invoice to delivery note");
            console.error(error);
          }
        },
      }),
    [handleOpenSheet, refetch]
  );

  const table = useReactTable({
    data: enrichedInvoices,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages,
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
      sorting,
    },
    manualSorting: true,
    onSortingChange: setSorting,
  });

  if (isLoading && !invoices?.length) {
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
          <InvoicesToolbar
            search={searchValue}
            onSearchChange={setSearchValue}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onRefresh={refetch}
            isLoading={isLoading}
            onNewInvoice={() => router.push(`${pathname}?type=create`)}
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
                  No invoices found.
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
              {totalCount} invoices
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
        title="Delete Invoice"
        description={`Are you sure you want to delete invoice ${selectedInvoice?.invoiceNumber}? This action cannot be undone.`}
        onConfirm={handleDelete}
        isLoading={deleteMutation.isLoading}
      />

      <PaymentDialog
        invoice={paymentInvoice}
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        onSubmit={handleRecordPayment}
      />

      <DeleteDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        title="Delete Selected Invoices"
        description={`Are you sure you want to delete ${selectedCount} selected invoice(s)? This action cannot be undone.`}
        onConfirm={handleBulkDelete}
        isLoading={isBulkDeleting}
      />
    </div>
  );
}
