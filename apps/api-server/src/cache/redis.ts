import Redis from "ioredis";
import { cacheLogger } from "../lib/logger";

const REDIS_URL = process.env.REDIS_URL;
const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379", 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

let redis: Redis;

if (REDIS_URL && REDIS_URL.trim().length > 0) {
  cacheLogger.info({ url: REDIS_URL }, "Connecting to Redis via URL");
  redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      if (times > 3) {
        cacheLogger.error("Redis connection failed after 3 retries");
        return null;
      }
      return Math.min(times * 200, 2000);
    },
    lazyConnect: false,
  });
} else {
  cacheLogger.info({ host: REDIS_HOST, port: REDIS_PORT }, "Connecting to Redis");
  redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      if (times > 3) {
        cacheLogger.error("Redis connection failed after 3 retries");
        return null;
      }
      return Math.min(times * 200, 2000);
    },
    lazyConnect: false,
  });
}

// Connection event handlers
redis.on("connect", () => {
  cacheLogger.info("Redis connected");
});

redis.on("error", (error) => {
  cacheLogger.error({ error: error.message }, "Redis error");
});

redis.on("close", () => {
  cacheLogger.info("Redis connection closed");
});

// Cache utility class
class CacheService {
  private defaultTTL = 300; // 5 minutes

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (error) {
      cacheLogger.error({ key, error }, "Cache get error");
      return null;
    }
  }

  /**
   * Get with stale-while-revalidate pattern
   * Returns stale data immediately while refreshing in background
   */
  async getWithStale<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = 300,
    staleTTL: number = 600
  ): Promise<T> {
    try {
      const freshKey = `fresh:${key}`;
      const staleKey = `stale:${key}`;

      // Try to get fresh data first
      const fresh = await this.get<T>(freshKey);
      if (fresh !== null) {
        return fresh;
      }

      // If fresh data not available, try stale data
      const stale = await this.get<T>(staleKey);
      if (stale !== null) {
        // Refresh in background (fire and forget)
        fetcher()
          .then((data) => {
            this.set(freshKey, data, ttl);
            this.set(staleKey, data, staleTTL);
          })
          .catch((error) => {
            cacheLogger.error({ key, error }, "Background refresh error");
          });
        return stale;
      }

      // If no cached data, fetch fresh
      const data = await fetcher();
      await this.set(freshKey, data, ttl);
      await this.set(staleKey, data, staleTTL);
      return data;
    } catch (error) {
      cacheLogger.error({ key, error }, "Get with stale error");
      // Fallback to direct fetch on error
      return fetcher();
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (typeof ttl === "number") {
        if (ttl > 0) {
          await redis.setex(key, ttl, serialized);
        } else {
          await redis.set(key, serialized);
        }
      } else {
        await redis.setex(key, this.defaultTTL, serialized);
      }
    } catch (error) {
      cacheLogger.error({ key, error }, "Cache set error");
    }
  }

  async del(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      cacheLogger.error({ key, error }, "Cache delete error");
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      // Use SCAN instead of KEYS for better performance in production
      // KEYS blocks the Redis server, SCAN is non-blocking
      const keys: string[] = [];
      let cursor = "0";

      do {
        const result = await redis.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          100 // Process 100 keys at a time
        );
        cursor = result[0];
        keys.push(...result[1]);
      } while (cursor !== "0");

      // Delete keys in batches to avoid overwhelming Redis
      if (keys.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < keys.length; i += batchSize) {
          const batch = keys.slice(i, i + batchSize);
          await redis.del(...batch);
        }
        cacheLogger.debug({ pattern, keysCount: keys.length }, "Cache invalidated by pattern");
      }
    } catch (error) {
      cacheLogger.error({ pattern, error }, "Cache invalidate pattern error");
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      cacheLogger.error({ key, error }, "Cache exists error");
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await redis.ttl(key);
    } catch (error) {
      cacheLogger.error({ key, error }, "Cache TTL error");
      return -1;
    }
  }

  // Increment counter (useful for rate limiting)
  async incr(key: string, ttl?: number): Promise<number> {
    try {
      const count = await redis.incr(key);
      if (count === 1 && ttl) {
        await redis.expire(key, ttl);
      }
      return count;
    } catch (error) {
      cacheLogger.error({ key, error }, "Cache incr error");
      return 0;
    }
  }

  // Hash operations
  async hget<T>(key: string, field: string): Promise<T | null> {
    try {
      const data = await redis.hget(key, field);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (error) {
      cacheLogger.error({ key, field, error }, "Cache hget error");
      return null;
    }
  }

  async hset<T>(key: string, field: string, value: T): Promise<void> {
    try {
      await redis.hset(key, field, JSON.stringify(value));
    } catch (error) {
      cacheLogger.error({ key, field, error }, "Cache hset error");
    }
  }

  async hdel(key: string, field: string): Promise<void> {
    try {
      await redis.hdel(key, field);
    } catch (error) {
      cacheLogger.error({ key, field, error }, "Cache hdel error");
    }
  }

  async hgetall<T>(key: string): Promise<Record<string, T>> {
    try {
      const data = await redis.hgetall(key);
      const result: Record<string, T> = {};
      for (const [field, value] of Object.entries(data)) {
        result[field] = JSON.parse(value) as T;
      }
      return result;
    } catch (error) {
      cacheLogger.error({ key, error }, "Cache hgetall error");
      return {};
    }
  }

  // Session management helpers
  async setSession(
    sessionId: string,
    data: Record<string, unknown>,
    ttl: number = 86400 // 24 hours
  ): Promise<void> {
    await this.set(`session:${sessionId}`, data, ttl);
  }

  async getSession<T>(sessionId: string): Promise<T | null> {
    return this.get<T>(`session:${sessionId}`);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.del(`session:${sessionId}`);
  }

  async refreshSession(sessionId: string, ttl: number = 86400): Promise<boolean> {
    try {
      const result = await redis.expire(`session:${sessionId}`, ttl);
      return result === 1;
    } catch (error) {
      cacheLogger.error({ sessionId, error }, "Session refresh error");
      return false;
    }
  }

  // ============================================
  // Rate Limiting
  // ============================================

  async checkRateLimit(
    identifier: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
    const key = `ratelimit:${identifier}`;
    try {
      const count = await this.incr(key, windowSeconds);
      const ttl = await this.ttl(key);

      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        resetIn: ttl > 0 ? ttl : windowSeconds,
      };
    } catch (error) {
      cacheLogger.error({ identifier, error }, "Rate limit check error");
      // Fail open - allow request if Redis is down
      return { allowed: true, remaining: limit, resetIn: windowSeconds };
    }
  }

  async getRateLimitInfo(
    identifier: string,
    limit: number
  ): Promise<{ count: number; remaining: number; resetIn: number }> {
    const key = `ratelimit:${identifier}`;
    try {
      const countStr = await redis.get(key);
      const count = countStr ? parseInt(countStr, 10) : 0;
      const ttl = await this.ttl(key);

      return {
        count,
        remaining: Math.max(0, limit - count),
        resetIn: Math.max(0, ttl),
      };
    } catch (error) {
      cacheLogger.error({ identifier, error }, "Rate limit info error");
      return { count: 0, remaining: limit, resetIn: 0 };
    }
  }

  // ============================================
  // API Key Management
  // ============================================

  async storeApiKey(
    apiKey: string,
    data: {
      userId: string;
      name: string;
      scopes: string[];
      createdAt: string;
      expiresAt?: string;
    }
  ): Promise<void> {
    const key = `apikey:${apiKey}`;
    await this.set(key, data, 0); // No expiry for API keys (managed separately)
    // Also store in a hash for listing user's API keys
    await this.hset(`user:${data.userId}:apikeys`, apiKey, {
      name: data.name,
      createdAt: data.createdAt,
    });
  }

  async getApiKey(apiKey: string): Promise<{
    userId: string;
    name: string;
    scopes: string[];
    createdAt: string;
    expiresAt?: string;
  } | null> {
    return this.get(`apikey:${apiKey}`);
  }

  async revokeApiKey(apiKey: string, userId: string): Promise<void> {
    await this.del(`apikey:${apiKey}`);
    await this.hdel(`user:${userId}:apikeys`, apiKey);
  }

  async getUserApiKeys(
    userId: string
  ): Promise<Record<string, { name: string; createdAt: string }>> {
    return this.hgetall(`user:${userId}:apikeys`);
  }

  // ============================================
  // Distributed Locks
  // ============================================

  async acquireLock(lockName: string, ttlSeconds: number = 30): Promise<string | null> {
    const lockKey = `lock:${lockName}`;
    const lockValue = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

    try {
      const result = await redis.set(lockKey, lockValue, "EX", ttlSeconds, "NX");
      return result === "OK" ? lockValue : null;
    } catch (error) {
      cacheLogger.error({ lockName, error }, "Lock acquire error");
      return null;
    }
  }

  async releaseLock(lockName: string, lockValue: string): Promise<boolean> {
    const lockKey = `lock:${lockName}`;
    try {
      // Only release if we hold the lock
      const currentValue = await redis.get(lockKey);
      if (currentValue === lockValue) {
        await redis.del(lockKey);
        return true;
      }
      return false;
    } catch (error) {
      cacheLogger.error({ lockName, error }, "Lock release error");
      return false;
    }
  }

  // ============================================
  // Pub/Sub for Real-time Events
  // ============================================

  async publish(channel: string, message: unknown): Promise<number> {
    try {
      return await redis.publish(channel, JSON.stringify(message));
    } catch (error) {
      cacheLogger.error({ channel, error }, "Publish error");
      return 0;
    }
  }

  // Health check
  async ping(): Promise<boolean> {
    try {
      const result = await redis.ping();
      return result === "PONG";
    } catch {
      return false;
    }
  }

  // Get Redis stats
  async getStats(): Promise<{
    connected: boolean;
    memory?: string;
    clients?: number;
    keys?: number;
  }> {
    try {
      const info = await redis.info("memory");
      const clientInfo = await redis.info("clients");
      const dbSize = await redis.dbsize();

      const memoryMatch = info.match(/used_memory_human:(\S+)/);
      const clientsMatch = clientInfo.match(/connected_clients:(\d+)/);

      return {
        connected: true,
        memory: memoryMatch?.[1],
        clients: clientsMatch ? parseInt(clientsMatch[1], 10) : undefined,
        keys: dbSize,
      };
    } catch {
      return { connected: false };
    }
  }
}

export const cache = new CacheService();
export default redis;
export { redis };
