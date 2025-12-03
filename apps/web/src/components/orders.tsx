"use client";

import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { request } from "@/lib/api";

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
	const { data: orders, isLoading } = useQuery({
		queryKey: ["orders"],
		queryFn: async () => {
			const response = await request("/api/v1/orders");
			return response.success && response.data ? response.data : [];
		},
	});

	if (isLoading) {
		return <div className="text-sm text-muted-foreground">Loading orders...</div>;
	}

	if (!orders || orders.length === 0) {
		return (
			<div className="text-sm text-muted-foreground">
				No orders found.
			</div>
		);
	}

	return (
		<div className="space-y-2">
			{orders.map((order: any) => (
				<div key={order.id} className="border p-4 rounded">
					<div className="font-medium">{order.orderNumber}</div>
					<div className="text-sm text-muted-foreground">
						Status: {order.status} | Total: {order.total} {order.currency}
					</div>
				</div>
			))}
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

