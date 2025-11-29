"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import type { TaskStatPoint } from "@crm/types";

interface TaskCompletionChartProps {
  data: TaskStatPoint[];
  className?: string;
}

const chartConfig = {
  created: {
    label: "Created",
    color: "var(--chart-1)",
  },
  completed: {
    label: "Completed",
    color: "var(--chart-2)",
  },
  pending: {
    label: "Pending",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

export function TaskCompletionChart({ data, className }: TaskCompletionChartProps) {
  const formattedData = data.map((point) => ({
    ...point,
    date: new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Task Activity Over Time</CardTitle>
        <CardDescription>Tasks created, completed, and pending over time</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-created)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-created)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-completed)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-completed)" stopOpacity={0} />
                </linearGradient>
              </defs>
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
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Area
                type="monotone"
                dataKey="created"
                stroke="var(--color-created)"
                fillOpacity={1}
                fill="url(#colorCreated)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="completed"
                stroke="var(--color-completed)"
                fillOpacity={1}
                fill="url(#colorCompleted)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

