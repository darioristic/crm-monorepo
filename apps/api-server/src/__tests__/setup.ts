import { beforeAll, afterAll, beforeEach, vi } from 'vitest';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/crm_test';
process.env.REDIS_URL = 'redis://localhost:6379/1';

// Global test setup
beforeAll(() => {
  console.log('🧪 Starting test suite...');
});

afterAll(() => {
  console.log('✅ Test suite completed');
});

// Reset state before each test
beforeEach(() => {
  // Clear mocks
  if (typeof vi !== 'undefined') {
    vi.clearAllMocks();
  }
});
