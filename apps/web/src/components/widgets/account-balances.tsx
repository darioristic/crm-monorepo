"use client";

import { Landmark } from "lucide-react";
import { BaseWidget } from "./base";

export function AccountBalancesWidget() {
  // TODO: Integrate with real data
  const totalBalance = 0;
  const accountCount = 0;

  const getDescription = () => {
    if (accountCount === 0) {
      return "No accounts connected";
    }
    if (accountCount === 1) {
      return "Combined balance from 1 account";
    }
    return `Combined balance from ${accountCount} accounts`;
  };

  return (
    <BaseWidget
      title="Account Balances"
      icon={<Landmark className="size-4" />}
      description={getDescription()}
      onClick={() => {
        // Navigate to accounts
      }}
      actions="View account balances"
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-normal">€{totalBalance.toLocaleString()}</h2>
      </div>
    </BaseWidget>
  );
}
