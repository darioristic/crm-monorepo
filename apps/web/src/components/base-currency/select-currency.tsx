"use client";

import { useState } from "react";
import { toast } from "sonner";
import { SelectCurrency as SelectCurrencyBase } from "@/components/select-currency";
import { useTeamMutation, useTeamQuery } from "@/hooks/use-team";
import { uniqueCurrencies } from "@/lib/utils/currencies";

export function SelectCurrency() {
  const [_isSyncing, _setSyncing] = useState(false);
  const updateTeamMutation = useTeamMutation();
  const { data: team } = useTeamQuery();

  const handleChange = async (baseCurrency: string) => {
    updateTeamMutation.mutate(
      {
        baseCurrency: baseCurrency.toUpperCase(),
      },
      {
        onSuccess: () => {
          toast.success("Base currency updated successfully");
        },
        onError: () => {
          toast.error("Failed to update base currency");
        },
      }
    );
  };

  return (
    <div className="w-[200px]">
      <SelectCurrencyBase
        onChange={handleChange}
        currencies={uniqueCurrencies}
        value={team?.baseCurrency ?? undefined}
      />
    </div>
  );
}
