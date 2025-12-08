"use client";

import type { RevenuePoint } from "@crm/types";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface RevenueOverTimeChartProps {
  data: RevenuePoint[];
  className?: string;
}

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function RevenueOverTimeChart({ data, className }: RevenueOverTimeChartProps) {
  const formattedData = data.map((point) => ({
    ...point,
    date: `${new Date(point.date).getDate().toString().padStart(2, "0")}.${(new Date(point.date).getMonth() + 1).toString().padStart(2, "0")}.${new Date(point.date).getFullYear()}`,
    revenue: point.revenue,
  }));

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Revenue Over Time</CardTitle>
        <CardDescription>Daily revenue from paid invoices</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          id="reports-revenue-over-time"
          config={chartConfig}
          className="h-[300px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formattedData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                className="text-xs"
                tickMargin={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                className="text-xs"
                tickMargin={8}
                tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{name}:</span>
                        <span>€{Number(value).toLocaleString()}</span>
                      </div>
                    )}
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="var(--color-revenue)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
