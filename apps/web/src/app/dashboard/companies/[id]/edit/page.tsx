"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCompanyParams } from "@/hooks/use-company-params";

// This page redirects to the companies list and opens the edit sheet
// This matches the midday-main approach where editing happens via sheets
export default function EditCompanyPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { setParams } = useCompanyParams();

  useEffect(() => {
    // Open the edit company sheet with the company ID
    setParams({ companyId: id });
    // Redirect to companies list (sheet will remain open due to URL params)
    router.replace(`/dashboard/companies?companyId=${id}`);
  }, [id, router, setParams]);

  return null;
}
