"use client";

import { SalesFunnel } from "@/components/analytics";
import type { ArtifactStage } from "@/lib/artifact-config";
import { BaseCanvas } from "./base-canvas";

interface SalesFunnelCanvasProps {
  data?: Array<{
    name: string;
    count: number;
    value: number;
  }>;
  isLoading?: boolean;
  stage?: ArtifactStage;
  onClose?: () => void;
}

// Default data for demo
const DEFAULT_FUNNEL_DATA = [
  { name: "Lead", count: 150, value: 750000 },
  { name: "Qualified", count: 95, value: 520000 },
  { name: "Proposal", count: 48, value: 380000 },
  { name: "Negotiation", count: 28, value: 250000 },
  { name: "Won", count: 18, value: 180000 },
];

export function SalesFunnelCanvas({
  data = DEFAULT_FUNNEL_DATA,
  isLoading = false,
  stage = "analysis_ready",
  onClose,
}: SalesFunnelCanvasProps) {
  // Calculate conversion rate
  const totalLeads = data[0]?.count || 0;
  const wonDeals = data[data.length - 1]?.count || 0;
  const conversionRate = totalLeads > 0 ? ((wonDeals / totalLeads) * 100).toFixed(1) : "0";

  return (
    <BaseCanvas type="sales-funnel" stage={stage} isLoading={isLoading} onClose={onClose}>
      <div className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">Total Leads</p>
            <p className="text-2xl font-bold">{totalLeads}</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">Deals Won</p>
            <p className="text-2xl font-bold text-green-600">{wonDeals}</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">Conversion Rate</p>
            <p className="text-2xl font-bold text-blue-600">{conversionRate}%</p>
          </div>
        </div>

        {/* Funnel Chart */}
        <SalesFunnel data={data} showValue showConversion height={400} />

        {/* Stage Details */}
        <div className="space-y-2">
          <h4 className="font-semibold">Stage Breakdown</h4>
          <div className="space-y-1">
            {data.map((stage, index) => {
              const prevCount = index > 0 ? data[index - 1].count : stage.count;
              const dropoff =
                prevCount > 0 ? (((prevCount - stage.count) / prevCount) * 100).toFixed(0) : "0";
              return (
                <div
                  key={stage.name}
                  className="flex items-center justify-between p-2 rounded bg-muted/30"
                >
                  <span className="text-sm font-medium">{stage.name}</span>
                  <div className="flex items-center gap-4 text-sm">
                    <span>{stage.count} deals</span>
                    <span className="text-muted-foreground">
                      €{(stage.value / 1000).toFixed(0)}k
                    </span>
                    {index > 0 && <span className="text-red-500 text-xs">-{dropoff}%</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </BaseCanvas>
  );
}
