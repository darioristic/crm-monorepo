import { vi } from 'vitest';

// Mock Redis client
export const createMockRedis = () => {
  const store = new Map<string, { value: string; ttl?: number }>();

  return {
    get: vi.fn(async (key: string) => {
      const item = store.get(key);
      return item?.value ?? null;
    }),

    set: vi.fn(async (key: string, value: string, mode?: string, duration?: number) => {
      store.set(key, { value, ttl: duration });
      return 'OK';
    }),

    setex: vi.fn(async (key: string, seconds: number, value: string) => {
      store.set(key, { value, ttl: seconds });
      return 'OK';
    }),

    del: vi.fn(async (key: string) => {
      const deleted = store.delete(key);
      return deleted ? 1 : 0;
    }),

    exists: vi.fn(async (key: string) => {
      return store.has(key) ? 1 : 0;
    }),

    incr: vi.fn(async (key: string) => {
      const item = store.get(key);
      const currentValue = item ? Number.parseInt(item.value, 10) : 0;
      const newValue = currentValue + 1;
      store.set(key, { value: String(newValue) });
      return newValue;
    }),

    expire: vi.fn(async (key: string, seconds: number) => {
      const item = store.get(key);
      if (item) {
        item.ttl = seconds;
        return 1;
      }
      return 0;
    }),

    ttl: vi.fn(async (key: string) => {
      const item = store.get(key);
      return item?.ttl ?? -2;
    }),

    flushall: vi.fn(async () => {
      store.clear();
      return 'OK';
    }),

    // Test helper
    _store: store,
  };
};

export const mockRedisClient = createMockRedis();
