"use client";

import { useMemo, useEffect } from "react";
import type { QuoteDefaultSettings } from "@/types/quote";
import { DEFAULT_QUOTE_TEMPLATE } from "@/types/quote";
import { extractTextFromEditorDoc, createEditorDocFromText } from "@/types/quote";

// Hook for quote settings - simplified version without store
export function useQuoteSettings() {
  // Load default settings from localStorage
  const loadDefaultSettings = useMemo((): Partial<QuoteDefaultSettings> => {
    if (typeof window === "undefined") {
      return { template: DEFAULT_QUOTE_TEMPLATE };
    }

    try {
      const savedFromDetails = localStorage.getItem("quote_from_details");
      const savedPaymentDetails = localStorage.getItem("quote_payment_details");

      const fromDetails = savedFromDetails
        ? JSON.parse(savedFromDetails)
        : null;

      const paymentDetails = savedPaymentDetails
        ? JSON.parse(savedPaymentDetails)
        : null;

      return {
        template: DEFAULT_QUOTE_TEMPLATE,
        fromDetails,
        paymentDetails,
      };
    } catch {
      return { template: DEFAULT_QUOTE_TEMPLATE };
    }
  }, []);

  return {
    defaultSettings: loadDefaultSettings,
  };
}

