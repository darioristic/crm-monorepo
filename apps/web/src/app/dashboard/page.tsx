"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import CalendarDateRangePicker from "@/components/shared/custom-date-range-picker";
import KPICards from "@/components/finance/kpi-cards";
import Revenue from "@/components/finance/revenue";
import MonthlyExpenses from "@/components/finance/monthly-expenses";
import Summary from "@/components/finance/summary";
import Transactions from "@/components/finance/transactions";
import SavingGoal from "@/components/finance/saving-goal";
import CreditCards from "@/components/finance/my-wallet";

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
          Finance Dashboard
        </h1>
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
