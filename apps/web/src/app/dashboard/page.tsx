"use client";

import { Download } from "lucide-react";
import dynamic from "next/dynamic";
import CreditCards from "@/components/finance/my-wallet";
import Revenue from "@/components/finance/revenue";
import SavingGoal from "@/components/finance/saving-goal";
import Transactions from "@/components/finance/transactions";
import CalendarDateRangePicker from "@/components/shared/custom-date-range-picker";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// Dynamic imports for chart-heavy components to reduce initial bundle size
const KPICards = dynamic(() => import("@/components/finance/kpi-cards"), {
  loading: () => <Skeleton className="h-32 w-full" />,
});

const MonthlyExpenses = dynamic(() => import("@/components/finance/monthly-expenses"), {
  loading: () => <Skeleton className="h-[300px] w-full" />,
});

const Summary = dynamic(() => import("@/components/finance/summary"), {
  loading: () => <Skeleton className="h-[300px] w-full" />,
});

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Finance Dashboard</h1>
        <div className="flex items-center space-x-2">
          <CalendarDateRangePicker />
          <Button size="icon">
            <Download />
          </Button>
        </div>
      </div>

      <KPICards />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Revenue />
        <MonthlyExpenses />
        <Summary />
      </div>

      <div className="grid-cols-2 gap-4 space-y-4 lg:grid lg:space-y-0">
        <Transactions />
        <div className="space-y-4">
          <SavingGoal />
          <CreditCards />
        </div>
      </div>
    </div>
  );
}
