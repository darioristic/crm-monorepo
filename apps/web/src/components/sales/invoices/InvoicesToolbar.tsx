"use client";

import { PlusCircledIcon } from "@radix-ui/react-icons";
import { RefreshCwIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partial" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
];

interface InvoicesToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onRefresh: () => void;
  isLoading?: boolean;
  onNewInvoice?: () => void;
  externalFilterLabel?: string;
  onClearExternalFilter?: () => void;
}

export function InvoicesToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onRefresh,
  isLoading = false,
  onNewInvoice,
  externalFilterLabel,
  onClearExternalFilter,
}: InvoicesToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search invoices..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="md:max-w-sm"
        />
        {externalFilterLabel ? (
          <Badge variant="secondary" className="gap-1 px-3 py-1.5">
            {externalFilterLabel}
            <button
              type="button"
              onClick={onClearExternalFilter}
              className="ml-1 rounded-full hover:bg-muted-foreground/20"
            >
              <XIcon className="h-3 w-3" />
            </button>
          </Badge>
        ) : (
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={onNewInvoice} size="sm">
          <PlusCircledIcon className="mr-2 h-4 w-4" />
          New Invoice
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={onRefresh}
          disabled={isLoading}
          aria-label="Refresh"
        >
          <RefreshCwIcon className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>
    </div>
  );
}
