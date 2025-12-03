/**
 * Centralized logging utility for the CRM application
 *
 * Features:
 * - Environment-aware (only logs in development by default)
 * - Type-safe logging levels
 * - Structured logging support
 * - Easy to integrate with external logging services (Sentry, etc.)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment: boolean;
  private isEnabled: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    // Enable logging in development or when explicitly enabled
    this.isEnabled = this.isDevelopment || process.env.NEXT_PUBLIC_ENABLE_LOGGING === 'true';
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  private shouldLog(level: LogLevel): boolean {
    // Always log errors
    if (level === 'error') return true;
    // Log other levels only if enabled
    return this.isEnabled;
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, context));
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.shouldLog('error')) {
      const errorContext = error instanceof Error
        ? { ...context, error: error.message, stack: error.stack }
        : { ...context, error };

      console.error(this.formatMessage('error', message, errorContext));

      // Send to error tracking service (Sentry)
      if (typeof window !== 'undefined') {
        import('./sentry').then(({ captureException }) => {
          captureException(error instanceof Error ? error : new Error(String(error)), context);
        }).catch(() => {
          // Silently fail if Sentry import fails
        });
      }
    }
  }

  // Group logging for related messages
  group(label: string, callback: () => void): void {
    if (this.isEnabled) {
      console.group(label);
      callback();
      console.groupEnd();
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export type for external use
export type { LogLevel, LogContext };
