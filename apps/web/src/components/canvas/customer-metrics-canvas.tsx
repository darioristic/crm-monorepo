"use client";

import { UserMinus, UserPlus, Users } from "lucide-react";
import {
  type CustomerGrowthData,
  type CustomerMetric,
  CustomerMetrics,
  type CustomerTypeData,
} from "@/components/analytics";
import type { ArtifactStage } from "@/lib/artifact-config";
import { BaseCanvas } from "./base-canvas";

interface CustomerMetricsCanvasProps {
  typeData?: CustomerTypeData[];
  growthData?: CustomerGrowthData[];
  metrics?: CustomerMetric[];
  isLoading?: boolean;
  stage?: ArtifactStage;
  onClose?: () => void;
}

// Default data for demo
const DEFAULT_TYPE_DATA: CustomerTypeData[] = [
  { name: "Enterprise", count: 45, color: "#8884d8" },
  { name: "SMB", count: 180, color: "#82ca9d" },
  { name: "Startup", count: 95, color: "#ffc658" },
  { name: "Individual", count: 220, color: "#ff7300" },
];

const DEFAULT_GROWTH_DATA: CustomerGrowthData[] = [
  { period: "Jul", customers: 480, newCustomers: 32, churned: 8 },
  { period: "Aug", customers: 504, newCustomers: 35, churned: 11 },
  { period: "Sep", customers: 528, newCustomers: 38, churned: 14 },
  { period: "Oct", customers: 540, newCustomers: 28, churned: 16 },
  { period: "Nov", customers: 560, newCustomers: 42, churned: 22 },
  { period: "Dec", customers: 540, newCustomers: 25, churned: 45 },
];

const DEFAULT_METRICS: CustomerMetric[] = [
  {
    label: "Total Customers",
    value: 540,
    change: 12,
    changeLabel: "vs last month",
    icon: <Users className="h-4 w-4" />,
  },
  {
    label: "Active Customers",
    value: 485,
    change: 8,
    changeLabel: "vs last month",
    icon: <UserPlus className="h-4 w-4" />,
  },
  {
    label: "New This Month",
    value: 25,
    change: 15,
    changeLabel: "vs last month",
    icon: <UserPlus className="h-4 w-4" />,
  },
  {
    label: "Churn Rate",
    value: "2.4%",
    change: -5,
    changeLabel: "vs last month",
    icon: <UserMinus className="h-4 w-4" />,
  },
];

export function CustomerMetricsCanvas({
  typeData = DEFAULT_TYPE_DATA,
  growthData = DEFAULT_GROWTH_DATA,
  metrics = DEFAULT_METRICS,
  isLoading = false,
  stage = "analysis_ready",
  onClose,
}: CustomerMetricsCanvasProps) {
  return (
    <BaseCanvas type="customer-metrics" stage={stage} isLoading={isLoading} onClose={onClose}>
      <div className="space-y-6">
        {/* Customer Metrics Component */}
        <CustomerMetrics typeData={typeData} growthData={growthData} metrics={metrics} />

        {/* Additional Insights */}
        <div className="space-y-4">
          <h4 className="font-semibold">Customer Insights</h4>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border">
              <p className="text-xs text-muted-foreground">Avg. Customer Value</p>
              <p className="text-lg font-bold">€2,450</p>
              <p className="text-xs text-green-600">+12% vs last month</p>
            </div>
            <div className="p-3 rounded-lg border">
              <p className="text-xs text-muted-foreground">Retention Rate</p>
              <p className="text-lg font-bold">97.6%</p>
              <p className="text-xs text-green-600">Above target</p>
            </div>
            <div className="p-3 rounded-lg border">
              <p className="text-xs text-muted-foreground">Avg. Lifetime</p>
              <p className="text-lg font-bold">18 months</p>
              <p className="text-xs text-muted-foreground">Industry avg: 12mo</p>
            </div>
            <div className="p-3 rounded-lg border">
              <p className="text-xs text-muted-foreground">NPS Score</p>
              <p className="text-lg font-bold">72</p>
              <p className="text-xs text-green-600">Excellent</p>
            </div>
          </div>
        </div>
      </div>
    </BaseCanvas>
  );
}
