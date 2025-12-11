"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { reportsApi } from "@/lib/api";

export type FinanceDashboardData = {
  kpi: {
    totalRevenue: number;
    pendingInvoices: number;
    totalExpenses: number;
    netProfit: number;
    currency: string;
  };
  revenueByCategory: Array<{
    category: string;
    amount: number;
    percentage: number;
    color: string;
  }>;
  transactions: Array<{
    id: string;
    description: string;
    amount: number;
    type: "income" | "expense";
    date: string;
    status: string;
    companyName?: string;
  }>;
  monthlyTrend: Array<{
    month: string;
    revenue: number;
    expenses: number;
  }>;
};

export function useFinanceDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<FinanceDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await reportsApi.getFinanceDashboard({ tenantId: user?.companyId });

      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error?.message || "Failed to fetch finance data");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch finance data");
    } finally {
      setIsLoading(false);
    }
  }, [user?.companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}
