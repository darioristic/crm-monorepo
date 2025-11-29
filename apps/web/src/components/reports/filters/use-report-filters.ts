"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { subDays, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";

export type DatePreset = "today" | "last7Days" | "last30Days" | "thisMonth" | "lastMonth" | "last90Days" | "thisYear" | "custom";

export interface ReportFilterState {
  from: string;
  to: string;
  companyId?: string;
  projectId?: string;
  status?: string;
  preset: DatePreset;
}

export function useReportFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo((): ReportFilterState => {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const preset = (searchParams.get("preset") as DatePreset) || "last30Days";
    
    // If no dates, use preset defaults
    const dateRange = getDateRangeFromPreset(preset);
    
    return {
      from: from || dateRange.from,
      to: to || dateRange.to,
      companyId: searchParams.get("companyId") || undefined,
      projectId: searchParams.get("projectId") || undefined,
      status: searchParams.get("status") || undefined,
      preset,
    };
  }, [searchParams]);

  const setFilters = useCallback(
    (newFilters: Partial<ReportFilterState>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(newFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          params.set(key, String(value));
        } else {
          params.delete(key);
        }
      });

      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const setDatePreset = useCallback(
    (preset: DatePreset) => {
      const dateRange = getDateRangeFromPreset(preset);
      setFilters({
        preset,
        from: dateRange.from,
        to: dateRange.to,
      });
    },
    [setFilters]
  );

  const setCustomDateRange = useCallback(
    (from: Date, to: Date) => {
      setFilters({
        preset: "custom",
        from: from.toISOString(),
        to: to.toISOString(),
      });
    },
    [setFilters]
  );

  const resetFilters = useCallback(() => {
    router.push(pathname, { scroll: false });
  }, [router, pathname]);

  const clearFilter = useCallback(
    (key: keyof ReportFilterState) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete(key);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  return {
    filters,
    setFilters,
    setDatePreset,
    setCustomDateRange,
    resetFilters,
    clearFilter,
  };
}

function getDateRangeFromPreset(preset: DatePreset): { from: string; to: string } {
  const today = new Date();
  const endOfToday = new Date(today.setHours(23, 59, 59, 999));

  switch (preset) {
    case "today":
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      return {
        from: startOfToday.toISOString(),
        to: endOfToday.toISOString(),
      };
    case "last7Days":
      return {
        from: subDays(today, 6).toISOString(),
        to: endOfToday.toISOString(),
      };
    case "last30Days":
      return {
        from: subDays(today, 29).toISOString(),
        to: endOfToday.toISOString(),
      };
    case "thisMonth":
      return {
        from: startOfMonth(today).toISOString(),
        to: endOfToday.toISOString(),
      };
    case "lastMonth":
      const lastMonth = subMonths(today, 1);
      return {
        from: startOfMonth(lastMonth).toISOString(),
        to: endOfMonth(lastMonth).toISOString(),
      };
    case "last90Days":
      return {
        from: subDays(today, 89).toISOString(),
        to: endOfToday.toISOString(),
      };
    case "thisYear":
      return {
        from: startOfYear(today).toISOString(),
        to: endOfToday.toISOString(),
      };
    default:
      return {
        from: subDays(today, 29).toISOString(),
        to: endOfToday.toISOString(),
      };
  }
}

