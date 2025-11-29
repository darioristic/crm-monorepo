"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import type { RevenuePoint } from "@crm/types";

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
    date: new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    revenue: point.revenue,
  }));

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Revenue Over Time</CardTitle>
        <CardDescription>Daily revenue from paid invoices</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
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

