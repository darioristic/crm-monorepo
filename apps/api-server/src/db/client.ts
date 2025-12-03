import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";
import { dbLogger } from "../lib/logger";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    "FATAL: DATABASE_URL environment variable is required. " +
    "Example: postgresql://username:password@localhost:5432/crm_db"
  );
}

// Create PostgreSQL client with connection pooling
const queryClient = postgres(DATABASE_URL, {
  max: 20, // Maximum connections in pool
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout in seconds
  transform: {
    undefined: null, // Transform undefined to null
  },
  onnotice: () => {}, // Suppress notice messages
  debug: process.env.NODE_ENV === "development",
});

// Create Drizzle ORM instance with schema
export const db = drizzle(queryClient, { schema });

// Export the raw postgres client for migrations and raw queries if needed
export const sql = queryClient;

// Test connection
export async function testConnection(): Promise<boolean> {
  try {
    await queryClient`SELECT 1`;
    dbLogger.info("Database connected successfully");
    return true;
  } catch (error) {
    dbLogger.error({ error }, "Database connection failed");
    return false;
  }
}

// Transaction helper using Drizzle
export async function transaction<T>(
  callback: Parameters<typeof db.transaction>[0]
): Promise<T> {
  return db.transaction(callback) as Promise<T>;
}

// Graceful shutdown
export async function closeConnection(): Promise<void> {
  await queryClient.end();
  dbLogger.info("Database connection closed");
}

export default db;
