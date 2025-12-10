import { errorResponse } from "@crm/utils";
import { cache } from "../cache/redis";
import { hasCompanyAccess } from "../db/queries/companies-members";
import { logger } from "../lib/logger";
import type { AuthContext } from "./auth";

// ============================================
// Company Permission Middleware
// ============================================

/**
 * Cache key for company permissions
 */
function getCompanyPermissionCacheKey(userId: string, companyId: string): string {
  return `user:${userId}:company:${companyId}`;
}

/**
 * Get company permission from cache or database
 */
async function getCompanyPermission(userId: string, companyId: string): Promise<boolean> {
  const cacheKey = getCompanyPermissionCacheKey(userId, companyId);

  // Try cache first
  const cached = await cache.get<boolean>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  // If not in cache, check database
  const hasAccess = await hasCompanyAccess(companyId, userId);

  // Cache the result (5 minutes TTL)
  await cache.set(cacheKey, hasAccess, 300);

  return hasAccess;
}

/**
 * Invalidate company permission cache
 */
export async function invalidateCompanyPermissionCache(
  userId: string,
  companyId?: string
): Promise<void> {
  if (companyId) {
    const cacheKey = getCompanyPermissionCacheKey(userId, companyId);
    await cache.del(cacheKey);
  } else {
    // Invalidate all company permissions for this user
    const pattern = `user:${userId}:company:*`;
    await cache.invalidatePattern(pattern);
  }
}

/**
 * Middleware to verify user has access to a company
 * Extracts companyId from URL params or request body
 */
export async function withCompanyPermission<T>(
  request: Request,
  auth: AuthContext,
  handler: (auth: AuthContext & { companyId: string }) => Promise<T>
): Promise<T> {
  // Try to get companyId from URL params first
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/");
  const companyIdIndex = pathParts.indexOf("companies");

  let companyId: string | null = null;

  // Check if companyId is in the path (e.g., /api/v1/companies/:id/...)
  if (companyIdIndex !== -1 && pathParts[companyIdIndex + 1]) {
    const potentialId = pathParts[companyIdIndex + 1];
    // Validate it's a UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(potentialId)) {
      companyId = potentialId;
    }
  }

  // If not in URL, try request body (for POST/PUT requests)
  if (!companyId && ["POST", "PUT", "PATCH"].includes(request.method)) {
    try {
      const body = await request.clone().json();
      const b = body as Record<string, unknown>;
      if (typeof b.companyId === "string") {
        companyId = b.companyId as string;
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  if (!companyId) {
    throw new Error("Company ID is required");
  }

  // Check permission
  const hasAccess = await getCompanyPermission(auth.userId, companyId);
  if (!hasAccess) {
    logger.warn(
      { userId: auth.userId, companyId },
      "User attempted to access company without permission"
    );
    throw new Error("FORBIDDEN: Not a member of this company");
  }

  return handler({
    ...auth,
    companyId,
  });
}

/**
 * Helper to check company permission and return error response if denied
 */
export async function checkCompanyPermission(
  userId: string,
  companyId: string
): Promise<{ allowed: boolean; error?: Response }> {
  const hasAccess = await getCompanyPermission(userId, companyId);

  if (!hasAccess) {
    return {
      allowed: false,
      error: new Response(
        JSON.stringify(errorResponse("FORBIDDEN", "Not a member of this company")),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      ),
    };
  }

  return { allowed: true };
}
