import { afterAll, beforeAll, beforeEach, vi } from "vitest";

// Mock environment variables for testing
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-key-for-testing-only";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.TEST_DATABASE_URL ||
  "postgresql://crm_user:crm_password@localhost:5432/crm_test";
process.env.REDIS_URL =
  process.env.REDIS_URL || process.env.TEST_REDIS_URL || "redis://localhost:6379/1";

// Global test setup
beforeAll(() => {});

afterAll(() => {});

// Reset state before each test
beforeEach(() => {
  // Clear mocks
  if (typeof vi !== "undefined") {
    vi.clearAllMocks();
  }
});
