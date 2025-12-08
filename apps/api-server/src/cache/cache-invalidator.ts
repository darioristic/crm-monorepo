/**
 * Cache Invalidator - Intelligent cache invalidation system
 *
 * Features:
 * - Event-driven invalidation
 * - Cascade invalidation (invalidate related entities)
 * - Batch invalidation for performance
 * - Invalidation history/audit log
 * - Pub/Sub support for multi-instance coordination
 */

import { EventEmitter } from "node:events";
import { cacheLogger } from "../lib/logger";
import { cache } from "./redis";

// Invalidation event types
export enum InvalidationEvent {
  ENTITY_CREATED = "entity:created",
  ENTITY_UPDATED = "entity:updated",
  ENTITY_DELETED = "entity:deleted",
  BATCH_UPDATED = "batch:updated",
  RELATIONSHIP_CHANGED = "relationship:changed",
}

export interface InvalidationRule {
  // When entity changes, what patterns to invalidate
  patterns: string[];
  // Related entities to also invalidate
  relatedEntities?: string[];
  // Custom invalidation logic
  customHandler?: (entityId: string, data?: unknown) => Promise<void>;
}

export interface InvalidationRecord {
  timestamp: Date;
  event: InvalidationEvent;
  entityType: string;
  entityId?: string;
  patternsInvalidated: string[];
  keysInvalidated: number;
}

export class CacheInvalidator extends EventEmitter {
  private rules = new Map<string, InvalidationRule>();
  private history: InvalidationRecord[] = [];
  private maxHistorySize = 100;

  constructor() {
    super();
    this.registerDefaultRules();
  }

  /**
   * Register invalidation rules for an entity type
   */
  registerRule(entityType: string, rule: InvalidationRule): void {
    this.rules.set(entityType, rule);
    cacheLogger.debug({ entityType, patterns: rule.patterns }, "Invalidation rule registered");
  }

  /**
   * Register default invalidation rules for common entities
   */
  private registerDefaultRules(): void {
    // Companies
    this.registerRule("companies", {
      patterns: ["companies:*", "companies:list:*", "companies:industries"],
      relatedEntities: ["projects", "contacts", "deals"],
    });

    // Projects
    this.registerRule("projects", {
      patterns: ["projects:*", "projects:list:*", "projects:active", "projects:stats"],
      relatedEntities: ["tasks", "milestones", "companies"],
    });

    // Tasks
    this.registerRule("tasks", {
      patterns: ["tasks:*", "tasks:list:*", "projects:*:tasks"],
      relatedEntities: ["projects"],
    });

    // Milestones
    this.registerRule("milestones", {
      patterns: ["milestones:*", "milestones:list:*", "projects:*:milestones"],
      relatedEntities: ["projects"],
    });

    // Users
    this.registerRule("users", {
      patterns: ["users:*", "users:list:*", "users:active"],
      relatedEntities: ["session", "permissions"],
    });

    // Deals
    this.registerRule("deals", {
      patterns: ["deals:*", "deals:list:*", "deals:open", "deals:stats"],
      relatedEntities: ["quotes", "companies", "contacts"],
    });

    // Quotes
    this.registerRule("quotes", {
      patterns: ["quotes:*", "quotes:list:*"],
      relatedEntities: ["deals", "companies"],
    });

    // Contacts
    this.registerRule("contacts", {
      patterns: ["contacts:*", "contacts:list:*"],
      relatedEntities: ["companies", "leads"],
    });

    // Leads
    this.registerRule("leads", {
      patterns: ["leads:*", "leads:list:*", "leads:recent"],
      relatedEntities: ["contacts"],
    });
  }

  /**
   * Invalidate cache for an entity change
   */
  async invalidate(
    event: InvalidationEvent,
    entityType: string,
    entityId?: string,
    data?: unknown
  ): Promise<void> {
    const startTime = Date.now();
    const rule = this.rules.get(entityType);

    if (!rule) {
      cacheLogger.warn({ entityType }, "No invalidation rule found for entity type");
      return;
    }

    cacheLogger.info({ event, entityType, entityId }, "Starting cache invalidation");

    const patternsToInvalidate = new Set<string>();
    let totalKeysInvalidated = 0;

    try {
      // Add base patterns
      for (const pattern of rule.patterns) {
        // Replace :id placeholder with actual ID if provided
        const finalPattern = entityId ? pattern.replace(":id", entityId) : pattern;
        patternsToInvalidate.add(finalPattern);
      }

      // Add specific entity key if ID provided
      if (entityId) {
        patternsToInvalidate.add(`${entityType}:${entityId}`);
      }

      // Invalidate all patterns
      for (const pattern of patternsToInvalidate) {
        await cache.invalidatePattern(pattern);
        totalKeysInvalidated++;
      }

      // Execute custom handler if provided
      if (rule.customHandler && entityId) {
        await rule.customHandler(entityId, data);
      }

      // Invalidate related entities
      if (rule.relatedEntities && rule.relatedEntities.length > 0) {
        await this.invalidateRelated(rule.relatedEntities, entityId);
      }

      // Record invalidation
      this.recordInvalidation({
        timestamp: new Date(),
        event,
        entityType,
        entityId,
        patternsInvalidated: Array.from(patternsToInvalidate),
        keysInvalidated: totalKeysInvalidated,
      });

      // Emit event for subscribers
      this.emit("invalidated", {
        event,
        entityType,
        entityId,
        patterns: Array.from(patternsToInvalidate),
      });

      // Publish to Redis pub/sub for multi-instance coordination
      await this.publishInvalidation(event, entityType, entityId);

      const duration = Date.now() - startTime;
      cacheLogger.info(
        {
          event,
          entityType,
          entityId,
          patternsCount: patternsToInvalidate.size,
          keysInvalidated: totalKeysInvalidated,
          duration,
        },
        "Cache invalidation completed"
      );
    } catch (error) {
      cacheLogger.error({ event, entityType, entityId, error }, "Cache invalidation failed");
    }
  }

  /**
   * Invalidate related entities
   */
  private async invalidateRelated(relatedEntities: string[], entityId?: string): Promise<void> {
    for (const relatedType of relatedEntities) {
      const relatedRule = this.rules.get(relatedType);
      if (relatedRule) {
        // Invalidate list patterns for related entities
        for (const pattern of relatedRule.patterns) {
          if (pattern.includes(":list:") || pattern.includes(":active")) {
            await cache.invalidatePattern(pattern);
          }
        }
      }
    }

    if (relatedEntities.length > 0) {
      cacheLogger.debug({ relatedEntities, entityId }, "Related entities invalidated");
    }
  }

  /**
   * Batch invalidation for multiple entities
   */
  async invalidateBatch(
    event: InvalidationEvent,
    entityType: string,
    entityIds: string[]
  ): Promise<void> {
    cacheLogger.info({ event, entityType, count: entityIds.length }, "Starting batch invalidation");

    const promises = entityIds.map((id) => this.invalidate(event, entityType, id));

    await Promise.allSettled(promises);

    cacheLogger.info(
      { event, entityType, count: entityIds.length },
      "Batch invalidation completed"
    );
  }

  /**
   * Invalidate entire entity type (dangerous - use with caution)
   */
  async invalidateAll(entityType: string): Promise<void> {
    cacheLogger.warn({ entityType }, "Invalidating ALL cache for entity type");

    await cache.invalidatePattern(`${entityType}:*`);

    this.recordInvalidation({
      timestamp: new Date(),
      event: InvalidationEvent.BATCH_UPDATED,
      entityType,
      patternsInvalidated: [`${entityType}:*`],
      keysInvalidated: 0, // Unknown count
    });
  }

  /**
   * Publish invalidation event to Redis pub/sub
   * Allows multiple server instances to coordinate cache invalidation
   */
  private async publishInvalidation(
    event: InvalidationEvent,
    entityType: string,
    entityId?: string
  ): Promise<void> {
    try {
      await cache.publish("cache:invalidation", {
        event,
        entityType,
        entityId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      cacheLogger.error(
        { event, entityType, entityId, error },
        "Failed to publish invalidation event"
      );
    }
  }

  /**
   * Record invalidation in history
   */
  private recordInvalidation(record: InvalidationRecord): void {
    this.history.unshift(record);

    // Keep history size under limit
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Get invalidation history
   */
  getHistory(limit?: number): InvalidationRecord[] {
    return limit ? this.history.slice(0, limit) : [...this.history];
  }

  /**
   * Get invalidation statistics
   */
  getStats(): {
    totalInvalidations: number;
    byEvent: Record<string, number>;
    byEntity: Record<string, number>;
    recentInvalidations: number;
  } {
    const byEvent: Record<string, number> = {};
    const byEntity: Record<string, number> = {};

    for (const record of this.history) {
      byEvent[record.event] = (byEvent[record.event] || 0) + 1;
      byEntity[record.entityType] = (byEntity[record.entityType] || 0) + 1;
    }

    // Count recent invalidations (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentInvalidations = this.history.filter((r) => r.timestamp > oneHourAgo).length;

    return {
      totalInvalidations: this.history.length,
      byEvent,
      byEntity,
      recentInvalidations,
    };
  }

  /**
   * Clear invalidation history
   */
  clearHistory(): void {
    this.history = [];
    cacheLogger.info("Invalidation history cleared");
  }
}

// Singleton instance
export const cacheInvalidator = new CacheInvalidator();

// Convenience methods for common operations
export const invalidateOnCreate = (entityType: string, entityId?: string) =>
  cacheInvalidator.invalidate(InvalidationEvent.ENTITY_CREATED, entityType, entityId);

export const invalidateOnUpdate = (entityType: string, entityId?: string, data?: unknown) =>
  cacheInvalidator.invalidate(InvalidationEvent.ENTITY_UPDATED, entityType, entityId, data);

export const invalidateOnDelete = (entityType: string, entityId?: string) =>
  cacheInvalidator.invalidate(InvalidationEvent.ENTITY_DELETED, entityType, entityId);
