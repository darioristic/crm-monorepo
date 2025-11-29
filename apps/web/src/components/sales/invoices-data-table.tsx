"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable
} from "@tanstack/react-table";
import type { Invoice, Company } from "@crm/types";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { invoicesApi, companiesApi } from "@/lib/api";
import { usePaginatedApi, useMutation, useApi } from "@/hooks/use-api";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { toast } from "sonner";
import { getInvoicesColumns, type InvoiceWithCompany } from "@/components/sales/invoices/InvoicesColumns";
import { InvoicesToolbar } from "@/components/sales/invoices/InvoicesToolbar";
import { PaymentDialog } from "@/components/sales/invoices/PaymentDialog";

export function InvoicesDataTable() {
  const [searchValue, setSearchValue] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedInvoice, setSelectedInvoice] = React.useState<InvoiceWithCompany | null>(null);

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
    setFilters
  } = usePaginatedApi<Invoice>(
    (params) => invoicesApi.getAll(params),
    { search: searchValue, status: statusFilter === "all" ? undefined : statusFilter }
  );

  // Delete mutation
  const deleteMutation = useMutation<void, string>((id) => invoicesApi.delete(id));

  // Enrich invoices with company names
  const enrichedInvoices: InvoiceWithCompany[] = React.useMemo(() => {
    return (invoices || []).map((invoice) => ({
      ...invoice,
      companyName: companyMap.get(invoice.companyId) || "Unknown Company"
    }));
  }, [invoices, companyMap]);

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
    if (!selectedInvoice) return;

    const result = await deleteMutation.mutate(selectedInvoice.id);
    if (result.success) {
      toast.success("Invoice deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedInvoice(null);
      refetch();
    } else {
      toast.error(result.error || "Failed to delete invoice");
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
      toast.error(result.error?.message || "Failed to record payment");
    }
  };

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
      }),
    []
  );

  const table = useReactTable({
    data: enrichedInvoices,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages
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
      <InvoicesToolbar
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
                  No invoices found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between pt-4">
        <div className="text-sm text-muted-foreground">
          Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} invoices
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
    </div>
  );
}
