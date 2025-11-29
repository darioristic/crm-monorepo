import { generateMeta } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PlusCircledIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import { CompaniesDataTable } from "@/components/companies/companies-data-table";

export async function generateMetadata() {
  return generateMeta({
    title: "Companies",
    description: "Manage companies in your CRM system",
    canonical: "/dashboard/companies"
  });
}

export default function CompaniesPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
          <p className="text-muted-foreground">
            Manage your business clients and partners
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/companies/new">
            <PlusCircledIcon className="mr-2 h-4 w-4" />
            Add Company
          </Link>
        </Button>
      </div>
      <CompaniesDataTable />
    </div>
  );
}

