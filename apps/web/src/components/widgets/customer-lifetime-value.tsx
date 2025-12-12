"use client";

import { Users } from "lucide-react";
import { BaseWidget } from "./base";

export function CustomerLifetimeValueWidget() {
  // TODO: Integrate with real data
  const averageCLV = 127109303.2;
  const totalCustomers = 1;
  const activeCustomers = 1;
  const averageLifespanDays = 1;

  const activePercentage =
    totalCustomers > 0 ? Math.round((activeCustomers / totalCustomers) * 100) : 0;

  return (
    <BaseWidget
      title="Customer Lifetime Value"
      icon={<Users className="size-4" />}
      description={
        <div className="flex flex-col gap-3">
          {/* Average CLV */}
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-medium">€{averageCLV.toLocaleString()}</p>
            <span className="text-xs text-[#878787]">avg. CLV</span>
          </div>

          {/* Summary Stats */}
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[#878787] text-xs">Total customers</span>
              <span className="font-medium">{totalCustomers}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#878787] text-xs">Active (30d)</span>
              <span className="font-medium">
                {activeCustomers} <span className="text-[#878787]">({activePercentage}%)</span>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#878787] text-xs">Avg. lifespan</span>
              <span className="font-medium">{averageLifespanDays} days</span>
            </div>
          </div>
        </div>
      }
      actions="View all customers"
      onClick={() => {
        // Navigate to customers
      }}
    >
      <div />
    </BaseWidget>
  );
}
