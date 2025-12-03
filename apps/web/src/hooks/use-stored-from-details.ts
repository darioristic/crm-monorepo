import { useMemo } from "react";
import type { EditorDoc } from "@/types/invoice";
import { STORAGE_KEYS } from "@/constants/storage-keys";

/**
 * Hook to get stored fromDetails from localStorage
 * Returns null if not found or on server-side
 */
export function useStoredFromDetails(): EditorDoc | null {
  return useMemo(() => {
    if (typeof window === "undefined") return null;

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.INVOICE_FROM_DETAILS);
      if (!stored) return null;

      const parsed = JSON.parse(stored);
      // Validate EditorDoc structure
      if (
        parsed &&
        typeof parsed === "object" &&
        parsed.type === "doc" &&
        Array.isArray(parsed.content)
      ) {
        return parsed as EditorDoc;
      }
      return null;
    } catch (error) {
      console.error(
        "Failed to load from details from localStorage:",
        error
      );
      return null;
    }
  }, []);
}

/**
 * Utility function to get stored fromDetails (for use outside React components)
 */
export function getStoredFromDetails(): EditorDoc | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEYS.INVOICE_FROM_DETAILS);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    // Validate EditorDoc structure
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.type === "doc" &&
      Array.isArray(parsed.content)
    ) {
      return parsed as EditorDoc;
    }
    return null;
  } catch (error) {
    console.error("Failed to load from details from localStorage:", error);
    return null;
  }
}

