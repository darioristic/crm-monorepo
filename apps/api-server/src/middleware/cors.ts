import { env } from "../config/env";
import { logger } from "../lib/logger";

export interface CorsConfig {
  origins: string[];
  methods: string[];
  headers: string[];
  credentials: boolean;
  maxAge: number;
}

/**
 * Get CORS configuration based on environment
 */
export function getCorsConfig(): CorsConfig {
  const { NODE_ENV, CORS_ORIGINS, CORS_CREDENTIALS, CORS_MAX_AGE } = env;

  // Default origins based on environment
  const defaultOrigins: Record<string, string[]> = {
    development: ["http://localhost:3000", "http://127.0.0.1:3000"],
    staging: [],
    production: [],
    test: ["http://localhost:3000"],
  };

  // Parse custom origins from env or use defaults
  const customOrigins = CORS_ORIGINS
    ? CORS_ORIGINS.split(",")
        .map((o) => o.trim())
        .filter(Boolean)
    : [];

  const origins = [...(defaultOrigins[NODE_ENV] || []), ...customOrigins];

  return {
    origins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    headers: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: CORS_CREDENTIALS,
    maxAge: CORS_MAX_AGE,
  };
}

/**
 * Build CORS headers for a given origin
 */
export function buildCorsHeaders(
  requestOrigin: string | null,
  config: CorsConfig
): Record<string, string> {
  const { origins, methods, headers, credentials, maxAge } = config;

  // Determine allowed origin
  const allowOrigin = (() => {
    if (requestOrigin) {
      if (origins.length === 0) {
        return requestOrigin;
      }
      if (origins.includes(requestOrigin)) {
        return requestOrigin;
      }
    }
    return origins[0] || "";
  })();

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": methods.join(", "),
    "Access-Control-Allow-Headers": headers.join(", "),
    "Access-Control-Allow-Credentials": credentials.toString(),
    "Access-Control-Max-Age": maxAge.toString(),
  };
}

/**
 * Handle preflight OPTIONS request
 */
export function handlePreflight(corsHeaders: Record<string, string>): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * Apply CORS headers to an existing response
 */
export function applyCorsHeaders(
  response: Response,
  corsHeaders: Record<string, string>
): Response {
  try {
    const headers = new Headers(response.headers);

    for (const [key, value] of Object.entries(corsHeaders)) {
      headers.set(key, value);
    }

    headers.set("Vary", [headers.get("Vary"), "Origin"].filter(Boolean).join(", "));
    headers.set(
      "Access-Control-Expose-Headers",
      "Content-Type, Authorization, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset"
    );

    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    // If there's an error applying CORS headers, return the original response
    // This prevents breaking the entire request
    logger.error({ error }, "Error applying CORS headers");
    return response;
  }
}

/**
 * Check if origin is allowed
 */
export function isOriginAllowed(origin: string | null, config: CorsConfig): boolean {
  if (!origin) return false;
  return config.origins.includes(origin);
}
