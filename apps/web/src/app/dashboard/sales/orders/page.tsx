"use client";

import { PlusCircledIcon } from "@radix-ui/react-icons";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { OrdersDataTable } from "@/components/sales/orders-data-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// Dynamic import for OrderSheet to reduce initial bundle size
// This component includes Tiptap editor which is heavy
const OrderSheet = dynamic(
  () => import("@/components/order").then((mod) => ({ default: mod.OrderSheet })),
  { loading: () => <Skeleton className="h-full w-full" /> }
);

export default function OrdersPage() {
  const router = useRouter();
  const pathname = usePathname();

  const handleCreateOrder = () => {
    router.push(`${pathname}?type=create`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">Create and manage your orders</p>
        </div>
        <Button onClick={handleCreateOrder}>
          <PlusCircledIcon className="mr-2 h-4 w-4" />
          New Order
        </Button>
      </div>
      <OrdersDataTable />
      <OrderSheet />
    </div>
  );
}
