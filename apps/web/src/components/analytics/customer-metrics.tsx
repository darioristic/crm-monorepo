"use client";

import { DollarSign, TrendingDown, TrendingUp, UserMinus, UserPlus, Users } from "lucide-react";
import { useMemo } from "react";
import type { TooltipProps } from "recharts";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Customer Metrics Visualization
 *
 * Displays key customer metrics including:
 * - Customer distribution by type (pie chart)
 * - Customer growth over time (area chart)
 * - Key metrics cards (total, new, churned, revenue)
 */

// ============================================================================
// Types
// ============================================================================

export interface CustomerTypeData {
  name: string;
  count: number;
  color?: string;
}

export interface CustomerGrowthData {
  period: string;
  customers: number;
  newCustomers: number;
  churned: number;
}

export interface CustomerMetric {
  label: string;
  value: number | string;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
}

export interface CustomerMetricsProps {
  typeData: CustomerTypeData[];
  growthData?: CustomerGrowthData[];
  metrics?: CustomerMetric[];
  title?: string;
  description?: string;
  className?: string;
}

// Default colors
const TYPE_COLORS = {
  lead: "#64748b",
  prospect: "#3b82f6",
  customer: "#22c55e",
  churned: "#ef4444",
  partner: "#8b5cf6",
};

const DEFAULT_COLORS = ["#22c55e", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#64748b"];

// ============================================================================
// Sub-Components
// ============================================================================

interface MetricCardProps {
  metric: CustomerMetric;
}

function MetricCard({ metric }: MetricCardProps) {
  const isPositive = (metric.change ?? 0) >= 0;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{metric.label}</span>
        {metric.icon && <span className="text-muted-foreground">{metric.icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold">{metric.value}</span>
        {metric.change !== undefined && (
          <span
            className={cn(
              "flex items-center text-xs",
              isPositive ? "text-green-500" : "text-red-500"
            )}
          >
            {isPositive ? (
              <TrendingUp className="mr-1 h-3 w-3" />
            ) : (
              <TrendingDown className="mr-1 h-3 w-3" />
            )}
            {Math.abs(metric.change)}%
            {metric.changeLabel && (
              <span className="ml-1 text-muted-foreground">{metric.changeLabel}</span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CustomerMetrics({
  typeData,
  growthData,
  metrics,
  title = "Customer Analytics",
  description = "Overview of customer base and growth",
  className,
}: CustomerMetricsProps) {
  // Add colors to type data
  const coloredTypeData = useMemo(() => {
    return typeData.map((item, index) => ({
      ...item,
      color:
        item.color ||
        TYPE_COLORS[item.name.toLowerCase() as keyof typeof TYPE_COLORS] ||
        DEFAULT_COLORS[index % DEFAULT_COLORS.length],
    }));
  }, [typeData]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalCustomers = typeData.reduce((sum, t) => sum + t.count, 0);
    const activeCustomers = typeData
      .filter((t) => ["customer", "partner"].includes(t.name.toLowerCase()))
      .reduce((sum, t) => sum + t.count, 0);

    return { totalCustomers, activeCustomers };
  }, [typeData]);

  // Format large numbers
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Custom tooltip for pie chart
  const PieTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (!active || !payload?.length) return null;

    const data = payload[0].payload as CustomerTypeData & { color: string };
    const percentage = ((data.count / totals.totalCustomers) * 100).toFixed(1);

    return (
      <div className="rounded-lg border bg-background p-3 shadow-lg">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: data.color }} />
          <span className="font-medium">{data.name}</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.count} customers ({percentage}%)
        </p>
      </div>
    );
  };

  // Custom tooltip for area chart
  const AreaTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (!active || !payload?.length) return null;

    return (
      <div className="rounded-lg border bg-background p-3 shadow-lg">
        <p className="font-medium">{label}</p>
        {payload.map((entry, index) => (
          <p
            key={entry?.name ?? `series-${index}`}
            className="text-sm"
            style={{ color: entry.color }}
          >
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  };

  // Default metrics if not provided
  const displayMetrics = metrics || [
    {
      label: "Total Customers",
      value: formatNumber(totals.totalCustomers),
      change: 12,
      changeLabel: "vs last month",
      icon: <Users className="h-4 w-4" />,
    },
    {
      label: "Active Customers",
      value: formatNumber(totals.activeCustomers),
      change: 8,
      changeLabel: "vs last month",
      icon: <UserPlus className="h-4 w-4" />,
    },
    {
      label: "Churned",
      value: typeData.find((t) => t.name.toLowerCase() === "churned")?.count || 0,
      change: -5,
      changeLabel: "vs last month",
      icon: <UserMinus className="h-4 w-4" />,
    },
    {
      label: "Avg. Revenue",
      value: "$2.5K",
      change: 15,
      changeLabel: "vs last month",
      icon: <DollarSign className="h-4 w-4" />,
    },
  ];

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Metrics Row */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {displayMetrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Pie Chart - Customer Distribution */}
          <div>
            <h4 className="mb-4 text-sm font-medium">Customer Distribution</h4>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={coloredTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="count"
                  nameKey="name"
                >
                  {coloredTypeData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => <span className="text-sm">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Area Chart - Customer Growth */}
          {growthData && growthData.length > 0 && (
            <div>
              <h4 className="mb-4 text-sm font-medium">Customer Growth</h4>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={growthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCustomers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip content={<AreaTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="customers"
                    name="Total Customers"
                    stroke="#22c55e"
                    fillOpacity={1}
                    fill="url(#colorCustomers)"
                  />
                  <Area
                    type="monotone"
                    dataKey="newCustomers"
                    name="New Customers"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#colorNew)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Customer Type Breakdown */}
        <div>
          <h4 className="mb-3 text-sm font-medium">Breakdown by Type</h4>
          <div className="space-y-2">
            {coloredTypeData.map((type) => {
              const percentage = ((type.count / totals.totalCustomers) * 100).toFixed(1);
              return (
                <div key={type.name} className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: type.color }} />
                  <span className="flex-1 text-sm">{type.name}</span>
                  <span className="text-sm text-muted-foreground">{type.count}</span>
                  <div className="w-24">
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: type.color,
                        }}
                      />
                    </div>
                  </div>
                  <span className="w-12 text-right text-sm text-muted-foreground">
                    {percentage}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Preset Data
// ============================================================================

/**
 * Sample customer type distribution
 */
export const SAMPLE_CUSTOMER_TYPES: CustomerTypeData[] = [
  { name: "Customer", count: 450 },
  { name: "Prospect", count: 180 },
  { name: "Lead", count: 320 },
  { name: "Partner", count: 45 },
  { name: "Churned", count: 85 },
];

/**
 * Sample customer growth data
 */
export const SAMPLE_GROWTH_DATA: CustomerGrowthData[] = [
  { period: "Jan", customers: 850, newCustomers: 45, churned: 12 },
  { period: "Feb", customers: 890, newCustomers: 52, churned: 8 },
  { period: "Mar", customers: 940, newCustomers: 60, churned: 10 },
  { period: "Apr", customers: 985, newCustomers: 55, churned: 10 },
  { period: "May", customers: 1020, newCustomers: 48, churned: 13 },
  { period: "Jun", customers: 1080, newCustomers: 72, churned: 12 },
];
