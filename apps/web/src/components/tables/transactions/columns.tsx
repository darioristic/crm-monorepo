"use client";

import type { PaymentWithInvoice } from "@crm/types";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { CreditCard, ExternalLink, Eye, Link2, MoreHorizontal, Trash2 } from "lucide-react";
import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Extended type with enrichment fields
export interface TransactionRow extends PaymentWithInvoice {
  vendorName?: string;
  merchantName?: string;
  categorySlug?: string;
  description?: string;
  tags?: Array<{ id: string; name: string; color?: string }>;
}

// Format currency
function formatCurrency(amount: number, currency: string = "EUR") {
  return new Intl.NumberFormat("sr-RS", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

// Select cell component
const SelectCell = memo(
  ({
    checked,
    onChange,
    onShiftClick,
  }: {
    checked: boolean;
    onChange: (value: boolean) => void;
    onShiftClick?: () => void;
  }) => (
    <div
      onClick={(e) => {
        e.stopPropagation();
        if (e.shiftKey && onShiftClick) {
          e.preventDefault();
          onShiftClick();
        }
      }}
    >
      <Checkbox checked={checked} onCheckedChange={onChange} />
    </div>
  )
);
SelectCell.displayName = "SelectCell";

// Date cell
const DateCell = memo(({ date }: { date: string }) => (
  <span className="text-sm text-muted-foreground whitespace-nowrap">
    {format(new Date(date), "dd.MM.yyyy")}
  </span>
));
DateCell.displayName = "DateCell";

// Description cell
const DescriptionCell = memo(
  ({ name, description, amount }: { name: string; description?: string; amount: number }) => (
    <div className="flex items-center space-x-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("line-clamp-1", amount > 0 && "text-[#00C969]")}>{name}</span>
        </TooltipTrigger>
        {description && (
          <TooltipContent
            className="px-3 py-1.5 text-xs max-w-[380px]"
            side="right"
            sideOffset={10}
          >
            {description}
          </TooltipContent>
        )}
      </Tooltip>
    </div>
  )
);
DescriptionCell.displayName = "DescriptionCell";

// Amount cell
const AmountCell = memo(({ amount, currency }: { amount: number; currency: string }) => (
  <span className={cn("text-sm font-medium", amount > 0 && "text-[#00C969]")}>
    {formatCurrency(amount, currency)}
  </span>
));
AmountCell.displayName = "AmountCell";

// Category cell
const CategoryCell = memo(({ category }: { category?: string }) => {
  if (!category) {
    return <span className="text-muted-foreground text-sm">-</span>;
  }
  return (
    <Badge variant="outline" className="capitalize">
      {category.replace(/-/g, " ")}
    </Badge>
  );
});
CategoryCell.displayName = "CategoryCell";

// Tags cell
const TagsCell = memo(
  ({ tags }: { tags?: Array<{ id: string; name: string; color?: string }> }) => {
    if (!tags || tags.length === 0) {
      return <span className="text-muted-foreground text-sm">-</span>;
    }
    return (
      <div className="flex items-center gap-1 overflow-hidden">
        {tags.slice(0, 2).map((tag) => (
          <Badge
            key={tag.id}
            variant="secondary"
            className="text-xs whitespace-nowrap"
            style={{
              backgroundColor: tag.color ? `${tag.color}20` : undefined,
            }}
          >
            {tag.name}
          </Badge>
        ))}
        {tags.length > 2 && (
          <span className="text-xs text-muted-foreground">+{tags.length - 2}</span>
        )}
      </div>
    );
  }
);
TagsCell.displayName = "TagsCell";

// Method cell
const MethodCell = memo(({ method }: { method: string }) => (
  <div className="flex items-center gap-2">
    <CreditCard className="h-4 w-4 text-muted-foreground" />
    <span className="text-sm capitalize">{method.replace(/_/g, " ")}</span>
  </div>
));
MethodCell.displayName = "MethodCell";

// Status cell
const StatusCell = memo(({ status }: { status: string }) => {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    completed: "default",
    pending: "secondary",
    failed: "destructive",
    refunded: "outline",
    cancelled: "destructive",
  };
  return (
    <Badge variant={variants[status] || "secondary"} className="capitalize">
      {status}
    </Badge>
  );
});
StatusCell.displayName = "StatusCell";

// Actions cell
const ActionsCell = memo(
  ({
    transaction,
    onViewDetails,
    onCopyUrl,
    onDelete,
    onViewInvoice,
  }: {
    transaction: TransactionRow;
    onViewDetails?: (id: string) => void;
    onCopyUrl?: (id: string) => void;
    onDelete?: (id: string) => void;
    onViewInvoice?: (id: string) => void;
  }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onViewDetails?.(transaction.id)}>
          <Eye className="mr-2 h-4 w-4" />
          View details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onCopyUrl?.(transaction.id)}>
          <Link2 className="mr-2 h-4 w-4" />
          Copy URL
        </DropdownMenuItem>
        {transaction.invoiceId && (
          <DropdownMenuItem onClick={() => onViewInvoice?.(transaction.invoiceId)}>
            <ExternalLink className="mr-2 h-4 w-4" />
            View Invoice
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive" onClick={() => onDelete?.(transaction.id)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
);
ActionsCell.displayName = "ActionsCell";

export const columns: ColumnDef<TransactionRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row, table }) => {
      const meta = table.options.meta as {
        lastClickedIndex?: number;
        setLastClickedIndex?: (index: number) => void;
        handleShiftClickRange?: (start: number, end: number) => void;
      };
      const rows = table.getRowModel().rows;
      const rowIndex = rows.findIndex((r) => r.id === row.id);

      const handleShiftClick = () => {
        if (meta?.lastClickedIndex !== undefined && meta?.handleShiftClickRange) {
          meta.handleShiftClickRange(meta.lastClickedIndex, rowIndex);
        }
        meta?.setLastClickedIndex?.(rowIndex);
      };

      return (
        <SelectCell
          checked={row.getIsSelected()}
          onChange={(value) => {
            row.toggleSelected(!!value);
            meta?.setLastClickedIndex?.(rowIndex);
          }}
          onShiftClick={handleShiftClick}
        />
      );
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "paymentDate",
    header: "Date",
    cell: ({ row }) => <DateCell date={row.original.paymentDate} />,
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => (
      <DescriptionCell
        name={
          row.original.vendorName || row.original.notes || row.original.reference || "Transaction"
        }
        description={row.original.notes || undefined}
        amount={row.original.amount}
      />
    ),
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => <AmountCell amount={row.original.amount} currency={row.original.currency} />,
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => <CategoryCell category={row.original.categorySlug} />,
  },
  {
    accessorKey: "tags",
    header: "Tags",
    cell: ({ row }) => <TagsCell tags={row.original.tags} />,
  },
  {
    accessorKey: "paymentMethod",
    header: "Method",
    cell: ({ row }) => <MethodCell method={row.original.paymentMethod} />,
  },
  {
    accessorKey: "invoice",
    header: "Invoice",
    cell: ({ row }) => {
      if (!row.original.invoice) {
        return <span className="text-muted-foreground">-</span>;
      }
      return <span className="text-sm font-mono">{row.original.invoice.invoiceNumber}</span>;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusCell status={row.original.status} />,
  },
  {
    id: "actions",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row, table }) => {
      const meta = table.options.meta as {
        onViewDetails?: (id: string) => void;
        onCopyUrl?: (id: string) => void;
        onDelete?: (id: string) => void;
        onViewInvoice?: (id: string) => void;
      };

      return (
        <ActionsCell
          transaction={row.original}
          onViewDetails={meta?.onViewDetails}
          onCopyUrl={meta?.onCopyUrl}
          onDelete={meta?.onDelete}
          onViewInvoice={meta?.onViewInvoice}
        />
      );
    },
  },
];
