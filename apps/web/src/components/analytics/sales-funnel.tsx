"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Sales Funnel Visualization
 *
 * Displays the sales pipeline stages as a funnel chart showing:
 * - Number of deals at each stage
 * - Total value at each stage
 * - Conversion rates between stages
 */

// ============================================================================
// Types
// ============================================================================

export interface FunnelStage {
  name: string;
  count: number;
  value: number;
  color?: string;
}

export interface SalesFunnelProps {
  data: FunnelStage[];
  title?: string;
  description?: string;
  showValue?: boolean;
  showConversion?: boolean;
  className?: string;
  height?: number;
}

// Default colors for funnel stages
const DEFAULT_COLORS = [
  "#3b82f6", // blue-500 - Lead
  "#8b5cf6", // violet-500 - Qualified
  "#f59e0b", // amber-500 - Proposal
  "#10b981", // emerald-500 - Negotiation
  "#22c55e", // green-500 - Won
];

// ============================================================================
// Component
// ============================================================================

export function SalesFunnel({
  data,
  title = "Sales Funnel",
  description = "Deal progression through pipeline stages",
  showValue = true,
  showConversion = true,
  className,
  height = 300,
}: SalesFunnelProps) {
  // Calculate conversion rates
  const dataWithConversion = useMemo(() => {
    return data.map((stage, index) => {
      const prevCount = index > 0 ? data[index - 1].count : stage.count;
      const conversionRate = prevCount > 0 ? ((stage.count / prevCount) * 100).toFixed(1) : "100";

      return {
        ...stage,
        conversionRate: `${conversionRate}%`,
        color: stage.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
      };
    });
  }, [data]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalDeals = data.reduce((sum, stage) => sum + stage.count, 0);
    const totalValue = data.reduce((sum, stage) => sum + stage.value, 0);
    const wonValue = data.find((s) => s.name.toLowerCase().includes("won"))?.value || 0;
    const overallConversion =
      data.length > 0 && data[0].count > 0
        ? ((data[data.length - 1].count / data[0].count) * 100).toFixed(1)
        : "0";

    return { totalDeals, totalValue, wonValue, overallConversion };
  }, [data]);

  // Format currency
  const formatValue = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
    if (!active || !payload?.length) return null;

    const data = payload[0].payload as FunnelStage & { conversionRate: string };

    return (
      <div className="rounded-lg border bg-background p-3 shadow-lg">
        <p className="font-medium">{data.name}</p>
        <p className="text-sm text-muted-foreground">Deals: {data.count}</p>
        {showValue && (
          <p className="text-sm text-muted-foreground">Value: {formatValue(data.value)}</p>
        )}
        {showConversion && (
          <p className="text-sm text-muted-foreground">Conversion: {data.conversionRate}</p>
        )}
      </div>
    );
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{totals.overallConversion}%</p>
            <p className="text-xs text-muted-foreground">Overall Conversion</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats Row */}
        <div className="mb-4 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-lg font-semibold">{totals.totalDeals}</p>
            <p className="text-xs text-muted-foreground">Total Deals</p>
          </div>
          <div>
            <p className="text-lg font-semibold">{formatValue(totals.totalValue)}</p>
            <p className="text-xs text-muted-foreground">Pipeline Value</p>
          </div>
          <div>
            <p className="text-lg font-semibold">{formatValue(totals.wonValue)}</p>
            <p className="text-xs text-muted-foreground">Won Value</p>
          </div>
        </div>

        {/* Funnel Chart */}
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={dataWithConversion}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {dataWithConversion.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
              <LabelList
                dataKey="count"
                position="right"
                formatter={(value: number) => value}
                className="fill-foreground text-sm"
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Stage Details */}
        {showConversion && (
          <div className="mt-4 space-y-2">
            {dataWithConversion.map((stage, index) => (
              <div key={stage.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: stage.color }} />
                  <span>{stage.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground">{stage.count} deals</span>
                  {showValue && (
                    <span className="text-muted-foreground">{formatValue(stage.value)}</span>
                  )}
                  {index > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {stage.conversionRate} from prev
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Preset Data Loaders
// ============================================================================

/**
 * Default sales funnel stages for CRM
 */
export const DEFAULT_FUNNEL_STAGES: FunnelStage[] = [
  { name: "Lead", count: 100, value: 500000, color: "#3b82f6" },
  { name: "Qualified", count: 60, value: 350000, color: "#8b5cf6" },
  { name: "Proposal", count: 35, value: 200000, color: "#f59e0b" },
  { name: "Negotiation", count: 20, value: 150000, color: "#10b981" },
  { name: "Won", count: 12, value: 100000, color: "#22c55e" },
];

/**
 * Quote-based funnel stages
 */
export const QUOTE_FUNNEL_STAGES: FunnelStage[] = [
  { name: "Draft", count: 45, value: 225000, color: "#64748b" },
  { name: "Sent", count: 35, value: 175000, color: "#3b82f6" },
  { name: "Viewed", count: 28, value: 140000, color: "#8b5cf6" },
  { name: "Accepted", count: 18, value: 90000, color: "#22c55e" },
  { name: "Invoiced", count: 15, value: 75000, color: "#10b981" },
];
