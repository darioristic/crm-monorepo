/**
 * Centralized logging utility for the CRM application
 *
 * Features:
 * - Environment-aware (only logs in development by default)
 * - Type-safe logging levels
 * - Structured logging support
 * - Easy to integrate with external logging services (Sentry, etc.)
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isEnabled: boolean;

  constructor() {
    // Enable logging only when explicitly enabled via env flag
    this.isEnabled = process.env.NEXT_PUBLIC_ENABLE_LOGGING === "true";
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    let contextStr = "";

    if (context) {
      try {
        contextStr = ` ${JSON.stringify(context, this.getSafeReplacer())}`;
      } catch (_e) {
        contextStr = " [Unable to stringify context]";
      }
    }

    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  private getSafeReplacer() {
    const seen = new WeakSet();
    return (key: string, value: unknown) => {
      // Handle DOM elements
      if (typeof window !== "undefined" && value instanceof Element) {
        return `[DOM Element: ${value.tagName}]`;
      }

      // Handle React internals
      if (key.startsWith("__react")) {
        return undefined;
      }

      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          return "[Circular]";
        }
        seen.add(value);
      }
      return value;
    };
  }

  private shouldLog(level: LogLevel): boolean {
    // Always log errors
    if (level === "error") return true;
    // Log other levels only if enabled
    return this.isEnabled;
  }

  debug(_message: string, _context?: LogContext): void {
    if (this.shouldLog("debug")) {
    }
  }

  info(_message: string, _context?: LogContext): void {
    if (this.shouldLog("info")) {
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog("warn")) {
      console.warn(this.formatMessage("warn", message, context));
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext =
      error instanceof Error
        ? { ...context, error: error.message, stack: error.stack }
        : { ...context, error };

    const isClient = typeof window !== "undefined";
    const canConsoleLog = !isClient || this.isEnabled;

    if (canConsoleLog) {
      console.error(this.formatMessage("error", message, errorContext));
    }

    // Send to error tracking service (Sentry) on client
    if (isClient) {
      import("./sentry")
        .then(({ captureException }) => {
          captureException(error instanceof Error ? error : new Error(String(error)), context);
        })
        .catch(() => {
          // Silently fail if Sentry import fails
        });
    }
  }

  // Group logging for related messages
  group(_label: string, callback: () => void): void {
    if (this.isEnabled) {
      callback();
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export type for external use
export type { LogLevel, LogContext };
