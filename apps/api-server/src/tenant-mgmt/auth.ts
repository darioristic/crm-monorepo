import { createHash, randomBytes } from "node:crypto";
import { errorResponse } from "@crm/utils";
import { eq } from "drizzle-orm";
import { json } from "../routes/helpers";
import { getTenantDb } from "./db/client";
import { tmApiKeys } from "./db/schema";

export interface TmAuthContext {
  principalId: string;
  role: "admin" | "manager" | "viewer";
}

function hashApiKey(raw: string): string {
  const salt = process.env.TENANT_MGMT_API_SALT || "default_salt";
  return createHash("sha256").update(`${raw}:${salt}`).digest("hex");
}

export async function generateTenantMgmtApiKey(
  name: string,
  role: TmAuthContext["role"] = "admin"
) {
  const db = getTenantDb();
  const rawKey = randomBytes(32).toString("hex");
  const keyHash = hashApiKey(rawKey);
  await db.insert(tmApiKeys).values({ name, keyHash, role }).returning();
  return rawKey;
}

export function requireTenantMgmtAuth<_T>(
  handler: (
    auth: TmAuthContext,
    request: Request,
    url: URL,
    params: Record<string, string>
  ) => Promise<Response>
) {
  return async (request: Request, url: URL, params: Record<string, string>): Promise<Response> => {
    try {
      const apiKey = request.headers.get("X-Tenant-API-Key") || undefined;
      if (!apiKey) {
        return json(errorResponse("UNAUTHORIZED", "Nedostaje X-Tenant-API-Key header"), 401);
      }

      const db = getTenantDb();
      const keyHash = hashApiKey(apiKey);
      const rows = await db.select().from(tmApiKeys).where(eq(tmApiKeys.keyHash, keyHash)).limit(1);

      if (rows.length === 0 || rows[0].revokedAt) {
        return json(errorResponse("UNAUTHORIZED", "Neispravan ili opozvan API ključ"), 401);
      }

      const auth: TmAuthContext = {
        principalId: rows[0].id,
        role: rows[0].role as TmAuthContext["role"],
      };

      return handler(auth, request, url, params);
    } catch (_error) {
      return json(errorResponse("INTERNAL_ERROR", "Greška pri autentikaciji"), 500);
    }
  };
}

export function requireRole(roles: TmAuthContext["role"][]) {
  return <_T>(
    handler: (
      auth: TmAuthContext,
      request: Request,
      url: URL,
      params: Record<string, string>
    ) => Promise<Response>
  ) =>
    async (request: Request, url: URL, params: Record<string, string>): Promise<Response> => {
      const apiKey = request.headers.get("X-Tenant-API-Key") || undefined;
      if (!apiKey) {
        return json(errorResponse("UNAUTHORIZED", "Nedostaje X-Tenant-API-Key header"), 401);
      }
      const db = getTenantDb();
      const keyHash = hashApiKey(apiKey);
      const rows = await db.select().from(tmApiKeys).where(eq(tmApiKeys.keyHash, keyHash)).limit(1);
      if (rows.length === 0 || rows[0].revokedAt) {
        return json(errorResponse("UNAUTHORIZED", "Neispravan ili opozvan API ključ"), 401);
      }
      if (!roles.includes(rows[0].role as TmAuthContext["role"])) {
        return json(errorResponse("FORBIDDEN", "Nedovoljne privilegije"), 403);
      }
      const auth: TmAuthContext = {
        principalId: rows[0].id,
        role: rows[0].role as TmAuthContext["role"],
      };
      return handler(auth, request, url, params);
    };
}
