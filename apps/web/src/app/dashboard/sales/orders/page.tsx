"use client";

import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PlusCircledIcon } from "@radix-ui/react-icons";
import { OrdersDataTable } from "@/components/sales/orders-data-table";
import { OrderSheet } from "@/components/order";

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
          <p className="text-muted-foreground">
            Create and manage your orders
          </p>
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
