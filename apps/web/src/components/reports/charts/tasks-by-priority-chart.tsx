"use client";

import type { TaskPriorityStats } from "@crm/types";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface TasksByPriorityChartProps {
  data: TaskPriorityStats[];
  className?: string;
}

const priorityColors: Record<string, string> = {
  urgent: "hsl(var(--destructive))",
  high: "var(--chart-5)",
  medium: "var(--chart-3)",
  low: "var(--chart-4)",
};

const priorityLabels: Record<string, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const chartConfig = {
  count: {
    label: "Total",
    color: "var(--chart-1)",
  },
  completedCount: {
    label: "Completed",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export function TasksByPriorityChart({ data, className }: TasksByPriorityChartProps) {
  const formattedData = data.map((item) => ({
    ...item,
    name: priorityLabels[item.priority] || item.priority,
    fill: priorityColors[item.priority] || "var(--chart-1)",
    remaining: item.count - item.completedCount,
  }));

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Tasks by Priority</CardTitle>
        <CardDescription>Task distribution and completion by priority level</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          id="reports-tasks-by-priority"
          config={chartConfig}
          className="h-[250px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formattedData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <XAxis dataKey="name" tickLine={false} axisLine={false} className="text-xs" />
              <YAxis tickLine={false} axisLine={false} className="text-xs" />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(_value, _name, props) => (
                      <div className="space-y-1">
                        <p className="font-medium">{props.payload?.name}</p>
                        <p>Total: {props.payload?.count}</p>
                        <p>Completed: {props.payload?.completedCount}</p>
                        <p className="text-muted-foreground">
                          {(
                            (props.payload?.completedCount / props.payload?.count) * 100 || 0
                          ).toFixed(0)}
                          % done
                        </p>
                      </div>
                    )}
                  />
                }
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="var(--chart-3)" opacity={0.3} />
              <Bar dataKey="completedCount" radius={[4, 4, 0, 0]} fill="var(--chart-1)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Priority summary */}
        <div className="grid grid-cols-4 gap-2 pt-4 border-t mt-4">
          {formattedData.map((item) => (
            <div key={item.priority} className="text-center">
              <div
                className="w-3 h-3 rounded-full mx-auto mb-1"
                style={{ backgroundColor: item.fill }}
              />
              <p className="text-lg font-bold">{item.count}</p>
              <p className="text-xs text-muted-foreground">{item.name}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
