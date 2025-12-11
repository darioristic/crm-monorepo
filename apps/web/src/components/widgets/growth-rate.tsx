"use client";

import { BarChart3 } from "lucide-react";
import { BaseWidget } from "./base";

export function GrowthRateWidget() {
  // TODO: Integrate with real data
  const growthRate = 0;
  const period = "1 year";

  const formatGrowthRate = (rate: number) => {
    const sign = rate > 0 ? "+" : "";
    return `${sign}${rate.toFixed(1)}%`;
  };

  return (
    <BaseWidget
      title="Growth Rate"
      icon={<BarChart3 className="size-4" />}
      description={
        <div className="flex flex-col gap-1">
          <p className="text-sm text-[#878787]">Net revenue growth · {period}</p>
        </div>
      }
      actions="View growth analysis"
      onClick={() => {
        // Navigate to growth analysis
      }}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-normal">{formatGrowthRate(growthRate)}</h2>
        </div>
      </div>
    </BaseWidget>
  );
}
