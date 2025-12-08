"use client";

import type { Quote } from "@crm/types";
import { formatCurrency, formatDateDMY } from "@crm/utils";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { type QuoteStatus, QuoteStatusBadge } from "@/components/sales/status";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type QuoteWithCompany = Quote & {
  companyName?: string;
};

interface QuotesColumnsOptions {
  onView?: (quote: QuoteWithCompany) => void;
  onEdit?: (quote: QuoteWithCompany) => void;
  onDelete?: (quote: QuoteWithCompany) => void;
}

export function getQuotesColumns({
  onView,
  onEdit,
  onDelete,
}: QuotesColumnsOptions = {}): ColumnDef<QuoteWithCompany>[] {
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
      accessorKey: "quoteNumber",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Quote #
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(`/q/id/${row.original.id}`, "_blank", "noopener,noreferrer");
          }}
          className="font-medium text-primary hover:underline text-left cursor-pointer"
        >
          {row.original.quoteNumber}
        </button>
      ),
    },
    {
      accessorKey: "companyName",
      header: "Company",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.companyName}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <QuoteStatusBadge status={row.original.status as QuoteStatus} showTooltip={false} />
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
        <span className="font-medium">
          {formatCurrency(row.original.total, row.original.currency || "EUR", "sr-RS")}
        </span>
      ),
    },
    {
      accessorKey: "validUntil",
      header: "Valid Until",
      cell: ({ row }) => formatDateDMY(row.original.validUntil),
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => formatDateDMY(row.original.createdAt),
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
                if (onView) {
                  onView(row.original);
                } else {
                  window.open(`/q/id/${row.original.id}`, "_blank", "noopener,noreferrer");
                }
              }}
            >
              <Eye className="mr-2 h-4 w-4" />
              View Quote
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit?.(row.original)} asChild={!onEdit}>
              {onEdit ? (
                <>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Quote
                </>
              ) : (
                <Link href={`/dashboard/sales/quotes/${row.original.id}`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Quote
                </Link>
              )}
            </DropdownMenuItem>
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
