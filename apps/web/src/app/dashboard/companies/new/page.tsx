import { generateMeta } from "@/lib/utils";
import { CompanyForm } from "@/components/companies/company-form";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export async function generateMetadata() {
  return generateMeta({
    title: "Create Company",
    description: "Add a new company to your CRM system",
    canonical: "/dashboard/companies/new",
  });
}

export default function NewCompanyPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/companies">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Company</h1>
          <p className="text-muted-foreground">
            Add a new company to your CRM system
          </p>
        </div>
      </div>
      <CompanyForm mode="create" />
    </div>
  );
}

