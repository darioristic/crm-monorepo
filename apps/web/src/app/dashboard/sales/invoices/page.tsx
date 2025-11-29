import { generateMeta } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PlusCircledIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import { InvoicesDataTable } from "@/components/sales/invoices-data-table";

export async function generateMetadata() {
  return generateMeta({
    title: "Invoices",
    description: "Manage your invoices",
    canonical: "/dashboard/sales/invoices",
  });
}

export default function InvoicesPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">
            Create and manage your invoices
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/sales/invoices/new">
            <PlusCircledIcon className="mr-2 h-4 w-4" />
            New Invoice
          </Link>
        </Button>
      </div>
      <InvoicesDataTable />
    </div>
  );
}
