/**
 * Base Aggregate Root for Event Sourcing
 * Aggregates are the consistency boundary in DDD
 */

import type { DomainEvent, EventMetadata } from "./Event";

export abstract class AggregateRoot {
  private uncommittedEvents: DomainEvent[] = [];
  private _version: number = 0;

  constructor(
    public readonly id: string,
    public readonly type: string
  ) {}

  /**
   * Current version of the aggregate (number of events applied)
   */
  public get version(): number {
    return this._version;
  }

  /**
   * Apply an event to the aggregate (for event replay)
   */
  protected applyEvent(event: DomainEvent): void {
    this.mutate(event);
    this._version++;
  }

  /**
   * Raise a new event (for new domain events)
   */
  protected raiseEvent(event: DomainEvent): void {
    this.mutate(event);
    this.uncommittedEvents.push(event);
    this._version++;
  }

  /**
   * Subclasses implement this to update their state based on events
   */
  protected abstract mutate(event: DomainEvent): void;

  /**
   * Get uncommitted events (to be saved to event store)
   */
  public getUncommittedEvents(): DomainEvent[] {
    return [...this.uncommittedEvents];
  }

  /**
   * Mark all events as committed
   */
  public markEventsAsCommitted(): void {
    this.uncommittedEvents = [];
  }

  /**
   * Load aggregate from event history
   */
  public loadFromHistory(events: DomainEvent[]): void {
    for (const event of events) {
      this.applyEvent(event);
    }
  }

  /**
   * Create metadata for events
   */
  protected createMetadata(tenantId: string, userId?: string): EventMetadata {
    return {
      tenantId,
      userId,
      timestamp: new Date(),
      aggregateVersion: this.version + 1,
    };
  }
}

/**
 * Domain Error for business rule violations
 */
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "DomainError";
  }
}

/**
 * Validation helper
 */
export function ensureBusinessRule(
  condition: boolean,
  message: string,
  code: string = "BUSINESS_RULE_VIOLATION"
): asserts condition {
  if (!condition) {
    throw new DomainError(message, code);
  }
}
