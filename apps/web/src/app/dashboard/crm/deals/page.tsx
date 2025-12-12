"use client";

import type { Deal } from "@crm/types";
import { RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { DealFormSheet } from "@/components/crm/deal-form-sheet";
import { DealsKanban } from "@/components/crm/deals-kanban";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePaginatedApi } from "@/hooks/use-api";
import { dealsApi } from "@/lib/api";

export default function DealsPage() {
  const [showCreateForm, setShowCreateForm] = useState(false);

  const {
    data: deals = [],
    error,
    isLoading,
    refetch,
    page,
    pageSize,
    totalPages,
    setPage,
    setPageSize,
  } = usePaginatedApi<Deal>(dealsApi.getAll);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Deals Pipeline</h1>
          <p className="text-muted-foreground">
            Manage your deals and track them through the sales pipeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowCreateForm(true)}>New Deal</Button>
          <Button variant="outline" size="icon" onClick={refetch} aria-label="Refresh">
            <RefreshCwIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          Page {page} of {Math.max(totalPages, 1)}
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(parseInt(v, 10))}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Page size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => setPage(Math.max(page - 1, 1))}
            disabled={page <= 1 || isLoading}
          >
            Previous
          </Button>
          <Button onClick={() => setPage(page + 1)} disabled={page >= totalPages || isLoading}>
            Next
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <DealsKanban
        deals={deals}
        isLoading={isLoading}
        error={error || undefined}
        onRefresh={refetch}
      />

      <DealFormSheet open={showCreateForm} onOpenChange={setShowCreateForm} onSaved={refetch} />
    </div>
  );
}
