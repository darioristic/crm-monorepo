/**
 * Cache Warmer - Intelligent cache warming and preloading
 *
 * Features:
 * - Startup warming: Preload critical data on server start
 * - Background warming: Refresh cache before expiration
 * - Priority-based warming: Warm most accessed data first
 * - Metrics tracking: Monitor warming effectiveness
 */

import { cacheLogger } from "../lib/logger";
import { cache } from "./redis";

export interface WarmupTask {
  key: string;
  fetcher: () => Promise<unknown>;
  ttl: number;
  priority: number; // Higher = more important
  category: string;
}

export interface WarmupMetrics {
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  totalTime: number;
  startedAt: Date;
  completedAt?: Date;
}

export class CacheWarmer {
  private tasks: WarmupTask[] = [];
  private isWarming = false;
  private warmupInterval?: NodeJS.Timeout;
  private metrics: WarmupMetrics = {
    totalTasks: 0,
    successfulTasks: 0,
    failedTasks: 0,
    totalTime: 0,
    startedAt: new Date(),
  };

  /**
   * Register a task for cache warming
   */
  register(task: WarmupTask): void {
    this.tasks.push(task);
    cacheLogger.debug(
      { key: task.key, priority: task.priority, category: task.category },
      "Cache warming task registered"
    );
  }

  /**
   * Register multiple tasks at once
   */
  registerBatch(tasks: WarmupTask[]): void {
    this.tasks.push(...tasks);
    cacheLogger.info({ count: tasks.length }, "Batch cache warming tasks registered");
  }

  /**
   * Warm a single cache entry
   */
  private async warmSingle(task: WarmupTask): Promise<boolean> {
    try {
      const startTime = Date.now();

      // Check if already cached
      const exists = await cache.exists(task.key);
      if (exists) {
        cacheLogger.debug({ key: task.key }, "Cache key already warm");
        return true;
      }

      // Fetch and cache data
      const data = await task.fetcher();
      await cache.set(task.key, data, task.ttl);

      const duration = Date.now() - startTime;
      cacheLogger.info(
        { key: task.key, duration, category: task.category },
        "Cache warmed successfully"
      );

      return true;
    } catch (error) {
      cacheLogger.error({ key: task.key, error, category: task.category }, "Cache warming failed");
      return false;
    }
  }

  /**
   * Execute all registered warming tasks
   * Sorted by priority (highest first)
   */
  async warmAll(options?: { parallel?: boolean; maxParallel?: number }): Promise<WarmupMetrics> {
    if (this.isWarming) {
      cacheLogger.warn("Cache warming already in progress");
      return this.metrics;
    }

    this.isWarming = true;
    const startTime = Date.now();

    // Sort tasks by priority (highest first)
    const sortedTasks = [...this.tasks].sort((a, b) => b.priority - a.priority);

    cacheLogger.info({ totalTasks: sortedTasks.length }, "Starting cache warming");

    this.metrics = {
      totalTasks: sortedTasks.length,
      successfulTasks: 0,
      failedTasks: 0,
      totalTime: 0,
      startedAt: new Date(),
    };

    if (options?.parallel) {
      // Parallel warming with concurrency limit
      const maxParallel = options.maxParallel || 5;
      const chunks: WarmupTask[][] = [];

      for (let i = 0; i < sortedTasks.length; i += maxParallel) {
        chunks.push(sortedTasks.slice(i, i + maxParallel));
      }

      for (const chunk of chunks) {
        const results = await Promise.allSettled(chunk.map((task) => this.warmSingle(task)));

        results.forEach((result) => {
          if (result.status === "fulfilled" && result.value) {
            this.metrics.successfulTasks++;
          } else {
            this.metrics.failedTasks++;
          }
        });
      }
    } else {
      // Sequential warming
      for (const task of sortedTasks) {
        const success = await this.warmSingle(task);
        if (success) {
          this.metrics.successfulTasks++;
        } else {
          this.metrics.failedTasks++;
        }
      }
    }

    this.metrics.totalTime = Date.now() - startTime;
    this.metrics.completedAt = new Date();
    this.isWarming = false;

    cacheLogger.info(
      {
        ...this.metrics,
        successRate: `${((this.metrics.successfulTasks / this.metrics.totalTasks) * 100).toFixed(2)}%`,
      },
      "Cache warming completed"
    );

    return this.metrics;
  }

  /**
   * Warm specific category of tasks
   */
  async warmCategory(category: string, options?: { parallel?: boolean }): Promise<number> {
    const categoryTasks = this.tasks.filter((t) => t.category === category);

    if (categoryTasks.length === 0) {
      cacheLogger.warn({ category }, "No tasks found for category");
      return 0;
    }

    cacheLogger.info({ category, count: categoryTasks.length }, "Warming category");

    let successCount = 0;

    if (options?.parallel) {
      const results = await Promise.allSettled(categoryTasks.map((task) => this.warmSingle(task)));
      successCount = results.filter((r) => r.status === "fulfilled" && r.value).length;
    } else {
      for (const task of categoryTasks) {
        const success = await this.warmSingle(task);
        if (success) successCount++;
      }
    }

    cacheLogger.info(
      { category, successCount, totalCount: categoryTasks.length },
      "Category warming completed"
    );

    return successCount;
  }

  /**
   * Start background warming - refresh cache periodically before expiration
   */
  startBackgroundWarming(intervalMinutes: number = 30): void {
    if (this.warmupInterval) {
      cacheLogger.warn("Background warming already running");
      return;
    }

    const intervalMs = intervalMinutes * 60 * 1000;

    this.warmupInterval = setInterval(async () => {
      cacheLogger.info("Starting background cache warming");

      try {
        await this.warmAll({ parallel: true, maxParallel: 10 });
      } catch (error) {
        cacheLogger.error({ error }, "Background warming failed");
      }
    }, intervalMs);

    cacheLogger.info({ intervalMinutes }, "Background cache warming started");
  }

  /**
   * Stop background warming
   */
  stopBackgroundWarming(): void {
    if (this.warmupInterval) {
      clearInterval(this.warmupInterval);
      this.warmupInterval = undefined;
      cacheLogger.info("Background cache warming stopped");
    }
  }

  /**
   * Warm cache for keys that are about to expire
   * Useful for keeping frequently accessed data always available
   */
  async warmExpiringSoon(thresholdSeconds: number = 60): Promise<number> {
    let warmedCount = 0;

    for (const task of this.tasks) {
      try {
        const ttl = await cache.ttl(task.key);

        // If key exists and will expire soon, refresh it
        if (ttl > 0 && ttl <= thresholdSeconds) {
          cacheLogger.debug({ key: task.key, ttl }, "Refreshing expiring cache");

          const success = await this.warmSingle(task);
          if (success) warmedCount++;
        }
      } catch (error) {
        cacheLogger.error({ key: task.key, error }, "Failed to check/warm expiring cache");
      }
    }

    if (warmedCount > 0) {
      cacheLogger.info({ warmedCount, thresholdSeconds }, "Warmed expiring cache entries");
    }

    return warmedCount;
  }

  /**
   * Get current metrics
   */
  getMetrics(): WarmupMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear all registered tasks
   */
  clearTasks(): void {
    this.tasks = [];
    cacheLogger.info("Cache warming tasks cleared");
  }

  /**
   * Get registered tasks count by category
   */
  getTasksByCategory(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const task of this.tasks) {
      counts[task.category] = (counts[task.category] || 0) + 1;
    }
    return counts;
  }
}

// Singleton instance
export const cacheWarmer = new CacheWarmer();
