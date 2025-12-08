/**
 * Cache Module - Centralized cache management
 *
 * Exports:
 * - cache: Core Redis cache service
 * - cacheManager: Enhanced cache manager with utilities
 * - cacheWarmer: Cache warming system
 * - cacheInvalidator: Cache invalidation system
 * - warming tasks: Startup and background warming
 */

export type { InvalidationRecord } from "./cache-invalidator";
// Cache invalidation
export {
  CacheInvalidator,
  cacheInvalidator,
  InvalidationEvent,
  invalidateOnCreate,
  invalidateOnDelete,
  invalidateOnUpdate,
} from "./cache-invalidator";
export { CacheManager, cacheManager } from "./cache-manager";
// Convenience re-exports for common operations
export type { WarmupMetrics } from "./cache-warmer";
// Cache warming
export { CacheWarmer, cacheWarmer } from "./cache-warmer";
// Core cache services
export { cache, redis } from "./redis";
export {
  performStartupWarming,
  registerWarmingTasks,
  startBackgroundWarming,
  stopBackgroundWarming,
} from "./warming-tasks";
