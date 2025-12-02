"use client";

import {
	Card,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

function BankAccountListSkeleton() {
	return (
		<div className="space-y-4">
			<Skeleton className="h-16 w-full" />
			<Skeleton className="h-16 w-full" />
		</div>
	);
}

function BankAccountList() {
	// TODO: Implement bank account list
	return (
		<div className="text-sm text-muted-foreground py-4">
			No bank accounts connected.
		</div>
	);
}

export function ConnectedAccounts() {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Accounts</CardTitle>
				<CardDescription>
					Manage bank accounts, update or connect new ones.
				</CardDescription>
			</CardHeader>

			<Suspense fallback={<BankAccountListSkeleton />}>
				<BankAccountList />
			</Suspense>

			<CardFooter className="flex justify-between">
				<div />

				<Button>
					<Plus className="h-4 w-4 mr-2" />
					Add account
				</Button>
			</CardFooter>
		</Card>
	);
}

