"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";

/**
 * Suppresses the React 19 / Next.js 16 Performance API timing error in development.
 * This error occurs due to a bug in React's profiler when components are measured
 * during hot reloads with Turbopack.
 *
 * Error: "Failed to execute 'measure' on 'Performance': cannot have a negative time stamp"
 *
 * This is a known issue and does not affect production builds.
 * @see https://github.com/vercel/next.js/issues/75190
 */
export function PerformanceErrorSuppressor() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const originalConsoleError = logger.error;

    logger.error = (...args: unknown[]) => {
      const errorMessage = args[0];

      // Suppress the specific Performance API timing error
      if (
        typeof errorMessage === "string" &&
        errorMessage.includes("Failed to execute 'measure' on 'Performance'") &&
        errorMessage.includes("cannot have a negative time stamp")
      ) {
        return; // Suppress this error
      }

      // Pass through all other errors
      originalConsoleError.apply(console, args);
    };

    return () => {
      logger.error = originalConsoleError;
    };
  }, []);

  return null;
}
