"use client";

import { useEffect, useMemo, useState } from "react";
import { useTenant } from "@/contexts/tenant-context";
import type { DeliveryNoteDefaultSettings, EditorDoc } from "@/types/delivery-note";
import { DEFAULT_DELIVERY_NOTE_TEMPLATE } from "@/types/delivery-note";

// Hook for delivery note settings - fetches fromDetails and logo from current tenant
export function useDeliveryNoteSettings() {
  const { currentTenant } = useTenant();
  const [fromDetails, setFromDetails] = useState<EditorDoc | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<EditorDoc | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch fromDetails and logoUrl from current tenant's company via /api/v1/companies/current
  useEffect(() => {
    const fetchCompanyDetails = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/v1/companies/current", {
          credentials: "include",
        });
        const data = await response.json();

        if (data.success && data.data) {
          const company = data.data;

          // Set logo URL from tenant
          setLogoUrl(company.logoUrl || null);

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
          if (company.companyNumber) lines.push(`MB: ${company.companyNumber}`);

          const builtFromDetails: EditorDoc | null =
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
        } else {
          setFromDetails(null);
          setLogoUrl(null);
        }
      } catch (error) {
        console.error("[useDeliveryNoteSettings] Failed to fetch tenant company details:", error);
        setFromDetails(null);
        setLogoUrl(null);
      } finally {
        setIsLoading(false);
      }
    };

    // Load paymentDetails from localStorage (can be company-independent)
    try {
      const savedPaymentDetails = localStorage.getItem("delivery_note_payment_details");
      if (savedPaymentDetails) {
        setPaymentDetails(JSON.parse(savedPaymentDetails) as EditorDoc);
      }
    } catch {
      setPaymentDetails(null);
    }

    fetchCompanyDetails();
  }, [currentTenant?.id]);

  // Load default settings with logo from tenant
  const defaultSettings = useMemo((): Partial<DeliveryNoteDefaultSettings> => {
    return {
      template: {
        ...DEFAULT_DELIVERY_NOTE_TEMPLATE,
        logoUrl: logoUrl || DEFAULT_DELIVERY_NOTE_TEMPLATE.logoUrl,
      },
      fromDetails,
      paymentDetails,
    };
  }, [fromDetails, paymentDetails, logoUrl]);

  return {
    defaultSettings,
    isLoading,
  };
}
