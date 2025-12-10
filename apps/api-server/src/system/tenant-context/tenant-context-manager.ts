import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { tenants } from "../../db/schema/index";
import { logger } from "../../lib/logger";
import type { TenantContext } from "./types";

export class TenantContextManager {
  async getTenantById(tenantId: string): Promise<TenantContext | null> {
    try {
      const tenant = await db
        .select({
          id: tenants.id,
          status: tenants.status,
        })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      if (tenant.length === 0) {
        return null;
      }

      const t = tenant[0];

      // Check if tenant is deleted
      if (t.status === "deleted") {
        return null;
      }

      return {
        tenantId: t.id,
        tenantStatus: t.status as "active" | "suspended" | "deleted",
      };
    } catch (error) {
      logger.error({ error, tenantId }, "Failed to get tenant context");
      return null;
    }
  }

  async validateTenantAccess(tenantId: string): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    const context = await this.getTenantById(tenantId);

    if (!context) {
      return {
        allowed: false,
        reason: "Tenant not found or deleted",
      };
    }

    if (context.tenantStatus === "suspended") {
      return {
        allowed: false,
        reason: "Tenant is suspended",
      };
    }

    if (context.tenantStatus === "deleted") {
      return {
        allowed: false,
        reason: "Tenant is deleted",
      };
    }

    return {
      allowed: true,
    };
  }

  isTenantActive(context: TenantContext): boolean {
    return context.tenantStatus === "active";
  }
}

export const tenantContextManager = new TenantContextManager();
