"use client";

import type { Order } from "@crm/types";
import { formatCurrency, formatDateDMY } from "@crm/utils";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { type OrderStatus, OrderStatusBadge } from "@/components/sales/status";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type OrderWithCompany = Order & {
  companyName?: string;
};

interface OrderColumnsOptions {
  onView?: (order: OrderWithCompany) => void;
  onEdit?: (order: OrderWithCompany) => void;
  onDelete?: (order: OrderWithCompany) => void;
}

export function getOrderColumns({
  onView,
  onEdit,
  onDelete,
}: OrderColumnsOptions = {}): ColumnDef<OrderWithCompany>[] {
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
      accessorKey: "orderNumber",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Order #
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(`/o/id/${row.original.id}`, "_blank", "noopener,noreferrer");
          }}
          className="font-medium text-primary hover:underline text-left cursor-pointer"
        >
          {row.original.orderNumber}
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
        <OrderStatusBadge status={row.original.status as OrderStatus} showTooltip={false} />
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
                  window.open(`/o/id/${row.original.id}`, "_blank", "noopener,noreferrer");
                }
              }}
            >
              <Eye className="mr-2 h-4 w-4" />
              View Order
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit?.(row.original)} asChild={!onEdit}>
              {onEdit ? (
                <>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Order
                </>
              ) : (
                <Link href={`/dashboard/sales/orders/${row.original.id}`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Order
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
