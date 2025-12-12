"use client";

import { useQuery } from "@tanstack/react-query";
import { Clock, DollarSign, RotateCcw, TrendingUp } from "lucide-react";
import { useCallback, useState } from "react";
import { TransactionSheet } from "@/components/sheets/transaction-sheet";
import { DataTable } from "@/components/tables/transactions/data-table";
import { SearchFilter } from "@/components/tables/transactions/search-filter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { paymentsApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

interface FilterState {
  search: string;
  status: string | null;
  method: string | null;
  tagId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}

export default function PaymentsPage() {
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    status: null,
    method: null,
    tagId: null,
    dateFrom: null,
    dateTo: null,
  });

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["payment-stats"],
    queryFn: async () => {
      const res = await paymentsApi.getStats();
      return res.data;
    },
  });

  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground">View and manage all payment transactions</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Received</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(stats?.totalPaid || 0)}</div>
                <p className="text-xs text-muted-foreground">Completed payments</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold text-yellow-600">
                  {formatCurrency(stats?.totalPending || 0)}
                </div>
                <p className="text-xs text-muted-foreground">Awaiting confirmation</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Refunded</CardTitle>
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(stats?.totalRefunded || 0)}
                </div>
                <p className="text-xs text-muted-foreground">Total refunds</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.paymentCount || 0}</div>
                <p className="text-xs text-muted-foreground">Total payments</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <SearchFilter onFilterChange={handleFilterChange} />

      {/* Data Table */}
      <DataTable
        filters={{
          search: filters.search || undefined,
          status: filters.status || undefined,
          method: filters.method || undefined,
          tagId: filters.tagId || undefined,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
        }}
      />

      {/* Transaction Sheet */}
      <TransactionSheet />
    </div>
  );
}
