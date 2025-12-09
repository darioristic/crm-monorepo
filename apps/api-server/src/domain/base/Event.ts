/**
 * Base Event Class for Event Sourcing
 * All domain events must extend this class
 */

export interface EventMetadata {
  tenantId: string;
  userId?: string;
  correlationId?: string;
  causationId?: string;
  timestamp: Date;
  [key: string]: unknown;
}

export abstract class DomainEvent<TData = unknown> {
  public readonly eventId: string;
  public readonly aggregateId: string;
  public readonly aggregateType: string;
  public readonly eventType: string;
  public readonly eventVersion: number;
  public readonly eventData: TData;
  public readonly metadata: EventMetadata;
  public readonly occurredAt: Date;

  constructor(params: {
    eventId?: string;
    aggregateId: string;
    aggregateType: string;
    eventType: string;
    eventVersion: number;
    eventData: TData;
    metadata: EventMetadata;
    occurredAt?: Date;
  }) {
    this.eventId = params.eventId || crypto.randomUUID();
    this.aggregateId = params.aggregateId;
    this.aggregateType = params.aggregateType;
    this.eventType = params.eventType;
    this.eventVersion = params.eventVersion;
    this.eventData = params.eventData;
    this.metadata = params.metadata;
    this.occurredAt = params.occurredAt || new Date();
  }

  /**
   * Serialize event for storage
   */
  public toJSON(): Record<string, unknown> {
    return {
      eventId: this.eventId,
      aggregateId: this.aggregateId,
      aggregateType: this.aggregateType,
      eventType: this.eventType,
      eventVersion: this.eventVersion,
      eventData: this.eventData,
      metadata: this.metadata,
      occurredAt: this.occurredAt.toISOString(),
    };
  }
}

/**
 * Helper type for extracting event data type
 */
export type EventData<T> = T extends DomainEvent<infer D> ? D : never;
