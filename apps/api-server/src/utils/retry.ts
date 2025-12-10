/**
 * Retry Utility
 *
 * Provides retry functionality with exponential backoff for AI and network calls.
 */

import { logger } from "../lib/logger";

/**
 * Retry wrapper for calls with exponential backoff
 * Only retries on timeout/network errors, not on other errors
 */
export async function retryCall<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const { maxRetries = 2, baseDelay = 1000, onRetry } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        throw error;
      }

      // Only retry on timeout/network errors, not on other AI errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isRetryableError =
        errorMessage.includes("timeout") ||
        errorMessage.includes("TimeoutError") ||
        errorMessage.includes("aborted") ||
        errorMessage.includes("network") ||
        errorMessage.includes("ECONNRESET") ||
        errorMessage.includes("ETIMEDOUT") ||
        errorMessage.includes("fetch failed");

      if (!isRetryableError) {
        throw error;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * 2 ** attempt + Math.random() * 1000;

      logger.warn(
        {
          attempt: attempt + 1,
          maxAttempts: maxRetries + 1,
          delay: Math.round(delay),
          error: errorMessage,
        },
        "AI call failed, retrying"
      );

      if (onRetry) {
        onRetry(attempt + 1, error instanceof Error ? error : new Error(errorMessage));
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("All retry attempts failed");
}

/**
 * Create a timeout-wrapped promise
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message?: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(message || `Operation timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default { retryCall, withTimeout, sleep };
