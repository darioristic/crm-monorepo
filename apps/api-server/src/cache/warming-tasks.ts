/**
 * Cache Warming Tasks Configuration
 *
 * Register all cache warming tasks for critical CRM data
 * Priority: 1 (low) - 10 (critical)
 */

import type { FilterParams, PaginationParams } from "@crm/types";
import { companyQueries } from "../db/queries/companies";
import { cacheLogger } from "../lib/logger";
import { cacheWarmer } from "./cache-warmer";

const CACHE_TTL = 300; // 5 minutes

/**
 * Register all warming tasks for the application
 */
export async function registerWarmingTasks(): Promise<void> {
  cacheLogger.info("Registering cache warming tasks");

  // ============================================
  // COMPANIES - Priority: 9 (High)
  // ============================================

  // Warm: First page of companies (most accessed)
  cacheWarmer.register({
    key: `companies:list:${JSON.stringify({
      pagination: { page: 1, pageSize: 20 },
      effectiveFilters: {},
    })}`,
    fetcher: async () => {
      const pagination: PaginationParams = { page: 1, pageSize: 20 };
      const filters: FilterParams = {};
      return await companyQueries.findAll(pagination, filters);
    },
    ttl: CACHE_TTL,
    priority: 9,
    category: "companies",
  });

  // Warm: Industries list (frequently accessed for filters)
  cacheWarmer.register({
    key: "companies:industries",
    fetcher: async () => {
      return await companyQueries.getIndustries();
    },
    ttl: CACHE_TTL,
    priority: 8,
    category: "companies",
  });

  // Warm: Companies by most common industries
  const commonIndustries = ["Technology", "Healthcare", "Finance", "Retail"];
  for (const industry of commonIndustries) {
    cacheWarmer.register({
      key: `companies:industry:${industry}`,
      fetcher: async () => {
        return await companyQueries.findByIndustry(industry);
      },
      ttl: CACHE_TTL,
      priority: 7,
      category: "companies",
    });
  }

  // ============================================
  // USERS - Priority: 10 (Critical)
  // ============================================

  // Note: Add user warming tasks when user queries are available
  // Example:
  // cacheWarmer.register({
  //   key: "users:active",
  //   fetcher: async () => await userQueries.findActive(),
  //   ttl: CACHE_TTL,
  //   priority: 10,
  //   category: "users",
  // });

  // ============================================
  // PROJECTS - Priority: 8 (High)
  // ============================================

  // Note: Add project warming tasks when needed
  // cacheWarmer.register({
  //   key: "projects:active",
  //   fetcher: async () => await projectQueries.findActive(),
  //   ttl: CACHE_TTL,
  //   priority: 8,
  //   category: "projects",
  // });

  // ============================================
  // SALES - Priority: 7 (Medium-High)
  // ============================================

  // Note: Add sales/deals warming tasks when needed
  // cacheWarmer.register({
  //   key: "deals:open",
  //   fetcher: async () => await dealQueries.findOpen(),
  //   ttl: CACHE_TTL,
  //   priority: 7,
  //   category: "sales",
  // });

  // ============================================
  // CONTACTS/LEADS - Priority: 6 (Medium)
  // ============================================

  // Note: Add contact/lead warming tasks when needed
  // cacheWarmer.register({
  //   key: "leads:recent",
  //   fetcher: async () => await leadQueries.findRecent(30),
  //   ttl: CACHE_TTL,
  //   priority: 6,
  //   category: "leads",
  // });

  const tasksByCategory = cacheWarmer.getTasksByCategory();
  cacheLogger.info({ tasks: tasksByCategory }, "Cache warming tasks registered");
}

/**
 * Perform startup cache warming
 * Called when the server starts
 */
export async function performStartupWarming(): Promise<void> {
  cacheLogger.info("Starting cache warming on startup");

  try {
    // Register all tasks
    await registerWarmingTasks();

    // Warm all caches in parallel with concurrency limit
    const metrics = await cacheWarmer.warmAll({
      parallel: true,
      maxParallel: 5,
    });

    cacheLogger.info(
      {
        metrics,
        successRate: `${((metrics.successfulTasks / metrics.totalTasks) * 100).toFixed(2)}%`,
      },
      "Startup cache warming completed"
    );
  } catch (error) {
    cacheLogger.error({ error }, "Startup cache warming failed");
    // Don't throw - allow server to start even if warming fails
  }
}

/**
 * Start background cache warming
 * Refreshes cache periodically to keep data fresh
 */
export function startBackgroundWarming(intervalMinutes: number = 30): void {
  cacheLogger.info({ intervalMinutes }, "Starting background cache warming");

  // Start background warming
  cacheWarmer.startBackgroundWarming(intervalMinutes);

  // Also periodically warm expiring caches (every 5 minutes)
  setInterval(
    async () => {
      try {
        const warmedCount = await cacheWarmer.warmExpiringSoon(60); // Warm if expiring in < 60s
        if (warmedCount > 0) {
          cacheLogger.debug({ warmedCount }, "Refreshed expiring cache entries");
        }
      } catch (error) {
        cacheLogger.error({ error }, "Failed to warm expiring caches");
      }
    },
    5 * 60 * 1000
  ); // Every 5 minutes
}

/**
 * Stop background cache warming
 * Called when shutting down the server
 */
export function stopBackgroundWarming(): void {
  cacheLogger.info("Stopping background cache warming");
  cacheWarmer.stopBackgroundWarming();
}
