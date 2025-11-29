"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, ResponsiveContainer } from "recharts";
import type { CompanyRevenue } from "@crm/types";

interface RevenueByCompanyChartProps {
  data: CompanyRevenue[];
  className?: string;
}

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export function RevenueByCompanyChart({ data, className }: RevenueByCompanyChartProps) {
  const formattedData = data.map((item) => ({
    ...item,
    name: item.companyName.length > 15 
      ? item.companyName.substring(0, 15) + "..." 
      : item.companyName,
    fullName: item.companyName,
  }));

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Revenue by Company</CardTitle>
        <CardDescription>Top companies by total revenue</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={formattedData}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 80, bottom: 5 }}
            >
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                className="text-xs"
                tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
                className="text-xs"
                width={80}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, _, props) => (
                      <div className="space-y-1">
                        <p className="font-medium">{props.payload?.fullName}</p>
                        <p>Revenue: €{Number(value).toLocaleString()}</p>
                        <p className="text-muted-foreground text-xs">
                          {props.payload?.invoiceCount} invoices
                        </p>
                      </div>
                    )}
                  />
                }
              />
              <Bar
                dataKey="revenue"
                fill="var(--color-revenue)"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

