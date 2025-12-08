"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console in development
    logger.error("Global error:", error);

    // Capture error in Sentry
    import("@/lib/sentry").then(({ captureException }) => {
      captureException(error, { context: "global_error_boundary" });
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-background antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center px-4">
          <div className="w-full max-w-md space-y-6 text-center">
            <div className="space-y-2">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
                <svg
                  className="h-10 w-10 text-destructive"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
              <p className="text-muted-foreground">
                A critical error occurred. Please try refreshing the page.
              </p>
              {error.digest && (
                <p className="text-xs text-muted-foreground">Error ID: {error.digest}</p>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                onClick={reset}
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Try again
              </button>
              <button
                onClick={() => (window.location.href = "/")}
                className="inline-flex h-10 items-center justify-center rounded-md border bg-background px-6 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Go to homepage
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
