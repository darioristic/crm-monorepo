"use client";

import type { InvoiceStatusBreakdown } from "@crm/types";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface InvoiceStatusChartProps {
  data: InvoiceStatusBreakdown[];
  className?: string;
}

const statusColors: Record<string, string> = {
  draft: "var(--chart-4)",
  sent: "var(--chart-3)",
  paid: "var(--chart-1)",
  partial: "var(--chart-2)",
  overdue: "hsl(var(--destructive))",
  cancelled: "var(--chart-5)",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  partial: "Partial",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export function InvoiceStatusChart({ data, className }: InvoiceStatusChartProps) {
  const chartData = data.map((item) => ({
    ...item,
    name: statusLabels[item.status] || item.status,
    fill: statusColors[item.status] || "var(--chart-1)",
  }));

  const chartConfig = data.reduce((acc, item) => {
    acc[item.status] = {
      label: statusLabels[item.status] || item.status,
      color: statusColors[item.status],
    };
    return acc;
  }, {} as ChartConfig);

  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Invoices by Status</CardTitle>
        <CardDescription>Distribution of invoice statuses</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          id="reports-invoice-status"
          config={chartConfig}
          className="mx-auto h-[300px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="count"
                nameKey="name"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {chartData.map((entry) => (
                  <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                ))}
              </Pie>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name, props) => (
                      <div className="space-y-1">
                        <p className="font-medium">{name}</p>
                        <p>
                          {Number(value)} invoices ({((Number(value) / total) * 100).toFixed(1)}%)
                        </p>
                        <p className="text-muted-foreground">
                          Total: €{props.payload?.totalValue?.toLocaleString()}
                        </p>
                      </div>
                    )}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
