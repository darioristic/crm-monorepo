"use client";

import { RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateRangeFilter } from "./date-range-filter";
import { CompanyFilter } from "./company-filter";
import { ProjectFilter } from "./project-filter";
import { StatusFilter } from "./status-filter";
import { useReportFilters, type DatePreset } from "./use-report-filters";

interface ReportFiltersProps {
  showCompanyFilter?: boolean;
  showProjectFilter?: boolean;
  showStatusFilter?: boolean;
  statusOptions?: { value: string; label: string }[];
  statusPlaceholder?: string;
  className?: string;
}

export function ReportFilters({
  showCompanyFilter = false,
  showProjectFilter = false,
  showStatusFilter = false,
  statusOptions = [],
  statusPlaceholder = "All Statuses",
  className,
}: ReportFiltersProps) {
  const {
    filters,
    setFilters,
    setDatePreset,
    setCustomDateRange,
    resetFilters,
  } = useReportFilters();

  const hasActiveFilters =
    filters.companyId ||
    filters.projectId ||
    filters.status ||
    filters.preset !== "last30Days";

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-3">
        <DateRangeFilter
          from={filters.from}
          to={filters.to}
          preset={filters.preset}
          onPresetChange={setDatePreset}
          onCustomRangeChange={setCustomDateRange}
        />

        {showCompanyFilter && (
          <CompanyFilter
            value={filters.companyId}
            onChange={(companyId) => setFilters({ companyId })}
          />
        )}

        {showProjectFilter && (
          <ProjectFilter
            value={filters.projectId}
            onChange={(projectId) => setFilters({ projectId })}
          />
        )}

        {showStatusFilter && statusOptions.length > 0 && (
          <StatusFilter
            value={filters.status}
            onChange={(status) => setFilters({ status })}
            options={statusOptions}
            placeholder={statusPlaceholder}
          />
        )}

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="text-muted-foreground"
          >
            <RotateCcwIcon className="mr-2 h-4 w-4" />
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}

