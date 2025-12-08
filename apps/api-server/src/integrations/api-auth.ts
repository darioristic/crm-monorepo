import { errorResponse } from "@crm/utils";
import { cache } from "../cache/redis";
import { logger } from "../lib/logger";

// ============================================
// API Key Types
// ============================================

export interface ApiKeyData {
  userId: string;
  name: string;
  scopes: ApiScope[];
  createdAt: string;
  expiresAt?: string;
  rateLimit?: {
    requests: number;
    windowSeconds: number;
  };
}

export type ApiScope =
  | "read:companies"
  | "write:companies"
  | "read:users"
  | "write:users"
  | "read:quotes"
  | "write:quotes"
  | "read:invoices"
  | "write:invoices"
  | "read:projects"
  | "write:projects"
  | "read:tasks"
  | "write:tasks"
  | "read:reports"
  | "admin";

// ============================================
// Rate Limit Configuration
// ============================================

interface RateLimitConfig {
  requests: number;
  windowSeconds: number;
}

const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  default: { requests: 100, windowSeconds: 60 }, // 100 req/min
  authenticated: { requests: 1000, windowSeconds: 60 }, // 1000 req/min
  premium: { requests: 5000, windowSeconds: 60 }, // 5000 req/min
};

// ============================================
// Authentication Middleware
// ============================================

export interface AuthResult {
  authenticated: boolean;
  apiKey?: ApiKeyData;
  error?: string;
  statusCode?: number;
}

export async function authenticateApiKey(request: Request): Promise<AuthResult> {
  // Get API key from header
  const authHeader = request.headers.get("Authorization");
  const apiKeyHeader = request.headers.get("X-API-Key");

  let apiKey: string | null = null;

  // Support both Bearer token and X-API-Key header
  if (authHeader?.startsWith("Bearer ")) {
    apiKey = authHeader.substring(7);
  } else if (apiKeyHeader) {
    apiKey = apiKeyHeader;
  }

  if (!apiKey) {
    return {
      authenticated: false,
      error: "API key required. Provide via Authorization: Bearer <key> or X-API-Key header",
      statusCode: 401,
    };
  }

  // Validate API key format (should be prefixed)
  if (!apiKey.startsWith("crm_")) {
    return {
      authenticated: false,
      error: "Invalid API key format",
      statusCode: 401,
    };
  }

  // Look up API key in Redis
  const keyData = await cache.getApiKey(apiKey);

  if (!keyData) {
    return {
      authenticated: false,
      error: "Invalid or expired API key",
      statusCode: 401,
    };
  }

  // Check expiration
  if (keyData.expiresAt && new Date(keyData.expiresAt) < new Date()) {
    return {
      authenticated: false,
      error: "API key has expired",
      statusCode: 401,
    };
  }

  // Cast scopes to ApiScope[] (they're stored as strings in Redis)
  const apiKeyData: ApiKeyData = {
    ...keyData,
    scopes: keyData.scopes as ApiScope[],
  };

  return {
    authenticated: true,
    apiKey: apiKeyData,
  };
}

// ============================================
// Authorization (Scope Checking)
// ============================================

export function hasScope(apiKey: ApiKeyData, requiredScope: ApiScope): boolean {
  // Admin scope has access to everything
  if (apiKey.scopes.includes("admin")) {
    return true;
  }
  return apiKey.scopes.includes(requiredScope);
}

export function hasAnyScope(apiKey: ApiKeyData, scopes: ApiScope[]): boolean {
  if (apiKey.scopes.includes("admin")) {
    return true;
  }
  return scopes.some((scope) => apiKey.scopes.includes(scope));
}

export function requireScope(apiKey: ApiKeyData, scope: ApiScope): AuthResult {
  if (!hasScope(apiKey, scope)) {
    return {
      authenticated: true,
      apiKey,
      error: `Missing required scope: ${scope}`,
      statusCode: 403,
    };
  }
  return { authenticated: true, apiKey };
}

// ============================================
// Rate Limiting Middleware
// ============================================

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
  limit: number;
}

export async function checkRateLimit(
  identifier: string,
  config?: RateLimitConfig
): Promise<RateLimitResult> {
  const { requests, windowSeconds } = config || DEFAULT_RATE_LIMITS.default;

  const result = await cache.checkRateLimit(identifier, requests, windowSeconds);

  return {
    allowed: result.allowed,
    remaining: result.remaining,
    resetIn: result.resetIn,
    limit: requests,
  };
}

export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(Date.now() / 1000) + result.resetIn),
  };
}

// ============================================
// API Key Management
// ============================================

export async function generateApiKey(
  userId: string,
  name: string,
  scopes: ApiScope[],
  expiresInDays?: number
): Promise<string> {
  // Generate a secure API key
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const keyPart = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const apiKey = `crm_${keyPart}`;

  const keyData: ApiKeyData = {
    userId,
    name,
    scopes,
    createdAt: new Date().toISOString(),
    expiresAt: expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined,
  };

  await cache.storeApiKey(apiKey, keyData);

  return apiKey;
}

export async function revokeApiKey(apiKey: string): Promise<boolean> {
  const keyData = await cache.getApiKey(apiKey);
  if (!keyData) {
    return false;
  }

  await cache.revokeApiKey(apiKey, keyData.userId);
  return true;
}

export async function listUserApiKeys(
  userId: string
): Promise<Record<string, { name: string; createdAt: string }>> {
  return cache.getUserApiKeys(userId);
}

// ============================================
// Request Logging
// ============================================

interface ApiRequestLog {
  timestamp: string;
  method: string;
  path: string;
  apiKeyName?: string;
  userId?: string;
  statusCode: number;
  responseTimeMs: number;
  ip?: string;
  userAgent?: string;
}

export async function logApiRequest(log: ApiRequestLog): Promise<void> {
  try {
    // Store in Redis sorted set for recent requests
    const key = `api:logs:${new Date().toISOString().split("T")[0]}`; // Daily logs
    await cache.set(`${key}:${Date.now()}`, log, 86400 * 7); // Keep 7 days

    // Also log to console in development
    if (process.env.NODE_ENV !== "production") {
      logger.info(`📊 API ${log.method} ${log.path} - ${log.statusCode} (${log.responseTimeMs}ms)`);
    }
  } catch (error) {
    logger.error("Failed to log API request:", error);
  }
}

// ============================================
// Response Helpers
// ============================================

export function apiErrorResponse(code: string, message: string, statusCode: number): Response {
  return new Response(JSON.stringify(errorResponse(code, message)), {
    status: statusCode,
    headers: { "Content-Type": "application/json" },
  });
}

export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify(errorResponse("RATE_LIMITED", "Too many requests. Please try again later.")),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        ...getRateLimitHeaders(result),
        "Retry-After": String(result.resetIn),
      },
    }
  );
}
