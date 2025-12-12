"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { type InvoiceStatus, InvoiceStatusBadge } from "@/components/sales/status";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency, formatDate } from "@/lib/utils";
import { InvoiceActionsMenu, type InvoiceWithCompany } from "./InvoiceActionsMenu";

export type { InvoiceWithCompany };

interface InvoicesColumnsOptions {
  onDelete?: (invoice: InvoiceWithCompany) => void;
  onOpenSheet?: (invoiceId: string) => void;
  onOpenCompanyDetails?: (companyId: string) => void;
  onRefresh?: () => void;
}

export function getInvoicesColumns({
  onDelete,
  onOpenSheet,
  onOpenCompanyDetails,
  onRefresh,
}: InvoicesColumnsOptions = {}): ColumnDef<InvoiceWithCompany>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "invoiceNumber",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Invoice #
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(`/i/id/${row.original.id}`, "_blank", "noopener,noreferrer");
          }}
          className="font-medium text-primary hover:underline text-left cursor-pointer"
        >
          {row.original.invoiceNumber}
        </button>
      ),
    },
    {
      accessorKey: "companyName",
      header: "Company",
      cell: ({ row }) => {
        const companyName = row.original.companyName;
        const companyId = row.original.companyId;
        if (!companyName || companyName === "Unknown Company") {
          return <span className="text-muted-foreground">-</span>;
        }
        if (onOpenCompanyDetails && companyId) {
          return (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOpenCompanyDetails(companyId);
              }}
              className="text-left hover:underline cursor-pointer"
            >
              {companyName}
            </button>
          );
        }
        return <span>{companyName}</span>;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <InvoiceStatusBadge status={row.original.status as InvoiceStatus} showTooltip={false} />
      ),
    },
    {
      accessorKey: "total",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Total
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-medium">{formatCurrency(row.original.total)}</span>,
    },
    {
      accessorKey: "paidAmount",
      header: "Paid",
      cell: ({ row }) => {
        const balance = row.original.total - row.original.paidAmount;
        return (
          <div className="flex flex-col">
            <span>{formatCurrency(row.original.paidAmount)}</span>
            {balance > 0 && (
              <span className="text-xs text-muted-foreground">
                Balance: {formatCurrency(balance)}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "dueDate",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Due Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const dueDate = new Date(row.original.dueDate);
        const isOverdue = dueDate < new Date() && row.original.status !== "paid";
        return (
          <span className={isOverdue ? "text-destructive font-medium" : ""}>
            {formatDate(row.original.dueDate)}
          </span>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Created
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <InvoiceActionsMenu
          invoice={row.original}
          onRefresh={onRefresh}
          onDelete={onDelete}
          onOpenSheet={onOpenSheet}
        />
      ),
    },
  ];
}
