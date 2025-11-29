"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, Pencil, Trash2, Eye } from "lucide-react";
import type { Quote } from "@crm/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency, formatDate } from "@/lib/utils";
import { QuoteStatusBadge, type QuoteStatus } from "@/components/sales/status";

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
        <Link
          href={`/dashboard/sales/quotes/${row.original.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.quoteNumber}
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
        <span className="font-medium">{formatCurrency(row.original.total)}</span>
      ),
    },
    {
      accessorKey: "validUntil",
      header: "Valid Until",
      cell: ({ row }) => formatDate(row.original.validUntil),
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
                <Link href={`/dashboard/sales/quotes/${row.original.id}`}>
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

