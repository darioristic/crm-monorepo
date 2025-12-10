import type { ApiResponse } from "@crm/types";
import { errorResponse, generateUUID, successResponse } from "@crm/utils";
import { eq } from "drizzle-orm";
import { cache } from "../../cache/redis";
import { db } from "../../db/client";
import { locations, tenants, users, userTenantRoles } from "../../db/schema/index";
import { Location } from "../../domains/location/domain/location.entity";
import { Tenant } from "../../domains/tenant/domain/tenant.entity";
import { logger } from "../../lib/logger";
import { authService } from "../../services/auth.service";
import type { ProvisioningRequest, ProvisioningResult, ProvisioningStatus } from "./types";

const PROVISIONING_STATUS_KEY_PREFIX = "provisioning:status:";
const PROVISIONING_STATUS_TTL = 3600; // 1 hour

export class ProvisioningService {
  /**
   * Main provisioning workflow
   */
  async provision(request: ProvisioningRequest): Promise<ApiResponse<ProvisioningResult>> {
    const tenantId = generateUUID();
    const _statusKey = `${PROVISIONING_STATUS_KEY_PREFIX}${tenantId}`;

    try {
      // Check if tenant with this slug already exists (idempotency)
      const existingTenant = await db
        .select()
        .from(tenants)
        .where(eq(tenants.slug, request.slug))
        .limit(1);

      if (existingTenant.length > 0) {
        return errorResponse("CONFLICT", `Tenant with slug "${request.slug}" already exists`);
      }

      // Update status: pending
      await this.updateStatus(tenantId, "pending", "Starting provisioning");

      // Step 1: Create tenant
      await this.updateStatus(tenantId, "in_progress", "Creating tenant");
      const tenant = Tenant.create(request.name, request.slug, request.metadata);
      await db.insert(tenants).values({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        metadata: tenant.metadata,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
        deletedAt: tenant.deletedAt,
      });

      // Step 2: Create default location
      await this.updateStatus(tenantId, "in_progress", "Creating default location");
      const defaultLocation = Location.create(tenant.id, "Default Location", "DEFAULT");
      const [insertedLocation] = await db
        .insert(locations)
        .values({
          id: defaultLocation.id,
          tenantId: defaultLocation.tenantId,
          name: defaultLocation.name,
          code: defaultLocation.code,
          metadata: defaultLocation.metadata,
          createdAt: defaultLocation.createdAt,
          updatedAt: defaultLocation.updatedAt,
        })
        .returning();

      // Step 3: Create initial tenant admin user
      await this.updateStatus(tenantId, "in_progress", "Creating tenant admin user");
      const adminUserResult = await authService.registerUser({
        firstName: request.adminFirstName,
        lastName: request.adminLastName,
        email: request.adminEmail,
        password: request.adminPassword,
        role: "tenant_admin",
      });

      if (!adminUserResult.success || !adminUserResult.data) {
        throw new Error(adminUserResult.error?.message || "Failed to create admin user");
      }

      const adminUser = adminUserResult.data;

      // Update user with tenantId
      await db.update(users).set({ tenantId: tenant.id }).where(eq(users.id, adminUser.id));

      // Step 4: Create user-tenant role relationship
      await this.updateStatus(tenantId, "in_progress", "Setting up user permissions");
      await db.insert(userTenantRoles).values({
        id: generateUUID(),
        userId: adminUser.id,
        tenantId: tenant.id,
        role: "admin",
        permissions: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Step 5: Generate API key (optional - can be done later)
      await this.updateStatus(tenantId, "in_progress", "Generating API key");
      // API key generation can be implemented separately

      // Step 6: Mark as completed
      await this.updateStatus(tenantId, "completed", "Provisioning completed");

      const result: ProvisioningResult = {
        tenantId: tenant.id,
        locationId: insertedLocation.id,
        adminUserId: adminUser.id,
        status: "completed",
      };

      return successResponse(result);
    } catch (error) {
      logger.error({ error, tenantId, request }, "Provisioning failed");
      await this.updateStatus(
        tenantId,
        "failed",
        `Provisioning failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      return errorResponse(
        "SERVER_ERROR",
        error instanceof Error ? error.message : "Provisioning failed"
      );
    }
  }

  /**
   * Get provisioning status
   */
  async getStatus(tenantId: string): Promise<ProvisioningStatus | null> {
    const statusKey = `${PROVISIONING_STATUS_KEY_PREFIX}${tenantId}`;
    const status = await cache.get<ProvisioningStatus>(statusKey);
    return status;
  }

  /**
   * Update provisioning status
   */
  private async updateStatus(
    tenantId: string,
    status: ProvisioningStatus["status"],
    step: string,
    error?: string
  ): Promise<void> {
    const statusKey = `${PROVISIONING_STATUS_KEY_PREFIX}${tenantId}`;
    const now = new Date();

    const statusData: ProvisioningStatus = {
      tenantId,
      status,
      step,
      error,
      createdAt: now,
      updatedAt: now,
    };

    await cache.set(statusKey, statusData, PROVISIONING_STATUS_TTL);
  }

  /**
   * Retry provisioning (idempotent)
   */
  async retryProvisioning(tenantId: string): Promise<ApiResponse<ProvisioningResult>> {
    // Check if tenant exists
    const existingTenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);

    if (existingTenant.length === 0) {
      return errorResponse("NOT_FOUND", "Tenant not found");
    }

    // Check current status
    const currentStatus = await this.getStatus(tenantId);
    if (currentStatus?.status === "completed") {
      return errorResponse("CONFLICT", "Tenant already provisioned");
    }

    // Retry logic would go here
    // For now, we'll just return an error
    return errorResponse("NOT_IMPLEMENTED", "Retry not yet implemented");
  }
}

export const provisioningService = new ProvisioningService();
