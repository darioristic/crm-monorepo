import { generateMeta } from "@/lib/utils";
import { OrderForm } from "@/components/sales/order-form";

export async function generateMetadata() {
  return generateMeta({
    title: "New Order",
    description: "Create a new order",
    canonical: "/dashboard/sales/orders/new",
  });
}

export default function NewOrderPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Order</h1>
        <p className="text-muted-foreground">
          Create a new order
        </p>
      </div>
      <OrderForm mode="create" />
    </div>
  );
}

