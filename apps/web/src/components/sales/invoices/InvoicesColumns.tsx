"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, Pencil, Trash2, Eye, CreditCard } from "lucide-react";
import type { Invoice } from "@crm/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency, formatDate } from "@/lib/utils";
import { InvoiceStatusBadge, type InvoiceStatus } from "@/components/sales/status";

export type InvoiceWithCompany = Invoice & {
  companyName?: string;
};

interface InvoicesColumnsOptions {
  onView?: (invoice: InvoiceWithCompany) => void;
  onEdit?: (invoice: InvoiceWithCompany) => void;
  onDelete?: (invoice: InvoiceWithCompany) => void;
  onRecordPayment?: (invoice: InvoiceWithCompany) => void;
}

export function getInvoicesColumns({
  onView,
  onEdit,
  onDelete,
  onRecordPayment,
}: InvoicesColumnsOptions = {}): ColumnDef<InvoiceWithCompany>[] {
  return [
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
        <Link
          href={`/dashboard/sales/invoices/${row.original.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.invoiceNumber}
        </Link>
      ),
    },
    {
      accessorKey: "companyName",
      header: "Company",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.companyName}</span>
      ),
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
      cell: ({ row }) => (
        <span className="font-medium">{formatCurrency(row.original.total)}</span>
      ),
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
      header: "Due Date",
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
      header: "Created",
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
              onClick={() => onView?.(row.original)}
              asChild={!onView}
            >
              {onView ? (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </>
              ) : (
                <Link href={`/dashboard/sales/invoices/${row.original.id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </Link>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onEdit?.(row.original)}
              asChild={!onEdit}
            >
              {onEdit ? (
                <>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Invoice
                </>
              ) : (
                <Link href={`/dashboard/sales/invoices/${row.original.id}`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Invoice
                </Link>
              )}
            </DropdownMenuItem>
            {row.original.status !== "paid" && onRecordPayment && (
              <DropdownMenuItem onClick={() => onRecordPayment(row.original)}>
                <CreditCard className="mr-2 h-4 w-4" />
                Record Payment
              </DropdownMenuItem>
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

