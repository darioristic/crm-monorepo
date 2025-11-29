import db from "../client";

export const name = "002_create_users";

export async function up(): Promise<void> {
  console.log(`Running migration: ${name}`);

  // Create enum type for user roles
  await db`
    DO $$ BEGIN
      CREATE TYPE user_role AS ENUM ('admin', 'user');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `;

  await db`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      role user_role NOT NULL DEFAULT 'user',
      company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
      status VARCHAR(50) DEFAULT 'active',
      avatar_url TEXT,
      phone VARCHAR(50),
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Create indexes
  await db`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)`;
  await db`CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`;

  console.log(`✅ Migration ${name} completed`);
}

export async function down(): Promise<void> {
  console.log(`Rolling back migration: ${name}`);

  await db`DROP INDEX IF EXISTS idx_users_role`;
  await db`DROP INDEX IF EXISTS idx_users_company_id`;
  await db`DROP INDEX IF EXISTS idx_users_email`;
  await db`DROP TABLE IF EXISTS users CASCADE`;
  await db`DROP TYPE IF EXISTS user_role`;

  console.log(`✅ Rollback ${name} completed`);
}
