"use client";

import { Landmark } from "lucide-react";
import { BaseWidget } from "./base";

export function CashFlowWidget() {
  // TODO: Integrate with real data
  const netCashFlow = 0;
  const period = "1 year";

  const formatCashFlow = (amount: number) => {
    const sign = amount >= 0 ? "+" : "";
    return `${sign}€${Math.abs(amount).toLocaleString()}`;
  };

  return (
    <BaseWidget
      title="Cash Flow"
      icon={<Landmark className="size-4" />}
      description={
        <div className="flex flex-col gap-1">
          <p className="text-sm text-[#878787]">Net cash position · {period}</p>
        </div>
      }
      actions="View cash flow analysis"
      onClick={() => {
        // Navigate to cash flow analysis
      }}
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-normal">{formatCashFlow(netCashFlow)}</h2>
      </div>
    </BaseWidget>
  );
}
