"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { OrdersDataTable } from "@/components/sales/orders-data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrderSettings } from "@/hooks/use-order-settings";

// Dynamic import for OrderSheet to reduce initial bundle size
// This component includes Tiptap editor which is heavy
const OrderSheet = dynamic(
  () => import("@/components/order").then((mod) => ({ default: mod.OrderSheet })),
  { loading: () => <Skeleton className="h-full w-full" /> }
);

export default function OrdersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [refreshKey, setRefreshKey] = useState(0);
  const { defaultSettings } = useOrderSettings();

  const _handleCreateOrder = () => {
    router.push(`${pathname}?type=create`);
  };

  const handleOrderCreated = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">Create and manage your orders</p>
        </div>
      </div>
      <OrdersDataTable refreshTrigger={refreshKey} />
      <OrderSheet defaultSettings={defaultSettings} onOrderCreated={handleOrderCreated} />
    </div>
  );
}
