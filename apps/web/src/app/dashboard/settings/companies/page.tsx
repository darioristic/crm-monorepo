import type { Metadata } from "next";
import { TenantCompaniesDataTable } from "@/components/companies/tenant-companies-data-table";

export const metadata: Metadata = {
  title: "Companies",
  description: "Manage companies in your tenant.",
};

export default function CompaniesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Companies</h2>
        <p className="text-sm text-muted-foreground">
          View tenant companies for your organization.
        </p>
      </div>
      <div className="space-y-4">
        <TenantCompaniesDataTable />
      </div>
    </div>
  );
}
