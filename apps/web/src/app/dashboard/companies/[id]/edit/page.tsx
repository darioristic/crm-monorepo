"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { Company } from "@crm/types";
import { companiesApi } from "@/lib/api";
import { CompanyForm } from "@/components/companies/company-form";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditCompanyPage() {
  const params = useParams();
  const id = params.id as string;
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCompany() {
      setIsLoading(true);
      try {
        const response = await companiesApi.getById(id);
        if (response.success && response.data) {
          setCompany(response.data);
        } else {
          setError(response.error?.message || "Failed to load company");
        }
      } catch (e) {
        setError("Failed to load company");
      } finally {
        setIsLoading(false);
      }
    }

    fetchCompany();
  }, [id]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-[400px] w-full max-w-2xl" />
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/companies">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Edit Company</h1>
        </div>
        <Alert variant="destructive">
          <AlertDescription>
            {error || "Company not found"}
            <Button variant="link" asChild className="ml-2">
              <Link href="/dashboard/companies">Go back to companies</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/companies">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Company</h1>
          <p className="text-muted-foreground">
            Update information for {company.name}
          </p>
        </div>
      </div>
      <CompanyForm mode="edit" company={company} />
    </div>
  );
}

