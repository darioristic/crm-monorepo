"use client";

import { Button } from "@/components/ui/button";
import { PlusCircledIcon } from "@radix-ui/react-icons";
import { CompaniesDataTable } from "@/components/companies/companies-data-table";
import { useCompanyParams } from "@/hooks/use-company-params";

export default function CompaniesPage() {
  const { setParams } = useCompanyParams();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
          <p className="text-muted-foreground">
            Manage your business clients and partners
          </p>
        </div>
        <Button onClick={() => setParams({ createCompany: true })}>
          <PlusCircledIcon className="mr-2 h-4 w-4" />
          Add Company
        </Button>
      </div>
      <CompaniesDataTable />
    </div>
  );
}
