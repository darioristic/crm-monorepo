"use client";

import { TrendingUp } from "lucide-react";
import { BaseWidget } from "./base";

export function RevenueSummaryWidget() {
  // TODO: Integrate with real data
  const totalRevenue = 0;
  const period = "1 year";

  return (
    <BaseWidget
      title="Revenue Summary"
      icon={<TrendingUp className="size-4" />}
      description={
        <div className="flex flex-col gap-1">
          <p className="text-sm text-[#878787]">Net revenue · {period}</p>
        </div>
      }
      actions="View revenue trends"
      onClick={() => {
        // Navigate to revenue
      }}
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-normal">€{totalRevenue.toLocaleString()}</h2>
      </div>
    </BaseWidget>
  );
}
