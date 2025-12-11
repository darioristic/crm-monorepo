"use client";

import type { Deal, DealStage } from "@crm/types";
import { RefreshCwIcon, TrendingUpIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { DealFormSheet } from "@/components/crm/deal-form-sheet";
import { DealsKanban } from "@/components/crm/deals-kanban";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { dealsApi } from "@/lib/api";

type PipelineSummary = {
  stages: { stage: DealStage; count: number; totalValue: number }[];
  totalDeals: number;
  totalValue: number;
  avgDealValue: number;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [summary, setSummary] = useState<PipelineSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [dealsResponse, summaryResponse] = await Promise.all([
        dealsApi.getAll({ pageSize: 100 }),
        dealsApi.getPipelineSummary(),
      ]);

      if (dealsResponse.success && dealsResponse.data) {
        setDeals(dealsResponse.data);
      } else {
        setError(dealsResponse.error?.message || "Failed to load deals");
      }

      if (summaryResponse.success && summaryResponse.data) {
        setSummary(summaryResponse.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
          <Button variant="outline" size="icon" onClick={fetchData} aria-label="Refresh">
            <RefreshCwIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Pipeline Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(summary?.totalValue || 0)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Deals</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{summary?.totalDeals || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Deal Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(summary?.avgDealValue || 0)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Won Deals Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(
                    summary?.stages.find((s) => s.stage === "closed_won")?.totalValue || 0
                  )}
                </div>
                <TrendingUpIcon className="h-5 w-5 text-green-600" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Kanban Board */}
      <DealsKanban
        deals={deals}
        isLoading={isLoading}
        error={error || undefined}
        onRefresh={fetchData}
      />

      <DealFormSheet open={showCreateForm} onOpenChange={setShowCreateForm} onSaved={fetchData} />
    </div>
  );
}
