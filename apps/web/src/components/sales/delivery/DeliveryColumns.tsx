"use client";

import type { DeliveryNote } from "@crm/types";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowUpDown,
  Download,
  Eye,
  Link2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { type DeliveryStatus, DeliveryStatusBadge } from "@/components/sales/status";
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
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(`/d/id/${row.original.id}`, "_blank", "noopener,noreferrer");
          }}
          className="font-medium text-primary hover:underline text-left cursor-pointer"
        >
          {row.original.deliveryNumber}
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
        <span className="text-muted-foreground">{row.original.trackingNumber || "-"}</span>
      ),
    },
    {
      accessorKey: "deliveryDate",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Delivery Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (row.original.deliveryDate ? formatDate(row.original.deliveryDate) : "-"),
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
        <span className="font-medium">{formatCurrency(row.original.total || 0)}</span>
      ),
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
      cell: ({ row }) => {
        const handleCopyLink = async () => {
          const url = `${window.location.origin}/dashboard/sales/delivery-notes/${row.original.id}`;
          try {
            await navigator.clipboard.writeText(url);
            toast.success("Link copied to clipboard");
          } catch {
            toast.error("Failed to copy link");
          }
        };

        const handleDownload = () => {
          window.open(`/api/download/delivery-note?id=${row.original.id}`, "_blank");
        };

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  if (onView) {
                    onView(row.original);
                  } else {
                    window.open(`/d/id/${row.original.id}`, "_blank", "noopener,noreferrer");
                  }
                }}
              >
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (onEdit) {
                    onEdit(row.original);
                  } else {
                    window.open(
                      `/dashboard/sales/delivery-notes?type=edit&deliveryNoteId=${row.original.id}`,
                      "_blank",
                      "noopener,noreferrer"
                    );
                  }
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit Delivery Note
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyLink}>
                <Link2 className="mr-2 h-4 w-4" />
                Copy Link
              </DropdownMenuItem>
              {row.original.status !== "delivered" && onMarkDelivered && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onMarkDelivered(row.original)}>
                    <Truck className="mr-2 h-4 w-4" />
                    Mark as Delivered
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
        );
      },
    },
  ];
}
