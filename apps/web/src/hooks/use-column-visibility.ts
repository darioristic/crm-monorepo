"use client";

import type { VisibilityState } from "@tanstack/react-table";
import { useCallback, useEffect, useState } from "react";

const STORAGE_PREFIX = "crm-column-visibility-";

type UseColumnVisibilityOptions = {
  tableKey: string;
  defaultVisibility?: VisibilityState;
};

export function useColumnVisibility({
  tableKey,
  defaultVisibility = {},
}: UseColumnVisibilityOptions) {
  const storageKey = `${STORAGE_PREFIX}${tableKey}`;

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window === "undefined") return defaultVisibility;

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        return JSON.parse(stored) as VisibilityState;
      }
    } catch {
      // Ignore parsing errors
    }
    return defaultVisibility;
  });

  // Persist to localStorage when visibility changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(storageKey, JSON.stringify(columnVisibility));
    } catch {
      // Ignore storage errors
    }
  }, [columnVisibility, storageKey]);

  const updateColumnVisibility = useCallback(
    (columnId: string, isVisible: boolean) => {
      setColumnVisibility((prev) => ({
        ...prev,
        [columnId]: isVisible,
      }));
    },
    []
  );

  const resetVisibility = useCallback(() => {
    setColumnVisibility(defaultVisibility);
  }, [defaultVisibility]);

  return {
    columnVisibility,
    setColumnVisibility,
    updateColumnVisibility,
    resetVisibility,
  };
}
