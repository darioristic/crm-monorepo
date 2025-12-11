"use client";

import type { Lead } from "@crm/types";
import { RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { LeadFormSheet } from "@/components/crm/lead-form-sheet";
import { LeadsDataTable } from "@/components/crm/leads-data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePaginatedApi } from "@/hooks/use-api";
import { leadsApi } from "@/lib/api";

export default function LeadsPage() {
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const {
    data: leads,
    isLoading,
    error,
    page,
    totalPages,
    setPage,
    setFilters,
    refetch,
  } = usePaginatedApi<Lead>((params) => leadsApi.getAll(params), {
    search: "",
  });

  const handleSearch = (value: string) => {
    setSearchValue(value);
    const timer = setTimeout(() => {
      setFilters({
        search: value || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
    }, 300);
    return () => clearTimeout(timer);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setFilters({
      search: searchValue || undefined,
      status: value !== "all" ? value : undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground">
            Manage and track potential customers through your sales pipeline
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <Input
            placeholder="Search leads..."
            value={searchValue}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-64"
          />
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="qualified">Qualified</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setOpen(true)}>Add Lead</Button>
          <Button variant="outline" size="icon" onClick={() => refetch()} aria-label="Refresh">
            <RefreshCwIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <LeadsDataTable
        data={leads || []}
        isLoading={isLoading}
        error={error}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onRefresh={refetch}
        onSortChange={(key, order) => {
          setFilters({
            search: searchValue || undefined,
            status: statusFilter !== "all" ? statusFilter : undefined,
            sortBy: key,
            sortOrder: order,
          });
        }}
      />

      <LeadFormSheet open={open} onOpenChange={setOpen} onSaved={refetch} />
    </div>
  );
}
