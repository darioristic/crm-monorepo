import db from "../client";
import * as migration001 from "./001_create_companies";
import * as migration002 from "./002_create_users";
import * as migration003 from "./003_create_auth";

interface Migration {
  name: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
}

// Register all migrations in order
const migrations: Migration[] = [migration001, migration002, migration003];

// Migrations tracking table
async function ensureMigrationsTable(): Promise<void> {
  await db`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function getExecutedMigrations(): Promise<string[]> {
  const result = await db`SELECT name FROM _migrations ORDER BY id`;
  return result.map((row) => row.name as string);
}

async function markMigrationExecuted(name: string): Promise<void> {
  await db`INSERT INTO _migrations (name) VALUES (${name})`;
}

async function markMigrationRolledBack(name: string): Promise<void> {
  await db`DELETE FROM _migrations WHERE name = ${name}`;
}

// Run all pending migrations
export async function migrate(): Promise<void> {
  console.log("🚀 Starting migrations...\n");

  await ensureMigrationsTable();
  const executed = await getExecutedMigrations();

  let count = 0;
  for (const migration of migrations) {
    if (!executed.includes(migration.name)) {
      await migration.up();
      await markMigrationExecuted(migration.name);
      count++;
    } else {
      console.log(`⏭️  Skipping ${migration.name} (already executed)`);
    }
  }

  if (count === 0) {
    console.log("\n✅ No pending migrations");
  } else {
    console.log(`\n✅ Executed ${count} migration(s)`);
  }
}

// Rollback the last migration
export async function rollback(): Promise<void> {
  console.log("🔄 Rolling back last migration...\n");

  await ensureMigrationsTable();
  const executed = await getExecutedMigrations();

  if (executed.length === 0) {
    console.log("No migrations to rollback");
    return;
  }

  const lastMigrationName = executed[executed.length - 1];
  const migration = migrations.find((m) => m.name === lastMigrationName);

  if (!migration) {
    throw new Error(`Migration ${lastMigrationName} not found`);
  }

  await migration.down();
  await markMigrationRolledBack(lastMigrationName);
  console.log(`\n✅ Rolled back ${lastMigrationName}`);
}

// Rollback all migrations
export async function reset(): Promise<void> {
  console.log("🔄 Rolling back all migrations...\n");

  await ensureMigrationsTable();
  const executed = await getExecutedMigrations();

  for (let i = executed.length - 1; i >= 0; i--) {
    const migrationName = executed[i];
    const migration = migrations.find((m) => m.name === migrationName);

    if (migration) {
      await migration.down();
      await markMigrationRolledBack(migrationName);
    }
  }

  console.log("\n✅ All migrations rolled back");
}

// Show migration status
export async function status(): Promise<void> {
  console.log("📋 Migration Status\n");

  await ensureMigrationsTable();
  const executed = await getExecutedMigrations();

  for (const migration of migrations) {
    const isExecuted = executed.includes(migration.name);
    const status = isExecuted ? "✅" : "⏳";
    console.log(`${status} ${migration.name}`);
  }
}

// CLI runner
if (import.meta.main) {
  const command = process.argv[2] || "migrate";

  try {
    switch (command) {
      case "migrate":
      case "up":
        await migrate();
        break;
      case "rollback":
      case "down":
        await rollback();
        break;
      case "reset":
        await reset();
        break;
      case "status":
        await status();
        break;
      default:
        console.log(`Unknown command: ${command}`);
        console.log("Available commands: migrate, rollback, reset, status");
        process.exit(1);
    }
    process.exit(0);
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }
}
