"use client";

import { PieChart } from "lucide-react";
import { BaseWidget } from "./base";

export function ProfitAnalysisWidget() {
  // TODO: Integrate with real data
  const netProfit = 0;
  const period = "1 year";

  const formatCurrency = (amount: number) => {
    return `€${amount.toLocaleString()}`;
  };

  return (
    <BaseWidget
      title="Profit & Loss"
      icon={<PieChart className="size-4" />}
      description={
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[#878787]">
            <span className="text-primary">{formatCurrency(netProfit)}</span> · {period} · Net
          </p>
        </div>
      }
      actions="See detailed analysis"
      onClick={() => {
        // Navigate to profit analysis
      }}
    >
      <div className="h-16 w-full flex items-end">
        {/* Simple bar chart placeholder */}
        <div className="flex items-end gap-1 w-full h-full">
          {[40, 60, 45, 70, 55, 65, 50, 75, 60, 80, 55, 70].map((height, i) => (
            <div
              key={i}
              className="flex-1 bg-muted-foreground/30"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      </div>
    </BaseWidget>
  );
}
