/**
 * Simple In-Memory Job Queue Service
 * Works without Redis - provides basic job queue functionality
 * with retry logic and persistence to SQLite
 */

import { sql as db } from "../db/client";
import { serviceLogger } from "../lib/logger";

// ==============================================
// TYPES
// ==============================================

export type JobStatus = "pending" | "processing" | "completed" | "failed" | "retrying";

export interface Job<T = unknown> {
  id: string;
  queue: string;
  data: T;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  updatedAt: Date;
  processAfter: Date;
  error?: string;
  result?: unknown;
}

export type JobHandler<T = unknown, R = unknown> = (job: Job<T>) => Promise<R>;

interface QueueOptions {
  concurrency?: number;
  maxAttempts?: number;
  retryDelay?: number; // ms
  pollInterval?: number; // ms
}

// ==============================================
// SIMPLE QUEUE CLASS
// ==============================================

export class SimpleQueue<T = unknown> {
  private name: string;
  private handler: JobHandler<T> | null = null;
  private options: Required<QueueOptions>;
  private processing = 0;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  constructor(name: string, options: QueueOptions = {}) {
    this.name = name;
    this.options = {
      concurrency: options.concurrency ?? 2,
      maxAttempts: options.maxAttempts ?? 3,
      retryDelay: options.retryDelay ?? 5000,
      pollInterval: options.pollInterval ?? 1000,
    };
  }

  /**
   * Add a job to the queue
   */
  async add(data: T, options: { delay?: number; jobId?: string } = {}): Promise<string> {
    const id = options.jobId || `${this.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const processAfter = options.delay ? new Date(Date.now() + options.delay) : new Date();

    try {
      await db`
        INSERT INTO job_queue (id, queue, data, status, attempts, max_attempts, process_after)
        VALUES (
          ${id},
          ${this.name},
          ${JSON.stringify(data)}::jsonb,
          'pending',
          0,
          ${this.options.maxAttempts},
          ${processAfter.toISOString()}::timestamp
        )
        ON CONFLICT (id) DO NOTHING
      `;

      serviceLogger.debug({ queue: this.name, jobId: id }, "Job added to queue");
      return id;
    } catch (error) {
      serviceLogger.error({ error, queue: this.name }, "Failed to add job to queue");
      throw error;
    }
  }

  /**
   * Process jobs with the given handler
   */
  process(handler: JobHandler<T>): void {
    this.handler = handler;
    this.start();
  }

  /**
   * Start processing jobs
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    serviceLogger.info({ queue: this.name }, "Starting queue worker");

    this.pollTimer = setInterval(() => {
      this.poll();
    }, this.options.pollInterval);

    // Initial poll
    this.poll();
  }

  /**
   * Stop processing jobs
   */
  stop(): void {
    this.isRunning = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    serviceLogger.info({ queue: this.name }, "Queue worker stopped");
  }

  /**
   * Poll for jobs and process them
   */
  private async poll(): Promise<void> {
    if (!this.handler || !this.isRunning) return;
    if (this.processing >= this.options.concurrency) return;

    try {
      // Get pending jobs that are ready to process
      const jobs = await db`
        SELECT * FROM job_queue
        WHERE queue = ${this.name}
          AND status IN ('pending', 'retrying')
          AND process_after <= NOW()
        ORDER BY created_at ASC
        LIMIT ${this.options.concurrency - this.processing}
        FOR UPDATE SKIP LOCKED
      `;

      for (const jobRow of jobs) {
        this.processJob(jobRow as Record<string, unknown>);
      }
    } catch (error) {
      // Table might not exist yet, that's okay
      if ((error as Error).message?.includes("does not exist")) {
        return;
      }
      serviceLogger.error({ error, queue: this.name }, "Error polling for jobs");
    }
  }

  /**
   * Process a single job
   */
  private async processJob(jobRow: Record<string, unknown>): Promise<void> {
    if (!this.handler) return;

    this.processing++;

    const job: Job<T> = {
      id: jobRow.id as string,
      queue: jobRow.queue as string,
      data:
        typeof jobRow.data === "string" ? JSON.parse(jobRow.data as string) : (jobRow.data as T),
      status: "processing",
      attempts: (jobRow.attempts as number) + 1,
      maxAttempts: (jobRow.max_attempts as number) || this.options.maxAttempts,
      createdAt: new Date(jobRow.created_at as string),
      updatedAt: new Date(),
      processAfter: new Date(jobRow.process_after as string),
    };

    try {
      // Mark as processing
      await db`
        UPDATE job_queue
        SET status = 'processing', attempts = ${job.attempts}, updated_at = NOW()
        WHERE id = ${job.id}
      `;

      serviceLogger.debug(
        { queue: this.name, jobId: job.id, attempt: job.attempts },
        "Processing job"
      );

      // Execute handler
      const result = await this.handler(job);

      // Mark as completed
      await db`
        UPDATE job_queue
        SET status = 'completed', result = ${JSON.stringify(result)}::jsonb, updated_at = NOW()
        WHERE id = ${job.id}
      `;

      serviceLogger.info({ queue: this.name, jobId: job.id }, "Job completed");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      serviceLogger.error({ error, queue: this.name, jobId: job.id }, "Job failed");

      if (job.attempts < job.maxAttempts) {
        // Retry with exponential backoff
        const delay = this.options.retryDelay * 2 ** (job.attempts - 1);
        const processAfter = new Date(Date.now() + delay);

        await db`
          UPDATE job_queue
          SET status = 'retrying', error = ${errorMessage}, process_after = ${processAfter.toISOString()}::timestamp, updated_at = NOW()
          WHERE id = ${job.id}
        `;

        serviceLogger.info(
          { queue: this.name, jobId: job.id, nextAttempt: processAfter },
          "Job scheduled for retry"
        );
      } else {
        // Mark as failed
        await db`
          UPDATE job_queue
          SET status = 'failed', error = ${errorMessage}, updated_at = NOW()
          WHERE id = ${job.id}
        `;

        serviceLogger.error({ queue: this.name, jobId: job.id }, "Job permanently failed");
      }
    } finally {
      this.processing--;
    }
  }

  /**
   * Get queue stats
   */
  async getStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    retrying: number;
  }> {
    const result = await db`
      SELECT status, COUNT(*)::int as count
      FROM job_queue
      WHERE queue = ${this.name}
      GROUP BY status
    `;

    const stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      retrying: 0,
    };

    for (const row of result) {
      const status = row.status as JobStatus;
      if (status in stats) {
        stats[status] = row.count as number;
      }
    }

    return stats;
  }

  /**
   * Remove completed jobs older than the given age
   */
  async cleanup(maxAge: number = 24 * 60 * 60 * 1000): Promise<number> {
    const cutoff = new Date(Date.now() - maxAge);
    const result = await db`
      DELETE FROM job_queue
      WHERE queue = ${this.name}
        AND status = 'completed'
        AND updated_at < ${cutoff.toISOString()}::timestamp
    `;
    return result.count;
  }
}

// ==============================================
// QUEUE MANAGER
// ==============================================

class QueueManager {
  private queues: Map<string, SimpleQueue> = new Map();
  private initialized = false;

  /**
   * Initialize the job queue table
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await db`
        CREATE TABLE IF NOT EXISTS job_queue (
          id VARCHAR(255) PRIMARY KEY,
          queue VARCHAR(100) NOT NULL,
          data JSONB NOT NULL DEFAULT '{}',
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          attempts INTEGER NOT NULL DEFAULT 0,
          max_attempts INTEGER NOT NULL DEFAULT 3,
          process_after TIMESTAMP NOT NULL DEFAULT NOW(),
          error TEXT,
          result JSONB,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `;

      await db`
        CREATE INDEX IF NOT EXISTS idx_job_queue_queue_status
        ON job_queue (queue, status, process_after)
      `;

      this.initialized = true;
      serviceLogger.info("Job queue table initialized");
    } catch (error) {
      serviceLogger.error({ error }, "Failed to initialize job queue table");
      throw error;
    }
  }

  /**
   * Get or create a queue
   */
  getQueue<T = unknown>(name: string, options?: QueueOptions): SimpleQueue<T> {
    if (!this.queues.has(name)) {
      const queue = new SimpleQueue<T>(name, options);
      this.queues.set(name, queue as SimpleQueue);
    }
    return this.queues.get(name) as SimpleQueue<T>;
  }

  /**
   * Stop all queues
   */
  stopAll(): void {
    for (const queue of this.queues.values()) {
      queue.stop();
    }
    this.queues.clear();
  }
}

// Singleton instance
export const queueManager = new QueueManager();

// ==============================================
// EXPORTS
// ==============================================

export default {
  SimpleQueue,
  queueManager,
};
