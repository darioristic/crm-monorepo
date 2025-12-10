"use client";

import type { Invoice } from "@crm/types";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowUpDown,
  CreditCard,
  Eye,
  MoreHorizontal,
  Package,
  Pencil,
  Trash2,
} from "lucide-react";
import { type InvoiceStatus, InvoiceStatusBadge } from "@/components/sales/status";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency, formatDate } from "@/lib/utils";

export type InvoiceWithCompany = Invoice & {
  companyName?: string;
};

interface InvoicesColumnsOptions {
  onView?: (invoice: InvoiceWithCompany) => void;
  onEdit?: (invoice: InvoiceWithCompany) => void;
  onDelete?: (invoice: InvoiceWithCompany) => void;
  onRecordPayment?: (invoice: InvoiceWithCompany) => void;
  onOpenSheet?: (invoiceId: string) => void;
  onConvertToDeliveryNote?: (invoice: InvoiceWithCompany) => void;
}

export function getInvoicesColumns({
  onDelete,
  onRecordPayment,
  onOpenSheet,
  onConvertToDeliveryNote,
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
        if (!companyName || companyName === "Unknown Company") {
          return <span className="text-muted-foreground">-</span>;
        }
        return <span className="text-muted-foreground">{companyName}</span>;
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                window.open(`/i/id/${row.original.id}`, "_blank", "noopener,noreferrer");
              }}
            >
              <Eye className="mr-2 h-4 w-4" />
              View Invoice
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOpenSheet?.(row.original.id)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Invoice
            </DropdownMenuItem>
            {row.original.status !== "paid" && onRecordPayment && (
              <DropdownMenuItem onClick={() => onRecordPayment(row.original)}>
                <CreditCard className="mr-2 h-4 w-4" />
                Record Payment
              </DropdownMenuItem>
            )}
            {onConvertToDeliveryNote && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onConvertToDeliveryNote(row.original)}>
                  <Package className="mr-2 h-4 w-4" />
                  Convert to Delivery Note
                </DropdownMenuItem>
              </>
            )}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDelete(row.original)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];
}
