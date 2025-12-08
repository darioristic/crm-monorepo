import * as Sentry from "@sentry/bun";
import { env } from "../config/env";
import { logger } from "../lib/logger";

/**
 * Initialize Sentry for error tracking in production
 */
export function initSentry() {
  if (env.NODE_ENV !== "production") {
    return; // Only initialize Sentry in production
  }

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.warn("SENTRY_DSN not set, error tracking disabled");
    return;
  }

  Sentry.init({
    dsn,
    environment: env.NODE_ENV,
    // Performance monitoring
    tracesSampleRate: 0.1, // 10% of transactions
    // Capture unhandled promise rejections
    // Minimal initialization without explicit integrations to satisfy type constraints
    // Filter out health check requests
    beforeSend(event, _hint) {
      // Don't send events for health check endpoints
      if (event.request?.url?.includes("/health")) {
        return null;
      }
      return event;
    },
  });

  logger.info("✅ Sentry initialized for error tracking");
}

/**
 * Capture an exception and send it to Sentry
 */
export function captureException(error: Error, context?: Record<string, unknown>) {
  if (env.NODE_ENV === "production" && process.env.SENTRY_DSN) {
    Sentry.captureException(error, {
      extra: context,
    });
  }
}

/**
 * Capture a message and send it to Sentry
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = "info",
  context?: Record<string, unknown>
) {
  if (env.NODE_ENV === "production" && process.env.SENTRY_DSN) {
    Sentry.captureMessage(message, {
      level,
      extra: context,
    });
  }
}
