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
import { Pie, PieChart, Cell, ResponsiveContainer } from "recharts";
import type { MilestoneBreakdown } from "@crm/types";

interface MilestoneStatusChartProps {
  data: MilestoneBreakdown[];
  className?: string;
}

const statusColors: Record<string, string> = {
  pending: "var(--chart-4)",
  in_progress: "var(--chart-2)",
  completed: "var(--chart-1)",
  delayed: "hsl(var(--destructive))",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  delayed: "Delayed",
};

export function MilestoneStatusChart({ data, className }: MilestoneStatusChartProps) {
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
        <CardTitle>Milestone Status</CardTitle>
        <CardDescription>Distribution of milestone statuses</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="mx-auto h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="count"
                nameKey="name"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <div className="space-y-1">
                        <p className="font-medium">{name}</p>
                        <p>{Number(value)} milestones ({((Number(value) / total) * 100).toFixed(1)}%)</p>
                      </div>
                    )}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t mt-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{total}</div>
            <p className="text-sm text-muted-foreground">Total Milestones</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {data.find((d) => d.status === "completed")?.percentage || 0}%
            </div>
            <p className="text-sm text-muted-foreground">Completion Rate</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

