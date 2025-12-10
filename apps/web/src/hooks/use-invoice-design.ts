"use client";

import { useCallback, useEffect, useState } from "react";
import type { InvoiceDesign } from "@/components/invoice/designs";

const STORAGE_KEY = "invoice-design";
const DEFAULT_DESIGN: InvoiceDesign = "midday";

export function useInvoiceDesign() {
  const [design, setDesignState] = useState<InvoiceDesign>(DEFAULT_DESIGN);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isValidDesign(stored)) {
      setDesignState(stored as InvoiceDesign);
    }
    setIsLoaded(true);
  }, []);

  const setDesign = useCallback((newDesign: InvoiceDesign) => {
    setDesignState(newDesign);
    localStorage.setItem(STORAGE_KEY, newDesign);
  }, []);

  return { design, setDesign, isLoaded };
}

function isValidDesign(value: string): value is InvoiceDesign {
  return ["midday"].includes(value);
}
