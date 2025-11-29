import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Create Redis client
export const redis = new Redis(REDIS_URL, {
	maxRetriesPerRequest: 3,
	retryStrategy(times: number) {
		if (times > 3) {
			console.error("Redis connection failed after 3 retries");
			return null;
		}
		return Math.min(times * 200, 2000);
	},
	lazyConnect: true,
});

// Connection event handlers
redis.on("connect", () => {
	console.log("✅ Redis connected");
});

redis.on("error", (error) => {
	console.error("❌ Redis error:", error.message);
});

redis.on("close", () => {
	console.log("Redis connection closed");
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
			console.error(`Cache get error for key ${key}:`, error);
			return null;
		}
	}

	async set<T>(key: string, value: T, ttl?: number): Promise<void> {
		try {
			const serialized = JSON.stringify(value);
			await redis.setex(key, ttl || this.defaultTTL, serialized);
		} catch (error) {
			console.error(`Cache set error for key ${key}:`, error);
		}
	}

	async del(key: string): Promise<void> {
		try {
			await redis.del(key);
		} catch (error) {
			console.error(`Cache delete error for key ${key}:`, error);
		}
	}

	async invalidatePattern(pattern: string): Promise<void> {
		try {
			const keys = await redis.keys(pattern);
			if (keys.length > 0) {
				await redis.del(...keys);
			}
		} catch (error) {
			console.error(`Cache invalidate pattern error for ${pattern}:`, error);
		}
	}

	async exists(key: string): Promise<boolean> {
		try {
			const result = await redis.exists(key);
			return result === 1;
		} catch (error) {
			console.error(`Cache exists error for key ${key}:`, error);
			return false;
		}
	}

	async ttl(key: string): Promise<number> {
		try {
			return await redis.ttl(key);
		} catch (error) {
			console.error(`Cache TTL error for key ${key}:`, error);
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
			console.error(`Cache incr error for key ${key}:`, error);
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
			console.error(`Cache hget error for ${key}:${field}:`, error);
			return null;
		}
	}

	async hset<T>(key: string, field: string, value: T): Promise<void> {
		try {
			await redis.hset(key, field, JSON.stringify(value));
		} catch (error) {
			console.error(`Cache hset error for ${key}:${field}:`, error);
		}
	}

	async hdel(key: string, field: string): Promise<void> {
		try {
			await redis.hdel(key, field);
		} catch (error) {
			console.error(`Cache hdel error for ${key}:${field}:`, error);
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
			console.error(`Cache hgetall error for ${key}:`, error);
			return {};
		}
	}

	// Session management helpers
	async setSession(
		sessionId: string,
		data: Record<string, unknown>,
		ttl: number = 86400, // 24 hours
	): Promise<void> {
		await this.set(`session:${sessionId}`, data, ttl);
	}

	async getSession<T>(sessionId: string): Promise<T | null> {
		return this.get<T>(`session:${sessionId}`);
	}

	async deleteSession(sessionId: string): Promise<void> {
		await this.del(`session:${sessionId}`);
	}

	async refreshSession(
		sessionId: string,
		ttl: number = 86400,
	): Promise<boolean> {
		try {
			const result = await redis.expire(`session:${sessionId}`, ttl);
			return result === 1;
		} catch (error) {
			console.error(`Session refresh error for ${sessionId}:`, error);
			return false;
		}
	}

	// ============================================
	// Rate Limiting
	// ============================================

	async checkRateLimit(
		identifier: string,
		limit: number,
		windowSeconds: number,
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
			console.error(`Rate limit check error for ${identifier}:`, error);
			// Fail open - allow request if Redis is down
			return { allowed: true, remaining: limit, resetIn: windowSeconds };
		}
	}

	async getRateLimitInfo(
		identifier: string,
		limit: number,
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
			console.error(`Rate limit info error for ${identifier}:`, error);
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
		},
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
		userId: string,
	): Promise<Record<string, { name: string; createdAt: string }>> {
		return this.hgetall(`user:${userId}:apikeys`);
	}

	// ============================================
	// Distributed Locks
	// ============================================

	async acquireLock(
		lockName: string,
		ttlSeconds: number = 30,
	): Promise<string | null> {
		const lockKey = `lock:${lockName}`;
		const lockValue = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

		try {
			const result = await redis.set(
				lockKey,
				lockValue,
				"EX",
				ttlSeconds,
				"NX",
			);
			return result === "OK" ? lockValue : null;
		} catch (error) {
			console.error(`Lock acquire error for ${lockName}:`, error);
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
			console.error(`Lock release error for ${lockName}:`, error);
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
			console.error(`Publish error for ${channel}:`, error);
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
