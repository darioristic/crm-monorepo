"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUpIcon,
  FileTextIcon,
  ReceiptIcon,
  RefreshCwIcon,
  PercentIcon
} from "lucide-react";
import { analyticsApi, reportsApi } from "@/lib/api";
import { ReportFilters, ExportButton, invoiceStatusOptions, useReportFilters } from "@/components/reports/filters";
import {
  RevenueOverTimeChart,
  RevenueByCompanyChart,
  TopCustomersTable,
  InvoiceStatusChart,
  ConversionFunnelChart,
  ChartSkeleton,
  ChartError,
  EmptyChartState
} from "@/components/reports/charts";
import type {
  SalesSummary,
  RevenuePoint,
  CompanyRevenue,
  TopCustomer,
  ConversionFunnel,
  InvoiceStatusBreakdown
} from "@crm/types";
import type { ColumnDef } from "@/lib/export";
import { format } from "date-fns";

export function SalesReportsContent() {
  const { filters } = useReportFilters();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [revenueData, setRevenueData] = useState<RevenuePoint[]>([]);
  const [companyRevenue, setCompanyRevenue] = useState<CompanyRevenue[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [conversionFunnel, setConversionFunnel] = useState<ConversionFunnel | null>(null);
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatusBreakdown[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    const params = {
      from: filters.from,
      to: filters.to,
      companyId: filters.companyId,
    };

    try {
      const [
        summaryRes,
        revenueRes,
        companyRes,
        customersRes,
        funnelRes,
        statusRes
      ] = await Promise.all([
        reportsApi.getSalesSummary(),
        analyticsApi.getRevenueOverTime(params),
        analyticsApi.getRevenueByCompany({ ...params, limit: 10 }),
        analyticsApi.getTopCustomers({ ...params, limit: 10 }),
        analyticsApi.getConversionFunnel(params),
        analyticsApi.getInvoiceStatusBreakdown(params)
      ]);

      if (summaryRes.success && summaryRes.data) setSummary(summaryRes.data);
      if (revenueRes.success && revenueRes.data) setRevenueData(revenueRes.data);
      if (companyRes.success && companyRes.data) setCompanyRevenue(companyRes.data);
      if (customersRes.success && customersRes.data) setTopCustomers(customersRes.data);
      if (funnelRes.success && funnelRes.data) setConversionFunnel(funnelRes.data);
      if (statusRes.success && statusRes.data) setInvoiceStatus(statusRes.data);
    } catch (err) {
      console.error("Failed to fetch sales data:", err);
      setError("Failed to load sales analytics");
    } finally {
      setLoading(false);
    }
  }, [filters.from, filters.to, filters.companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const dateRangeLabel = `${format(new Date(filters.from), "MMM d, yyyy")} - ${format(new Date(filters.to), "MMM d, yyyy")}`;

  const exportColumns: ColumnDef<TopCustomer>[] = [
    { key: "companyName", header: "Company" },
    { key: "industry", header: "Industry" },
    { key: "totalRevenue", header: "Total Revenue", format: (v) => `€${Number(v).toLocaleString()}` },
    { key: "paidRevenue", header: "Paid Revenue", format: (v) => `€${Number(v).toLocaleString()}` },
    { key: "invoiceCount", header: "Invoices" },
    { key: "quoteCount", header: "Quotes" },
    { key: "conversionRate", header: "Conversion Rate", format: (v) => `${Number(v).toFixed(1)}%` },
  ];

  return (
    <div className="space-y-6" id="sales-report-content">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Reports</h1>
          <p className="text-muted-foreground">
            Detailed sales analytics and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            data={topCustomers}
            filename={`sales-report-${format(new Date(), "yyyy-MM-dd")}`}
            columns={exportColumns}
            elementId="sales-report-content"
            pdfOptions={{
              title: "Sales Report",
              dateRange: dateRangeLabel,
            }}
            disabled={loading}
          />
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCwIcon className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <ReportFilters
        showCompanyFilter
        showStatusFilter
        statusOptions={invoiceStatusOptions}
        statusPlaceholder="Invoice Status"
      />

      {error && (
        <ChartError message={error} onRetry={fetchData} />
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  €{((summary?.totalInvoiceValue || 0) - (summary?.unpaidAmount || 0)).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  €{(summary?.unpaidAmount || 0).toLocaleString()} outstanding
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Quotes</CardTitle>
            <FileTextIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{summary?.totalQuotes || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {summary?.acceptedQuotes || 0} accepted, {summary?.pendingQuotes || 0} pending
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Invoices</CardTitle>
            <ReceiptIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{summary?.totalInvoices || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {summary?.paidInvoices || 0} paid, {summary?.overdueInvoices || 0} overdue
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <PercentIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {conversionFunnel?.conversionRate || 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Avg. {conversionFunnel?.avgDaysToConvert || 0} days to convert
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts - Row 1 */}
      <div className="grid gap-4 md:grid-cols-2">
        {loading ? (
          <>
            <ChartSkeleton height={300} />
            <ChartSkeleton height={300} />
          </>
        ) : revenueData.length === 0 && companyRevenue.length === 0 ? (
          <>
            <EmptyChartState title="No Revenue Data" message="No revenue data available for the selected period." />
            <EmptyChartState title="No Company Data" message="No company revenue data available." />
          </>
        ) : (
          <>
            {revenueData.length > 0 ? (
              <RevenueOverTimeChart data={revenueData} />
            ) : (
              <EmptyChartState title="No Revenue Data" />
            )}
            {companyRevenue.length > 0 ? (
              <RevenueByCompanyChart data={companyRevenue} />
            ) : (
              <EmptyChartState title="No Company Data" />
            )}
          </>
        )}
      </div>

      {/* Charts - Row 2 */}
      <div className="grid gap-4 md:grid-cols-2">
        {loading ? (
          <>
            <ChartSkeleton height={300} />
            <ChartSkeleton height={400} />
          </>
        ) : (
          <>
            {invoiceStatus.length > 0 ? (
              <InvoiceStatusChart data={invoiceStatus} />
            ) : (
              <EmptyChartState title="No Invoice Status Data" />
            )}
            {conversionFunnel ? (
              <ConversionFunnelChart data={conversionFunnel} />
            ) : (
              <EmptyChartState title="No Funnel Data" />
            )}
          </>
        )}
      </div>

      {/* Top Customers Table */}
      {loading ? (
        <ChartSkeleton height={400} />
      ) : topCustomers.length > 0 ? (
        <TopCustomersTable data={topCustomers} />
      ) : (
        <EmptyChartState title="No Customer Data" message="No customer data available for the selected period." />
      )}
    </div>
  );
}

