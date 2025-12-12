"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, CreditCard, Filter, Search, Tag as TagIcon, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { type Tag, tagsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "credit_card", label: "Credit Card" },
  { value: "debit_card", label: "Debit Card" },
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "paypal", label: "PayPal" },
  { value: "stripe", label: "Stripe" },
  { value: "other", label: "Other" },
];

const STATUSES = [
  { value: "completed", label: "Completed" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
  { value: "cancelled", label: "Cancelled" },
];

interface FilterState {
  search: string;
  status: string | null;
  method: string | null;
  tagId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}

interface SearchFilterProps {
  onFilterChange: (filters: FilterState) => void;
}

export function SearchFilter({ onFilterChange }: SearchFilterProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [method, setMethod] = useState<string | null>(null);
  const [tagId, setTagId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isOpen, setIsOpen] = useState(false);

  // Fetch tags
  const { data: tags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const res = await tagsApi.getAll();
      return res.data || [];
    },
  });

  // Active filters for display
  const activeFilters: Array<{ key: string; label: string; value: string }> = [];

  if (status) {
    const statusLabel = STATUSES.find((s) => s.value === status)?.label;
    activeFilters.push({ key: "status", label: "Status", value: statusLabel || status });
  }
  if (method) {
    const methodLabel = PAYMENT_METHODS.find((m) => m.value === method)?.label;
    activeFilters.push({ key: "method", label: "Method", value: methodLabel || method });
  }
  if (tagId) {
    const tagName = tags.find((t: Tag) => t.id === tagId)?.name;
    activeFilters.push({ key: "tag", label: "Tag", value: tagName || "Tag" });
  }
  if (dateRange?.from) {
    const dateLabel = dateRange.to
      ? `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d")}`
      : format(dateRange.from, "MMM d, yyyy");
    activeFilters.push({ key: "date", label: "Date", value: dateLabel });
  }

  // Emit filter changes
  useEffect(() => {
    const debounce = setTimeout(() => {
      onFilterChange({
        search,
        status,
        method,
        tagId,
        dateFrom: dateRange?.from?.toISOString() || null,
        dateTo: dateRange?.to?.toISOString() || null,
      });
    }, 300);

    return () => clearTimeout(debounce);
  }, [search, status, method, tagId, dateRange, onFilterChange]);

  const clearFilter = (key: string) => {
    switch (key) {
      case "status":
        setStatus(null);
        break;
      case "method":
        setMethod(null);
        break;
      case "tag":
        setTagId(null);
        break;
      case "date":
        setDateRange(undefined);
        break;
    }
  };

  const clearAllFilters = () => {
    setSearch("");
    setStatus(null);
    setMethod(null);
    setTagId(null);
    setDateRange(undefined);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-full sm:w-[350px]"
          />
        </div>

        {/* Filter Dropdown */}
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className={cn("gap-2", activeFilters.length > 0 && "border-primary")}
            >
              <Filter className="h-4 w-4" />
              Filters
              {activeFilters.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {activeFilters.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[250px]" align="end">
            {/* Date Range */}
            <DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  Date Range
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="p-0" sideOffset={8}>
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={1}
                    />
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            {/* Status */}
            <DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Filter className="mr-2 h-4 w-4" />
                  Status
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent sideOffset={8}>
                    {STATUSES.map((s) => (
                      <DropdownMenuCheckboxItem
                        key={s.value}
                        checked={status === s.value}
                        onCheckedChange={(checked) => setStatus(checked ? s.value : null)}
                      >
                        {s.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            </DropdownMenuGroup>

            {/* Payment Method */}
            <DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Payment Method
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent sideOffset={8}>
                    {PAYMENT_METHODS.map((m) => (
                      <DropdownMenuCheckboxItem
                        key={m.value}
                        checked={method === m.value}
                        onCheckedChange={(checked) => setMethod(checked ? m.value : null)}
                      >
                        {m.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            </DropdownMenuGroup>

            {/* Tags */}
            {tags.length > 0 && (
              <DropdownMenuGroup>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <TagIcon className="mr-2 h-4 w-4" />
                    Tags
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent
                      sideOffset={8}
                      className="max-h-[300px] overflow-y-auto"
                    >
                      {tags.map((tag: Tag) => (
                        <DropdownMenuCheckboxItem
                          key={tag.id}
                          checked={tagId === tag.id}
                          onCheckedChange={(checked) => setTagId(checked ? tag.id : null)}
                        >
                          <span
                            className="w-2 h-2 rounded-full mr-2"
                            style={{ backgroundColor: tag.color || "#6366F1" }}
                          />
                          {tag.name}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              </DropdownMenuGroup>
            )}

            {activeFilters.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-sm h-8"
                    onClick={clearAllFilters}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Clear all filters
                  </Button>
                </DropdownMenuGroup>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Active Filters */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeFilters.map((filter) => (
            <Badge key={filter.key} variant="secondary" className="gap-1 pr-1">
              <span className="text-muted-foreground">{filter.label}:</span>
              {filter.value}
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 ml-1 hover:bg-transparent"
                onClick={() => clearFilter(filter.key)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
