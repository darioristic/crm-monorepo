"use client";

import { ArrowUpIcon, Building2Icon, CreditCardIcon, TrendingUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinanceDashboard } from "@/hooks/use-finance-dashboard";

function formatCurrency(amount: number, currency: string = "EUR"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function Revenue() {
  const { data, isLoading, error } = useFinanceDashboard();

  if (isLoading) {
    return (
      <Card className="pb-0">
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="pb-0">
        <CardHeader>
          <CardTitle>Revenue by Client</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground">
          {error || "No revenue data available"}
        </CardContent>
      </Card>
    );
  }

  const { revenueByCategory, kpi } = data;
  const totalRevenue = revenueByCategory.reduce((sum, item) => sum + item.amount, 0) || 1;

  if (revenueByCategory.length === 0) {
    return (
      <Card className="pb-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Revenue by Client</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <a href="/sales/invoices">
                <ArrowUpIcon className="rotate-45" />
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Building2Icon className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>No revenue recorded yet</p>
          <p className="text-sm mt-2">Create and mark invoices as paid to see revenue breakdown</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="pb-0">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Revenue by Client</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <a href="/sales/invoices">
              <ArrowUpIcon className="rotate-45" />
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grow space-y-4 lg:space-y-6">
        <div>
          <div className="text-muted-foreground mb-1 text-sm">Total Revenue</div>
          <div className="font-display mb-2 text-3xl" suppressHydrationWarning>
            {formatCurrency(kpi.totalRevenue, kpi.currency)}
          </div>
          <div className="mb-4 flex items-center text-sm text-green-600">
            <TrendingUpIcon className="mr-1 size-4" />
            <span className="text-muted-foreground ml-1">
              from {revenueByCategory.length} clients
            </span>
          </div>
        </div>

        <div className="flex h-3 overflow-hidden rounded-full">
          {revenueByCategory.map((item) => (
            <div
              key={item.category}
              className="h-full"
              style={{
                backgroundColor: item.color,
                width: `${(item.amount / totalRevenue) * 100}%`,
              }}
            />
          ))}
        </div>

        <div className="space-y-4">
          {revenueByCategory.map((item) => (
            <div key={item.category} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <div className="size-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-muted-foreground truncate max-w-[150px]">
                  {item.category}
                </span>
              </div>
              <span className="font-medium" suppressHydrationWarning>
                {formatCurrency(item.amount, kpi.currency)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="bg-muted py-4">
        <div className="flex items-start">
          <CreditCardIcon className="text-muted-foreground mt-0.5 mr-3 h-5 w-5" />
          <div className="text-muted-foreground text-sm">
            <div className="mb-1 font-medium">Revenue breakdown by client.</div>
            <div>Top {revenueByCategory.length} clients shown by paid invoice amounts.</div>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
