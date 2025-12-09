"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { companiesApi } from "@/lib/api";
import type { InvoiceDefaultSettings } from "@/types/invoice";
import { DEFAULT_INVOICE_TEMPLATE } from "@/types/invoice";

// Hook for invoice settings - fetches fromDetails from current company
export function useInvoiceSettings() {
  const { user } = useAuth();
  const [fromDetails, setFromDetails] = useState<any>(null);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);

  // Fetch fromDetails from current user's company instead of localStorage
  useEffect(() => {
    const fetchCompanyDetails = async () => {
      if (!user?.companyId) {
        setFromDetails(null);
        return;
      }

      try {
        const response = await companiesApi.getById(user.companyId);

        if (response.success && response.data) {
          const company = response.data;

          // Build fromDetails from company data
          const lines: string[] = [];
          if (company.name) lines.push(company.name);
          if (company.address) lines.push(company.address);

          const cityLine = [company.city, company.zip, company.country].filter(Boolean).join(", ");
          if (cityLine) lines.push(cityLine);

          if (company.email) lines.push(company.email);
          if (company.phone) lines.push(company.phone);
          if (company.website) lines.push(company.website);
          if (company.vatNumber) lines.push(`PIB: ${company.vatNumber}`);

          const builtFromDetails =
            lines.length > 0
              ? {
                  type: "doc",
                  content: lines.map((line) => ({
                    type: "paragraph",
                    content: [{ type: "text", text: line }],
                  })),
                }
              : null;
          setFromDetails(builtFromDetails);
        }
      } catch (error) {
        console.error("[useInvoiceSettings] Failed to fetch company details:", error);
        setFromDetails(null);
      }
    };

    // Load paymentDetails from localStorage (can be company-independent)
    try {
      const savedPaymentDetails = localStorage.getItem("invoice_payment_details");
      if (savedPaymentDetails) {
        setPaymentDetails(JSON.parse(savedPaymentDetails));
      }
    } catch {
      setPaymentDetails(null);
    }

    fetchCompanyDetails();
  }, [user?.companyId]);

  // Load default settings
  const defaultSettings = useMemo((): InvoiceDefaultSettings => {
    return {
      template: DEFAULT_INVOICE_TEMPLATE,
      fromDetails,
      paymentDetails,
    };
  }, [fromDetails, paymentDetails]);

  return {
    defaultSettings,
  };
}
