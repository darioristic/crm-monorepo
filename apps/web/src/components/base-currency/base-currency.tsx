"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { SelectCurrency } from "@/components/base-currency/select-currency";

export function BaseCurrency() {
	return (
		<Card className="border-border/50">
			<CardHeader className="pb-4">
				<CardTitle className="text-base font-medium">Base Currency</CardTitle>
				<CardDescription className="text-sm">
					Set a base currency for your account to view your total balance in your preferred currency.
					Exchange rates are updated every 24 hours.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="max-w-md">
					<SelectCurrency />
				</div>
			</CardContent>
		</Card>
	);
}

