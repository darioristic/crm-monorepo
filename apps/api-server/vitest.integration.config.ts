import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/__tests__/integration/setup.ts"],
    maxConcurrency: 1,
    sequence: {
      concurrent: false,
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "src/__tests__/", "**/*.d.ts", "**/*.config.*", "**/dist/"],
    },
    include: ["src/__tests__/integration/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ||
        "postgresql://test_user:test_password@localhost:5433/crm_test",
      JWT_SECRET: "test-jwt-secret-for-integration-tests",
      REDIS_URL: process.env.TEST_REDIS_URL || "redis://localhost:6380/2",
      PORT: process.env.PORT || "3002",
      API_URL: process.env.API_URL || "http://localhost:3002",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
