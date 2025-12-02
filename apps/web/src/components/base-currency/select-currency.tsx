"use client";

import { SelectCurrency as SelectCurrencyBase } from "@/components/select-currency";
import { useTeamMutation } from "@/hooks/use-team";
import { useTeamQuery } from "@/hooks/use-team";
import { uniqueCurrencies } from "@/lib/utils/currencies";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEffect, useState } from "react";

export function SelectCurrency() {
	const [isSyncing, setSyncing] = useState(false);
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
			},
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

