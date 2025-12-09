/**
 * Event Store Implementation
 * Persists and retrieves domain events from PostgreSQL
 */

import { sql } from "../db/client";
import type { DomainEvent, EventMetadata } from "../domain/base/Event";
import { logger } from "../lib/logger";

export interface StoredEvent {
  id: string;
  aggregate_id: string;
  aggregate_type: string;
  event_type: string;
  event_version: number;
  event_data: Record<string, unknown>;
  metadata: EventMetadata;
  tenant_id: string;
  user_id: string | null;
  occurred_at: Date;
  sequence_number: number;
}

export class EventStore {
  /**
   * Append events to the event store
   */
  async append(events: DomainEvent[]): Promise<void> {
    if (events.length === 0) return;

    try {
      await sql.begin(async (tx) => {
        for (const event of events) {
          await tx`
            INSERT INTO event_store (
              id,
              aggregate_id,
              aggregate_type,
              event_type,
              event_version,
              event_data,
              metadata,
              tenant_id,
              user_id,
              occurred_at
            ) VALUES (
              ${event.eventId},
              ${event.aggregateId},
              ${event.aggregateType},
              ${event.eventType},
              ${event.eventVersion},
              ${JSON.stringify(event.eventData)},
              ${JSON.stringify(event.metadata)},
              ${event.metadata.tenantId},
              ${event.metadata.userId || null},
              ${event.occurredAt}
            )
          `;
        }
      });

      logger.info(
        { count: events.length, aggregateId: events[0].aggregateId },
        "Events appended to event store"
      );
    } catch (error) {
      logger.error({ error, events }, "Failed to append events");
      throw new Error("Failed to append events to event store");
    }
  }

  /**
   * Get all events for an aggregate
   */
  async getEventsForAggregate(
    aggregateId: string,
    fromVersion: number = 0
  ): Promise<StoredEvent[]> {
    try {
      const events = await sql<StoredEvent[]>`
        SELECT *
        FROM event_store
        WHERE aggregate_id = ${aggregateId}
          AND event_version > ${fromVersion}
        ORDER BY event_version ASC
      `;

      return events;
    } catch (error) {
      logger.error({ error, aggregateId }, "Failed to get events for aggregate");
      throw new Error("Failed to retrieve events from event store");
    }
  }

  /**
   * Get events by type
   */
  async getEventsByType(
    eventType: string,
    tenantId: string,
    limit: number = 100
  ): Promise<StoredEvent[]> {
    try {
      const events = await sql<StoredEvent[]>`
        SELECT *
        FROM event_store
        WHERE event_type = ${eventType}
          AND tenant_id = ${tenantId}
        ORDER BY occurred_at DESC
        LIMIT ${limit}
      `;

      return events;
    } catch (error) {
      logger.error({ error, eventType }, "Failed to get events by type");
      throw new Error("Failed to retrieve events by type");
    }
  }

  /**
   * Get all events since a sequence number (for projections)
   */
  async getEventsSince(sequenceNumber: number, batchSize: number = 100): Promise<StoredEvent[]> {
    try {
      const events = await sql<StoredEvent[]>`
        SELECT *
        FROM event_store
        WHERE sequence_number > ${sequenceNumber}
        ORDER BY sequence_number ASC
        LIMIT ${batchSize}
      `;

      return events;
    } catch (error) {
      logger.error({ error, sequenceNumber }, "Failed to get events since sequence");
      throw new Error("Failed to retrieve events");
    }
  }

  /**
   * Get event stream for a tenant (for timeline view)
   */
  async getEventStreamForTenant(
    tenantId: string,
    options: {
      limit?: number;
      offset?: number;
      aggregateType?: string;
      fromDate?: Date;
      toDate?: Date;
    } = {}
  ): Promise<{ events: StoredEvent[]; total: number }> {
    const { limit = 50, offset = 0, aggregateType, fromDate, toDate } = options;

    try {
      let whereConditions = sql`tenant_id = ${tenantId}`;

      if (aggregateType) {
        whereConditions = sql`${whereConditions} AND aggregate_type = ${aggregateType}`;
      }

      if (fromDate) {
        whereConditions = sql`${whereConditions} AND occurred_at >= ${fromDate}`;
      }

      if (toDate) {
        whereConditions = sql`${whereConditions} AND occurred_at <= ${toDate}`;
      }

      // Get total count
      const [{ count }] = await sql<[{ count: number }]>`
        SELECT COUNT(*) as count
        FROM event_store
        WHERE ${whereConditions}
      `;

      // Get events
      const events = await sql<StoredEvent[]>`
        SELECT *
        FROM event_store
        WHERE ${whereConditions}
        ORDER BY occurred_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      return {
        events,
        total: count,
      };
    } catch (error) {
      logger.error({ error, tenantId }, "Failed to get event stream");
      throw new Error("Failed to retrieve event stream");
    }
  }

  /**
   * Get document timeline (all related events across documents)
   */
  async getDocumentTimeline(aggregateId: string, tenantId: string): Promise<StoredEvent[]> {
    try {
      // This would ideally traverse the document_relationships table
      // For now, just get events for the aggregate
      const events = await sql<StoredEvent[]>`
        SELECT *
        FROM event_store
        WHERE aggregate_id = ${aggregateId}
          AND tenant_id = ${tenantId}
        ORDER BY occurred_at ASC
      `;

      return events;
    } catch (error) {
      logger.error({ error, aggregateId }, "Failed to get document timeline");
      throw new Error("Failed to retrieve document timeline");
    }
  }

  /**
   * Update subscription checkpoint
   */
  async updateSubscriptionCheckpoint(
    subscriptionId: string,
    lastProcessedSequence: number
  ): Promise<void> {
    try {
      await sql`
        INSERT INTO event_subscriptions (subscription_id, last_processed_sequence, last_processed_at)
        VALUES (${subscriptionId}, ${lastProcessedSequence}, NOW())
        ON CONFLICT (subscription_id)
        DO UPDATE SET
          last_processed_sequence = ${lastProcessedSequence},
          last_processed_at = NOW(),
          status = 'active',
          error_message = NULL
      `;
    } catch (error) {
      logger.error({ error, subscriptionId }, "Failed to update subscription checkpoint");
      throw error;
    }
  }

  /**
   * Get subscription checkpoint
   */
  async getSubscriptionCheckpoint(subscriptionId: string): Promise<number> {
    try {
      const [result] = await sql<[{ last_processed_sequence: number } | undefined]>`
        SELECT last_processed_sequence
        FROM event_subscriptions
        WHERE subscription_id = ${subscriptionId}
      `;

      return result?.last_processed_sequence ?? 0;
    } catch (error) {
      logger.error({ error, subscriptionId }, "Failed to get subscription checkpoint");
      return 0;
    }
  }
}

// Singleton instance
export const eventStore = new EventStore();
