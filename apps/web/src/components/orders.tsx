"use client";

import type { Order } from "@crm/types";
import { useQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
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
  const { data: orders = [], isLoading } = useQuery<Order[], unknown>({
    queryKey: ["orders"],
    queryFn: async () => {
      const response = await request("/api/v1/orders");
      return response.success && Array.isArray(response.data) ? (response.data as Order[]) : [];
    },
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading orders...</div>;
  }

  if (!orders || (Array.isArray(orders) && orders.length === 0)) {
    return <div className="text-sm text-muted-foreground">No orders found.</div>;
  }

  return (
    <div className="space-y-2">
      {Array.isArray(orders) &&
        orders.map((order: Order) => (
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
      <h2 className="text-lg font-medium leading-none tracking-tight mb-4">Orders</h2>

      <Suspense fallback={<OrdersSkeleton />}>
        <OrdersDataTable />
      </Suspense>
    </div>
  );
}
