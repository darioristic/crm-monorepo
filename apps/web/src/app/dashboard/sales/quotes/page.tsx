import { generateMeta } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PlusCircledIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import { QuotesDataTable } from "@/components/sales/quotes-data-table";

export async function generateMetadata() {
  return generateMeta({
    title: "Quotes",
    description: "Manage your sales quotes",
    canonical: "/dashboard/sales/quotes",
  });
}

export default function QuotesPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quotes</h1>
          <p className="text-muted-foreground">
            Create and manage sales quotes
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/sales/quotes/new">
            <PlusCircledIcon className="mr-2 h-4 w-4" />
            New Quote
          </Link>
        </Button>
      </div>
      <QuotesDataTable />
    </div>
  );
}
