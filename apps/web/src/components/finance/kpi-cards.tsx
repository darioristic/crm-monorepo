"use client";

import {
  ArrowUpIcon,
  DollarSignIcon,
  FileTextIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react";
import { Bar, BarChart } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinanceDashboard } from "@/hooks/use-finance-dashboard";

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

function formatCurrency(amount: number, currency: string = "EUR"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function KPICards() {
  const { data, isLoading, error } = useFinanceDashboard();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-24 mb-2" />
              <Skeleton className="h-4 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <Card className="col-span-full">
          <CardContent className="py-8 text-center text-muted-foreground">
            {error || "No finance data available"}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { kpi, monthlyTrend } = data;
  const chartData = monthlyTrend.map((item) => ({
    month: item.month,
    revenue: item.revenue,
  }));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-muted-foreground text-sm">
            <WalletIcon className="mr-3 inline size-7 rounded-md border p-1.5" />
            Total Revenue
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="font-display text-3xl" suppressHydrationWarning>
              {formatCurrency(kpi.totalRevenue, kpi.currency)}
            </div>
            <div className="flex flex-col text-sm text-green-600">
              <span className="flex items-center gap-2">
                <TrendingUpIcon className="size-4" />
                Paid
              </span>
              <span className="text-muted-foreground ml-1">from invoices</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button className="grow" variant="outline" asChild>
              <a href="/sales/invoices">
                <ArrowUpIcon />
                View Invoices
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-muted-foreground text-sm">
            <TrendingUpIcon className="mr-3 inline size-7 rounded-md border p-1.5" />
            Net Profit
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-full flex-col justify-between">
          <div className="font-display mb-2 text-3xl" suppressHydrationWarning>
            {formatCurrency(kpi.netProfit, kpi.currency)}
          </div>
          <div className="flex items-center text-sm text-green-600">
            <TrendingUpIcon className="mr-1 h-4 w-4" />
            <span className="text-muted-foreground ml-1">Total profit after expenses</span>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-muted-foreground text-sm">
            <DollarSignIcon className="mr-3 inline size-7 rounded-md border p-1.5" />
            Expenses
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-full flex-col justify-between">
          <div className="font-display mb-2 text-3xl" suppressHydrationWarning>
            {formatCurrency(kpi.totalExpenses, kpi.currency)}
          </div>
          <div className="flex items-center text-sm text-muted-foreground">
            <span>Not tracked yet</span>
          </div>
        </CardContent>
      </Card>

      <Card className="pb-0">
        <CardHeader>
          <CardTitle className="text-muted-foreground text-sm">
            <FileTextIcon className="mr-3 inline size-7 rounded-md border p-1.5" />
            Pending Invoices
          </CardTitle>
          <CardAction>
            <Badge
              variant={kpi.pendingInvoices > 0 ? "destructive" : "secondary"}
              className="text-xs"
            >
              {kpi.pendingInvoices > 0 ? "Unpaid" : "All paid"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex h-full flex-col justify-between">
          <div className="space-y-2">
            <div className="font-display text-3xl" suppressHydrationWarning>
              {formatCurrency(kpi.pendingInvoices, kpi.currency)}
            </div>
          </div>
        </CardContent>
        {chartData.length > 0 && (
          <div className="-mb-1.5">
            <ChartContainer
              id="finance-kpi-pending-invoices"
              config={chartConfig}
              className="h-14 w-full"
            >
              <BarChart accessibilityLayer data={chartData}>
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[7, 7, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
