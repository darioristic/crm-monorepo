"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCompanyParams } from "@/hooks/use-company-params";

// This page redirects to the companies list and opens the create sheet
// This matches the midday-main approach where creation happens via sheets
export default function CreateCompanyPage() {
  const router = useRouter();
  const { setParams } = useCompanyParams();

  useEffect(() => {
    // Open the create company sheet
    setParams({ createCompany: true });
    // Redirect to companies list (sheet will remain open due to URL params)
    router.replace("/dashboard/companies?createCompany=true");
  }, [router, setParams]);

  return null;
}

