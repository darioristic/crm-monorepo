"use client";

import { PlusCircledIcon } from "@radix-ui/react-icons";
import { ArrowRightCircle, ChevronDown, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
];

interface QuotesToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onRefresh: () => void;
  isLoading?: boolean;
  selectedCount?: number;
  onConvertToOrder?: () => void;
  onConvertToInvoice?: () => void;
  onNewQuote?: () => void;
}

export function QuotesToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onRefresh,
  isLoading = false,
  selectedCount = 0,
  onConvertToOrder,
  onConvertToInvoice,
  onNewQuote,
}: QuotesToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search quotes..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="md:max-w-sm"
        />
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
      </div>

      <div className="flex items-center gap-2">
        {selectedCount > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" size="sm">
                <ArrowRightCircle className="mr-2 h-4 w-4" />
                Convert ({selectedCount})
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onConvertToOrder}>Convert to Order</DropdownMenuItem>
              <DropdownMenuItem onClick={onConvertToInvoice}>Convert to Invoice</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button onClick={onNewQuote} size="sm">
          <PlusCircledIcon className="mr-2 h-4 w-4" />
          New Quote
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
