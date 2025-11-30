"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, Pencil, Trash2, Eye, Truck } from "lucide-react";
import type { DeliveryNote } from "@crm/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/utils";
import { DeliveryStatusBadge, type DeliveryStatus } from "@/components/sales/status";

export type DeliveryNoteWithCompany = DeliveryNote & {
  companyName?: string;
};

interface DeliveryColumnsOptions {
  onView?: (note: DeliveryNoteWithCompany) => void;
  onEdit?: (note: DeliveryNoteWithCompany) => void;
  onDelete?: (note: DeliveryNoteWithCompany) => void;
  onMarkDelivered?: (note: DeliveryNoteWithCompany) => void;
}

export function getDeliveryColumns({
  onView,
  onEdit,
  onDelete,
  onMarkDelivered,
}: DeliveryColumnsOptions = {}): ColumnDef<DeliveryNoteWithCompany>[] {
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
      accessorKey: "deliveryNumber",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Delivery #
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <Link
          href={`/dashboard/sales/delivery-notes/${row.original.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.deliveryNumber}
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
        <DeliveryStatusBadge status={row.original.status as DeliveryStatus} showTooltip={false} />
      ),
    },
    {
      accessorKey: "shippingAddress",
      header: "Address",
      cell: ({ row }) => (
        <span className="text-muted-foreground max-w-[200px] truncate block">
          {row.original.shippingAddress}
        </span>
      ),
    },
    {
      accessorKey: "trackingNumber",
      header: "Tracking",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.trackingNumber || "-"}
        </span>
      ),
    },
    {
      accessorKey: "deliveryDate",
      header: "Delivery Date",
      cell: ({ row }) =>
        row.original.deliveryDate ? formatDate(row.original.deliveryDate) : "-",
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
                <Link href={`/dashboard/sales/delivery-notes/${row.original.id}`}>
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
                  Edit Delivery Note
                </>
              ) : (
                <Link href={`/dashboard/sales/delivery-notes/${row.original.id}`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Delivery Note
                </Link>
              )}
            </DropdownMenuItem>
            {row.original.status !== "delivered" && onMarkDelivered && (
              <DropdownMenuItem onClick={() => onMarkDelivered(row.original)}>
                <Truck className="mr-2 h-4 w-4" />
                Mark as Delivered
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

