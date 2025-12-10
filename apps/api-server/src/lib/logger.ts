import pino from "pino";

//

// ============================================
// Logger Configuration
// ============================================

const LOG_LEVEL = process.env.LOG_LEVEL || "info";
const _IS_PRODUCTION = process.env.NODE_ENV === "production";

// Create base logger configuration
const loggerConfig: pino.LoggerOptions = {
  level: LOG_LEVEL,
  // Add base fields to all log entries
  base: {
    service: "crm-api",
    version: "1.0.0",
  },
  // Customize timestamp format
  timestamp: pino.stdTimeFunctions.isoTime,
  // Format error objects properly
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      hostname: bindings.hostname,
    }),
  },
};

// Create the logger instance
// In production, use standard JSON output for log aggregation
// In development, we could use pino-pretty but it requires the package to be installed
export const logger = pino(loggerConfig);

// ============================================
// Request Logger - Creates child logger with request context
// ============================================

let requestCounter = 0;

export function createRequestLogger(request: Request): pino.Logger {
  const requestId = `req-${Date.now()}-${++requestCounter}`;
  const url = new URL(request.url);

  return logger.child({
    requestId,
    method: request.method,
    path: url.pathname,
    userAgent: request.headers.get("User-Agent")?.substring(0, 100),
  });
}

// ============================================
// Specialized Loggers
// ============================================

export const dbLogger = logger.child({ module: "database" });
export const cacheLogger = logger.child({ module: "cache" });
export const authLogger = logger.child({ module: "auth" });
export const apiLogger = logger.child({ module: "api" });
export const serviceLogger = logger.child({ module: "service" });
export const jobLogger = logger.child({ module: "jobs" });
export const configLogger = logger.child({ module: "config" });

// ============================================
// Helper Functions
// ============================================

/**
 * Log an HTTP request with timing information
 */
export function logRequest(reqLogger: pino.Logger, statusCode: number, durationMs: number): void {
  const level = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";

  reqLogger[level]({
    statusCode,
    durationMs: Math.round(durationMs * 100) / 100,
    msg: `${statusCode} - ${durationMs.toFixed(2)}ms`,
  });
}

/**
 * Log database queries (use sparingly in production)
 */
export function logQuery(query: string, params?: unknown[], durationMs?: number): void {
  if (LOG_LEVEL === "debug") {
    dbLogger.debug({
      query: query.substring(0, 500),
      params: params?.slice(0, 10),
      durationMs,
    });
  }
}

/**
 * Log security events
 */
export function logSecurityEvent(event: string, details: Record<string, unknown>): void {
  authLogger.warn({
    securityEvent: event,
    ...details,
  });
}

/**
 * Log audit events
 */
export function logAuditEvent(
  action: string,
  userId: string,
  details: Record<string, unknown>
): void {
  logger.info({
    audit: true,
    action,
    userId,
    ...details,
  });
}

export default logger;
