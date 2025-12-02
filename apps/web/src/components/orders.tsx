"use client";

import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function OrdersSkeleton() {
	return (
		<div className="space-y-4">
			<Skeleton className="h-10 w-full" />
			<Skeleton className="h-10 w-full" />
			<Skeleton className="h-10 w-full" />
		</div>
	);
}

function OrdersDataTable() {
	// TODO: Implement orders data table
	return (
		<div className="text-sm text-muted-foreground">
			No orders found.
		</div>
	);
}

export function Orders() {
	return (
		<div>
			<h2 className="text-lg font-medium leading-none tracking-tight mb-4">
				Orders
			</h2>

			<Suspense fallback={<OrdersSkeleton />}>
				<OrdersDataTable />
			</Suspense>
		</div>
	);
}

