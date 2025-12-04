import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { logger } from "../../lib/logger";

let queryClient: postgres.Sql<{}> | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

function ensureEnv(): string {
  const url = process.env.TENANT_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TENANT_DATABASE_URL je obavezan za tenant management modul (npr. postgresql://user:pass@localhost:5433/tenant_db)"
    );
  }
  return url;
}

export function getTenantQueryClient(): postgres.Sql<{}> {
  if (queryClient) return queryClient;
  const DATABASE_URL = ensureEnv();
  queryClient = postgres(DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    transform: { undefined: null },
    debug: process.env.NODE_ENV === "development",
  });
  return queryClient!;
}

export function getTenantDb() {
  if (dbInstance) return dbInstance;
  const client = getTenantQueryClient();
  dbInstance = drizzle(client, { schema });
  return dbInstance!;
}

export async function testTenantConnection(): Promise<boolean> {
  try {
    const client = getTenantQueryClient();
    await client`SELECT 1`;
    logger.info("Tenant management DB connected successfully");
    return true;
  } catch (error) {
    logger.error({ error }, "Tenant management DB connection failed");
    return false;
  }
}

export async function closeTenantConnection(): Promise<void> {
  if (queryClient) {
    await queryClient.end();
    queryClient = null;
    dbInstance = null;
    logger.info("Tenant management DB connection closed");
  }
}

