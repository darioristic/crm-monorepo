import postgres from "postgres";

const DATABASE_URL =
  process.env.DATABASE_URL || "postgres://crm_user:crm_password@localhost:5432/crm_db";

// Create PostgreSQL client with connection pooling
export const db = postgres(DATABASE_URL, {
  max: 20, // Maximum connections in pool
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout in seconds
  transform: {
    undefined: null, // Transform undefined to null
  },
  onnotice: () => {}, // Suppress notice messages
  debug: process.env.NODE_ENV === "development",
});

// Test connection
export async function testConnection(): Promise<boolean> {
  try {
    await db`SELECT 1`;
    console.log("✅ Database connected successfully");
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    return false;
  }
}

// Transaction helper
export async function transaction<T>(callback: (sql: typeof db) => Promise<T>): Promise<T> {
  return db.begin(callback);
}

// Graceful shutdown
export async function closeConnection(): Promise<void> {
  await db.end();
  console.log("Database connection closed");
}

export default db;
