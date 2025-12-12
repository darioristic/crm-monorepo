"use client";
import { KPICards, Revenue, Transactions } from "@/components/finance";

export function MetricsView() {
  return (
    <div className="mt-6 space-y-6">
      <KPICards />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Revenue />
        <Transactions />
      </div>
    </div>
  );
}
