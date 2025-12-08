"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

/**
 * Hook for copying text to clipboard with toast notifications
 * Returns a copy function and a copied state that auto-resets after 2 seconds
 */
export function useCopyLink() {
  const [copied, setCopied] = useState(false);

  const copyLink = useCallback(
    async (text: string, successMessage: string = "Link copied to clipboard") => {
      if (!navigator?.clipboard) {
        toast.error("Clipboard not supported");
        return false;
      }

      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success(successMessage);
        setTimeout(() => setCopied(false), 2000);
        return true;
      } catch (error) {
        logger.error("Failed to copy to clipboard:", error);
        toast.error("Failed to copy to clipboard");
        setCopied(false);
        return false;
      }
    },
    []
  );

  return { copyLink, copied };
}
