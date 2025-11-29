"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCwIcon } from "lucide-react";

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "in_transit", label: "In Transit" },
  { value: "delivered", label: "Delivered" },
  { value: "returned", label: "Returned" },
];

interface DeliveryToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export function DeliveryToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onRefresh,
  isLoading = false,
}: DeliveryToolbarProps) {
  return (
    <div className="flex items-center gap-4 py-4">
      <Input
        placeholder="Search delivery notes..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="max-w-sm"
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
      <Button
        variant="outline"
        size="icon"
        onClick={onRefresh}
        disabled={isLoading}
      >
        <RefreshCwIcon className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
      </Button>
    </div>
  );
}

