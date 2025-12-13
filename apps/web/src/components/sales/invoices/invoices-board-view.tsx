"use client";

import type { InvoiceFormValues } from "@crm/schemas";
import type { Company, Invoice } from "@crm/types";
import { Filter, LayoutGrid, MoreHorizontal, RefreshCw, Search } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { InvoiceSheet } from "@/components/sheets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useMutation, usePaginatedApi } from "@/hooks/use-api";
import { companiesApi, invoicesApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { DEFAULT_INVOICE_TEMPLATE } from "@/types/invoice";
import { InvoiceCard, type InvoiceWithCompany } from "./invoice-card";
import { PaymentDialog } from "./PaymentDialog";

type BoardColumn = {
  id: string;
  title: string;
  statuses: string[];
  color: string;
  bgColor: string;
};

const boardColumns: BoardColumn[] = [
  {
    id: "unpaid",
    title: "Unpaid",
    statuses: ["sent", "overdue", "partial"],
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/30",
  },
  {
    id: "paid",
    title: "Paid",
    statuses: ["paid"],
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950/30",
  },
  {
    id: "draft",
    title: "Draft",
    statuses: ["draft", "cancelled"],
    color: "text-slate-600 dark:text-slate-400",
    bgColor: "bg-slate-50 dark:bg-slate-900/30",
  },
];

interface InvoicesBoardViewProps {
  onNewInvoice?: () => void;
}

export function InvoicesBoardView({ onNewInvoice: _onNewInvoice }: InvoicesBoardViewProps) {
  const [searchValue, setSearchValue] = React.useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedInvoice, setSelectedInvoice] = React.useState<InvoiceWithCompany | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = React.useState(false);
  const [paymentInvoice, setPaymentInvoice] = React.useState<InvoiceWithCompany | null>(null);
  const [editSheetOpen, setEditSheetOpen] = React.useState(false);
  const [editInvoice, setEditInvoice] = React.useState<InvoiceWithCompany | null>(null);

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

  // Fetch all invoices
  const {
    data: invoices,
    isLoading,
    error,
    refetch,
  } = usePaginatedApi<Invoice>((params) => invoicesApi.getAll({ ...params, pageSize: 200 }), {
    search: searchValue,
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

  // Filter by search
  const filteredInvoices = React.useMemo(() => {
    if (!searchValue) return enrichedInvoices;

    const search = searchValue.toLowerCase();
    return enrichedInvoices.filter(
      (invoice) =>
        invoice.invoiceNumber.toLowerCase().includes(search) ||
        invoice.companyName?.toLowerCase().includes(search) ||
        invoice.notes?.toLowerCase().includes(search)
    );
  }, [enrichedInvoices, searchValue]);

  // Group invoices by column
  const groupedInvoices = React.useMemo(() => {
    const groups: Record<string, InvoiceWithCompany[]> = {};

    boardColumns.forEach((column) => {
      groups[column.id] = filteredInvoices.filter((invoice) =>
        column.statuses.includes(invoice.status)
      );
    });

    return groups;
  }, [filteredInvoices]);

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

  // Handle payment recording
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

  if (isLoading && !invoices?.length) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 flex-1 max-w-sm" />
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
        <div className="flex gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 min-w-[320px]">
              <Skeleton className="h-10 w-full mb-4" />
              <div className="space-y-4">
                {[1, 2, 3].map((j) => (
                  <Skeleton key={j} className="h-[160px] w-full rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
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
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search invoice..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <Button variant="outline" size="sm" className="gap-2">
          <LayoutGrid className="h-4 w-4" />
          View
        </Button>

        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          Filter
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => refetch()}
          disabled={isLoading}
          className="h-9 w-9"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Kanban Board */}
      <ScrollArea className="w-full">
        <div className="flex gap-6 pb-4 min-w-max">
          {boardColumns.map((column) => {
            const columnInvoices = groupedInvoices[column.id] || [];

            return (
              <div key={column.id} className="flex-shrink-0 w-[360px]">
                {/* Column Header */}
                <div
                  className={`flex items-center justify-between px-3 py-2 rounded-lg mb-4 ${column.bgColor}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${column.color.replace("text-", "bg-")}`}
                    />
                    <span className={`font-semibold ${column.color}`}>{column.title}</span>
                    <span className={`text-sm ${column.color} opacity-70`}>
                      {columnInvoices.length}
                    </span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>

                {/* Column Content */}
                <div className="space-y-3">
                  {columnInvoices.length === 0 ? (
                    <div className="flex items-center justify-center h-32 border-2 border-dashed rounded-xl text-muted-foreground text-sm">
                      No invoices
                    </div>
                  ) : (
                    columnInvoices.map((invoice) => (
                      <InvoiceCard
                        key={invoice.id}
                        invoice={invoice}
                        onEdit={(inv) => {
                          setEditInvoice(inv);
                          setEditSheetOpen(true);
                        }}
                        onDelete={(inv) => {
                          setSelectedInvoice(inv);
                          setDeleteDialogOpen(true);
                        }}
                        onRecordPayment={(inv) => {
                          setPaymentInvoice(inv);
                          setPaymentDialogOpen(true);
                        }}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Delete Dialog */}
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Invoice"
        description={`Are you sure you want to delete invoice ${selectedInvoice?.invoiceNumber}? This action cannot be undone.`}
        onConfirm={handleDelete}
        isLoading={deleteMutation.isLoading}
      />

      {/* Payment Dialog */}
      <PaymentDialog
        invoice={paymentInvoice}
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        onSubmit={handleRecordPayment}
      />

      {/* Edit Invoice Sheet */}
      <InvoiceSheet
        open={editSheetOpen}
        onOpenChange={(open) => {
          setEditSheetOpen(open);
          if (!open) setEditInvoice(null);
        }}
        invoiceId={editInvoice?.id}
        invoiceData={
          editInvoice
            ? {
                id: editInvoice.id,
                status: ((
                  ["draft", "sent", "paid", "partial", "overdue", "cancelled"] as Array<
                    InvoiceFormValues["status"]
                  >
                ).includes(editInvoice.status as InvoiceFormValues["status"])
                  ? (editInvoice.status as InvoiceFormValues["status"])
                  : "draft") as InvoiceFormValues["status"],
                invoiceNumber: editInvoice.invoiceNumber,
                issueDate: editInvoice.issueDate,
                dueDate: editInvoice.dueDate,
                customerId: editInvoice.companyId,
                customerName: editInvoice.companyName,
                subtotal: editInvoice.subtotal,
                vat: editInvoice.tax,
                amount: editInvoice.total,
                lineItems: editInvoice.items?.map((item) => ({
                  name: item.productName,
                  quantity: item.quantity,
                  price: item.unitPrice,
                  unit: "pcs",
                  discount: item.discount ?? 0,
                  vat: item.vatRate ?? 20,
                })) || [
                  {
                    name: "",
                    quantity: 1,
                    price: 0,
                    unit: "pcs",
                    discount: 0,
                    vat: 20,
                  },
                ],
                template: {
                  ...DEFAULT_INVOICE_TEMPLATE,
                  vatRate: editInvoice.taxRate || 0,
                },
              }
            : undefined
        }
        onSuccess={() => {
          setEditSheetOpen(false);
          setEditInvoice(null);
          refetch();
        }}
      />
    </div>
  );
}
