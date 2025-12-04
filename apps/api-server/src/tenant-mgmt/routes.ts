import { successResponse, errorResponse } from "@crm/utils";
import { RouteBuilder, json } from "../routes/helpers";
import { getTenantDb } from "./db/client";
import { tmTenants, tmTenantSettings } from "./db/schema";
import { requireTenantMgmtAuth, requireRole, generateTenantMgmtApiKey } from "./auth";
import { eq } from "drizzle-orm";
import { tmApiKeys } from "./db/schema";

const router = new RouteBuilder();

router.post(
  "/api/tenant-mgmt/tenants",
  requireRole(["admin", "manager"])(async (_auth, request) => {
    try {
      const body = (await request.json()) as {
        name: string;
        pib?: string;
        street?: string;
        city?: string;
        postalCode?: string;
        country?: string;
        contactEmail?: string;
        contactPhone?: string;
        uniqueCode?: string;
        settings?: Record<string, unknown>;
      };
      if (!body || !body.name) {
        return json(errorResponse("VALIDATION_ERROR", "Naziv je obavezan"), 400);
      }

      const db = getTenantDb();
      const uniqueCode = body.uniqueCode || `TEN-${Math.random().toString(36).slice(2, 10)}`;
      const [created] = await db
        .insert(tmTenants)
        .values({
          name: body.name,
          pib: body.pib,
          street: body.street,
          city: body.city,
          postalCode: body.postalCode,
          country: body.country,
          contactEmail: body.contactEmail,
          contactPhone: body.contactPhone,
          uniqueCode,
        })
        .returning();

      if (body.settings) {
        await db
          .insert(tmTenantSettings)
          .values({ tenantId: created.id, config: body.settings })
          .returning();
      }

      return json(successResponse(created), 201);
    } catch (error) {
      return json(errorResponse("INTERNAL_ERROR", "Greška pri kreiranju"), 500);
    }
  }),
);

// Get tenant by ID
router.get(
  "/api/tenant-mgmt/tenants/:id",
  requireTenantMgmtAuth(async (_auth, _request, _url, params) => {
    try {
      const db = getTenantDb();
      const rows = await db.select().from(tmTenants).where(eq(tmTenants.id, params.id)).limit(1);
      if (rows.length === 0) {
        return json(errorResponse("NOT_FOUND", "Tenant nije pronađen"), 404);
      }
      return json(successResponse(rows[0]));
    } catch (error) {
      return json(errorResponse("INTERNAL_ERROR", "Greška pri dohvatu"), 500);
    }
  }),
);

router.get(
  "/api/tenant-mgmt/tenants",
  requireTenantMgmtAuth(async (_auth, request, url) => {
    try {
      const db = getTenantDb();
      const status = url.searchParams.get("status") || undefined;
      const name = url.searchParams.get("name") || undefined;
      let rows = await db.select().from(tmTenants);
      if (status) {
        rows = rows.filter((r) => r.status === status);
      }
      if (name) {
        const n = name.toLowerCase();
        rows = rows.filter((r) => (r.name || "").toLowerCase().includes(n));
      }
      return json(successResponse(rows));
    } catch (error) {
      return json(errorResponse("INTERNAL_ERROR", "Greška pri listanju"), 500);
    }
  }),
);

// =============================
// API Keys Management
// =============================

// List keys
router.get(
  "/api/tenant-mgmt/api-keys",
  requireRole(["admin"])(async (_auth) => {
    try {
      const db = getTenantDb();
      const rows = await db.select().from(tmApiKeys);
      return json(successResponse(rows));
    } catch (error) {
      return json(errorResponse("INTERNAL_ERROR", "Greška pri listanju ključeva"), 500);
    }
  }),
);

// Create key
router.post(
  "/api/tenant-mgmt/api-keys",
  requireRole(["admin"])(async (_auth, request) => {
    try {
      const body = (await request.json()) as { name: string; role?: "admin" | "manager" | "viewer" };
      if (!body?.name) {
        return json(errorResponse("VALIDATION_ERROR", "Naziv je obavezan"), 400);
      }
      const rawKey = await generateTenantMgmtApiKey(body.name, body.role || "admin");
      return json(successResponse({ apiKey: rawKey }), 201);
    } catch (error) {
      return json(errorResponse("INTERNAL_ERROR", "Greška pri kreiranju ključa"), 500);
    }
  }),
);

// Revoke key
router.delete(
  "/api/tenant-mgmt/api-keys/:id",
  requireRole(["admin"])(async (_auth, _request, _url, params) => {
    try {
      const db = getTenantDb();
      const [updated] = await db
        .update(tmApiKeys)
        .set({ revokedAt: new Date() })
        .where(eq(tmApiKeys.id, params.id))
        .returning();
      if (!updated) {
        return json(errorResponse("NOT_FOUND", "API ključ nije pronađen"), 404);
      }
      return json(successResponse({ id: updated.id, revokedAt: updated.revokedAt }));
    } catch (error) {
      return json(errorResponse("INTERNAL_ERROR", "Greška pri opozivu ključa"), 500);
    }
  }),
);

router.patch(
  "/api/tenant-mgmt/tenants/:id",
  requireRole(["admin", "manager"])(async (_auth, request, _url, params) => {
    try {
      const body = (await request.json()) as Partial<{
        name: string;
        pib: string;
        street: string;
        city: string;
        postalCode: string;
        country: string;
        contactEmail: string;
        contactPhone: string;
        uniqueCode: string;
      }>;
      const db = getTenantDb();
      const [updated] = await db
        .update(tmTenants)
        .set({
          ...body,
          updatedAt: new Date(),
        })
        .where(eq(tmTenants.id, params.id))
        .returning();
      if (!updated) {
        return json(errorResponse("NOT_FOUND", "Tenant nije pronađen"), 404);
      }
      return json(successResponse(updated));
    } catch (error) {
      return json(errorResponse("INTERNAL_ERROR", "Greška pri ažuriranju"), 500);
    }
  }),
);

router.post(
  "/api/tenant-mgmt/tenants/:id/activate",
  requireRole(["admin"])(async (_auth, _request, _url, params) => {
    try {
      const db = getTenantDb();
      const [updated] = await db
        .update(tmTenants)
        .set({ status: "active", updatedAt: new Date(), deletedAt: null })
        .where(eq(tmTenants.id, params.id))
        .returning();
      if (!updated) return json(errorResponse("NOT_FOUND", "Tenant nije pronađen"), 404);
      return json(successResponse(updated));
    } catch (error) {
      return json(errorResponse("INTERNAL_ERROR", "Greška pri aktivaciji"), 500);
    }
  }),
);

router.post(
  "/api/tenant-mgmt/tenants/:id/deactivate",
  requireRole(["admin"])(async (_auth, _request, _url, params) => {
    try {
      const db = getTenantDb();
      const [updated] = await db
        .update(tmTenants)
        .set({ status: "inactive", updatedAt: new Date() })
        .where(eq(tmTenants.id, params.id))
        .returning();
      if (!updated) return json(errorResponse("NOT_FOUND", "Tenant nije pronađen"), 404);
      return json(successResponse(updated));
    } catch (error) {
      return json(errorResponse("INTERNAL_ERROR", "Greška pri deaktivaciji"), 500);
    }
  }),
);

router.delete(
  "/api/tenant-mgmt/tenants/:id",
  requireRole(["admin"])(async (_auth, _request, url, params) => {
    try {
      const confirm = url.searchParams.get("confirm") === "true";
      if (!confirm) {
        return json(
          errorResponse("VALIDATION_ERROR", "Potvrda brisanja je obavezna (?confirm=true)"),
          400,
        );
      }
      const db = getTenantDb();
      const [updated] = await db
        .update(tmTenants)
        .set({ status: "deleted", deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(tmTenants.id, params.id))
        .returning();
      if (!updated) return json(errorResponse("NOT_FOUND", "Tenant nije pronađen"), 404);
      return json(successResponse({ id: updated.id, status: updated.status }));
    } catch (error) {
      return json(errorResponse("INTERNAL_ERROR", "Greška pri brisanju"), 500);
    }
  }),
);

router.get(
  "/api/tenant-mgmt/tenants/:id/settings",
  requireTenantMgmtAuth(async (_auth, _request, _url, params) => {
    try {
      const db = getTenantDb();
      const rows = await db
        .select()
        .from(tmTenantSettings)
        .where(eq(tmTenantSettings.tenantId, params.id))
        .limit(1);
      return json(successResponse(rows[0] || null));
    } catch (error) {
      return json(errorResponse("INTERNAL_ERROR", "Greška pri dohvatu podešavanja"), 500);
    }
  }),
);

router.put(
  "/api/tenant-mgmt/tenants/:id/settings",
  requireRole(["admin", "manager"])(async (_auth, request, _url, params) => {
    try {
      const body = (await request.json()) as Partial<{
        config: Record<string, unknown>;
        permissions: Record<string, unknown>;
        personalization: Record<string, unknown>;
      }>;
      const db = getTenantDb();
      const existing = await db
        .select()
        .from(tmTenantSettings)
        .where(eq(tmTenantSettings.tenantId, params.id))
        .limit(1);

      if (existing.length === 0) {
        const [created] = await db
          .insert(tmTenantSettings)
          .values({
            tenantId: params.id,
            config: body.config,
            permissions: body.permissions,
            personalization: body.personalization,
          })
          .returning();
        return json(successResponse(created));
      }

      const [updated] = await db
        .update(tmTenantSettings)
        .set({
          ...existing[0],
          ...body,
          updatedAt: new Date(),
        })
        .where(eq(tmTenantSettings.id, existing[0].id))
        .returning();
      return json(successResponse(updated));
    } catch (error) {
      return json(errorResponse("INTERNAL_ERROR", "Greška pri ažuriranju podešavanja"), 500);
    }
  }),
);

export const tenantMgmtRoutes = router.getRoutes();
