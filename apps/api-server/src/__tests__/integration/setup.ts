import { type ChildProcess, spawn } from "node:child_process";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";

// Override environment variables for integration tests (set BEFORE importing modules)
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL || "postgresql://test_user:test_password@localhost:5433/crm_test";
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.REDIS_URL = process.env.TEST_REDIS_URL || "redis://localhost:6380/2";
process.env.JWT_SECRET = "test-jwt-secret-for-integration-tests";
process.env.ENABLE_WORKERS = "false";

let testDbInitialized = false;
let _skipIntegration = false;
let serverProcess: ChildProcess | null = null;

async function setupTestDatabase(): Promise<boolean> {
  if (testDbInitialized) return true;

  try {
    const { sql } = await import("../../db/client");
    await sql`SELECT 1`;
    testDbInitialized = true;
    return true;
  } catch (_error) {
    console.warn("⚠️ Integration DB not available. Tests will be skipped.");
    _skipIntegration = true;
    return false;
  }
}

async function runMigrations(): Promise<void> {
  await new Promise<void>((resolve) => {
    const proc = spawn("bun", ["run", "migrate:up"], {
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    });
    proc.on("close", () => resolve());
    proc.on("error", () => resolve());
  });
}

// Ensure legacy test schema compatibility (columns/tables expected by tests)
async function ensureLegacySchemaCompatibility(): Promise<void> {
  const { sql } = await import("../../db/client");
  try {
    // Add users.company_id if missing
    await sql`
      DO $$ BEGIN
        BEGIN
          ALTER TABLE users ADD COLUMN company_id UUID;
        EXCEPTION WHEN duplicate_column THEN
          NULL;
        END;
        BEGIN
          ALTER TABLE users
            ADD CONSTRAINT fk_users_company
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
        EXCEPTION WHEN duplicate_object THEN
          NULL;
        END;
      END $$;
    `;
  } catch {}

  try {
    // Create order_items if missing
    await sql`
      CREATE TABLE IF NOT EXISTS order_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_name VARCHAR(255) NOT NULL,
        description TEXT,
        quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
        unit_price DECIMAL(15, 2) NOT NULL,
        discount DECIMAL(5, 2) NOT NULL DEFAULT 0,
        total DECIMAL(15, 2) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)`;
  } catch {}
}

async function seedTestData(): Promise<void> {
  await new Promise<void>((resolve) => {
    const proc = spawn("bun", ["run", "db:seed"], {
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    });
    proc.on("close", () => resolve());
    proc.on("error", () => resolve());
  });
}

async function startTestServer() {
  return new Promise<void>((resolve, reject) => {
    const apiUrl = process.env.API_URL || "http://localhost:3002";

    void (async () => {
      if (serverProcess) {
        try {
          serverProcess.kill();
          serverProcess = null;
          await new Promise((r) => setTimeout(r, 250));
        } catch {}
      }
      try {
        const res = await fetch(`${apiUrl}/health`);
        if (res.ok) {
          resolve();
          return;
        }
      } catch {}

      serverProcess = spawn("bun", ["run", "src/index.ts"], {
        env: {
          ...process.env,
          PORT: "3002",
          DATABASE_URL: TEST_DATABASE_URL,
          ENABLE_WORKERS: "false",
          LOG_LEVEL: "debug",
        },
        stdio: "inherit",
      });

      serverProcess.on("error", (err) => {
        console.error("Failed to start server:", err);
        reject(err);
      });

      const start = Date.now();
      const timeoutMs = 10000;
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`${apiUrl}/health`);
          if (res.ok) {
            clearInterval(interval);
            resolve();
            return;
          }
        } catch {}
        if (Date.now() - start > timeoutMs) {
          clearInterval(interval);
          console.warn("⚠️ Test server not reachable. Continuing without global skip.");
          resolve();
        }
      }, 500);
    })();
  });
}

async function cleanupTestDatabase() {
  try {
    const { sql } = await import("../../db/client");
    const truncateIfExists = async (table: string) => {
      try {
        const exists = await sql`
          SELECT to_regclass(${table}) as exists
        `;
        const reg = exists[0]?.exists as string | null;
        if (!reg) return;
        await sql.unsafe(`TRUNCATE TABLE ${table} CASCADE`);
      } catch (err) {
        console.warn(`Could not truncate ${table}:`, err);
      }
    };

    const tables = [
      "invites",
      "notification_settings",
      "notifications",
      "orders",
      "connected_accounts",
      "invoice_items",
      "invoices",
    ];

    for (const table of tables) {
      await truncateIfExists(table);
    }
  } catch (error) {
    console.error("Error cleaning up test database:", error);
  }
}

async function cleanupRedis() {
  try {
    const { redis } = await import("../../cache/redis");
    const keys = await redis.keys("test:*");
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error("Error cleaning up Redis:", error);
  }
}

// Mock Bun global if not available (for Vitest in Node environment)
if (typeof globalThis.Bun === "undefined") {
  (globalThis as any).Bun = {
    password: {
      hash: async (password: string) => `hashed_${password}`,
      verify: async (password: string, hash: string) => hash === `hashed_${password}`,
    },
  };
}

beforeAll(async () => {
  const dbOk = await setupTestDatabase();
  if (!dbOk) {
    const d: any = (globalThis as any).describe;
    if (d && typeof d.skip === "function") {
      (globalThis as any).describe = d.skip.bind(d);
    }
    return;
  }
  await runMigrations();
  await ensureLegacySchemaCompatibility();
  await seedTestData();
  await startTestServer();
});

afterAll(async () => {
  // Keep server running to avoid race conditions across workers
  await cleanupTestDatabase();
  try {
    const { sql } = await import("../../db/client");
    await sql.end();
  } catch {}
  try {
    const { redis } = await import("../../cache/redis");
    await redis.quit();
  } catch {}
});

beforeEach(async () => {
  // Clean up before each test
  await cleanupTestDatabase();
  await cleanupRedis();
});

afterEach(async () => {
  // Additional cleanup after each test if needed
});
