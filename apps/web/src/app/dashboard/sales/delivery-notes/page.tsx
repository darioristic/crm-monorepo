import { generateMeta } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PlusCircledIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import { DeliveryNotesDataTable } from "@/components/sales/delivery-notes-data-table";

export async function generateMetadata() {
  return generateMeta({
    title: "Delivery Notes",
    description: "Manage your delivery notes",
    canonical: "/dashboard/sales/delivery-notes",
  });
}

export default function DeliveryNotesPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Delivery Notes</h1>
          <p className="text-muted-foreground">
            Track and manage product deliveries
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/sales/delivery-notes/new">
            <PlusCircledIcon className="mr-2 h-4 w-4" />
            New Delivery Note
          </Link>
        </Button>
      </div>
      <DeliveryNotesDataTable />
    </div>
  );
}
