import { TenantCompaniesDataTable } from "@/components/companies/tenant-companies-data-table";
import { CreateCompanyCardTenant } from "@/components/companies/create-company-card-tenant";
import type { Metadata } from "next";

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
					Manage companies in your tenant. Create, edit, or delete companies.
				</p>
			</div>
			
			<div className="space-y-4">
				<CreateCompanyCardTenant />
				<TenantCompaniesDataTable />
			</div>
		</div>
	);
}

