/**
 * Cache Manager - Wrapper za optimizovano upravljanje cache-om
 * 
 * Poboljšanja:
 * - Automatski cache invalidation na write operacijama
 * - Cache warming za česte upite
 * - Cache tagging za grupisanje srodnih podataka
 */

import { cache } from "./redis";
import { logger } from "../lib/logger";

export class CacheManager {
	private defaultTTL = 300; // 5 minutes

	/**
	 * Get with automatic fallback and optional cache warming
	 */
	async getOrSet<T>(
		key: string,
		fetcher: () => Promise<T>,
		ttl?: number,
	): Promise<T> {
		// Try to get from cache
		const cached = await cache.get<T>(key);
		if (cached !== null) {
			return cached;
		}

		// Fetch fresh data
		const data = await fetcher();

		// Store in cache
		await cache.set(key, data, ttl || this.defaultTTL);

		return data;
	}

	/**
	 * Get with stale-while-revalidate pattern
	 * Returns stale data immediately if available, refreshes in background
	 */
	async getOrSetWithStale<T>(
		key: string,
		fetcher: () => Promise<T>,
		ttl: number = 300, // Fresh data TTL (5 minutes)
		staleTTL: number = 600, // Stale data TTL (10 minutes)
	): Promise<T> {
		return cache.getWithStale(key, fetcher, ttl, staleTTL);
	}

	/**
	 * Invalidate cache for related keys (using pattern)
	 */
	async invalidatePattern(pattern: string): Promise<void> {
		await cache.invalidatePattern(pattern);
		logger.debug({ pattern }, "Cache invalidated by pattern");
	}

	/**
	 * Invalidate cache for specific entity type
	 */
	async invalidateEntity(entityType: string, entityId?: string): Promise<void> {
		const patterns = [
			`${entityType}:*`,
			`${entityType}:list:*`,
		];

		if (entityId) {
			patterns.push(`${entityType}:${entityId}`);
		}

		for (const pattern of patterns) {
			await this.invalidatePattern(pattern);
		}
	}

	/**
	 * Cache with tags for easier invalidation
	 */
	async setWithTags<T>(
		key: string,
		value: T,
		tags: string[],
		ttl?: number,
	): Promise<void> {
		// Store the value
		await cache.set(key, value, ttl || this.defaultTTL);

		// Store tags for this key
		for (const tag of tags) {
			const tagKey = `tag:${tag}`;
			const existing = await cache.get<string[]>(tagKey) || [];
			if (!existing.includes(key)) {
				existing.push(key);
				await cache.set(tagKey, existing, ttl || this.defaultTTL);
			}
		}
	}

	/**
	 * Invalidate all keys with specific tag
	 */
	async invalidateByTag(tag: string): Promise<void> {
		const tagKey = `tag:${tag}`;
		const keys = await cache.get<string[]>(tagKey) || [];

		for (const key of keys) {
			await cache.del(key);
		}

		await cache.del(tagKey);
		logger.debug({ tag, keysCount: keys.length }, "Cache invalidated by tag");
	}
}

export const cacheManager = new CacheManager();

