import type { Job } from "bullmq";
import { Queue } from "bullmq";
import { logger } from "../lib/logger";

// ============================================
// Queue Configuration
// ============================================

const REDIS_CONNECTION = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

// ============================================
// Job Types
// ============================================

export interface EmailJobData {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  templateId?: string;
  templateData?: Record<string, unknown>;
}

export interface NotificationCleanupJobData {
  daysOld?: number;
}

export interface InvoiceReminderJobData {
  invoiceId: string;
  userId: string;
}

export interface ReportGenerationJobData {
  reportType: "sales" | "projects" | "users";
  filters: Record<string, unknown>;
  userId: string;
  format: "pdf" | "csv" | "xlsx";
}

export interface WebhookDeliveryJobData {
  url: string;
  payload: Record<string, unknown>;
  headers?: Record<string, string>;
  retryCount?: number;
}

export interface DocumentProcessingJobData {
  documentId: string;
  companyId: string;
  filePath: string[];
  mimetype: string;
  processingType: "classify" | "extract" | "full";
}

export type JobData =
  | EmailJobData
  | NotificationCleanupJobData
  | InvoiceReminderJobData
  | ReportGenerationJobData
  | WebhookDeliveryJobData
  | DocumentProcessingJobData;

// ============================================
// Queue Definitions
// ============================================

export const QUEUES = {
  EMAIL: "email",
  NOTIFICATION_CLEANUP: "notification-cleanup",
  INVOICE_REMINDER: "invoice-reminder",
  REPORT_GENERATION: "report-generation",
  WEBHOOK_DELIVERY: "webhook-delivery",
  DOCUMENT_PROCESSING: "document-processing",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

// Queue instances
const queues: Map<QueueName, Queue> = new Map();

/**
 * Get or create a queue
 */
export function getQueue(name: QueueName): Queue {
  if (!queues.has(name)) {
    const queue = new Queue(name, {
      connection: REDIS_CONNECTION,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: {
          count: 100,
          age: 24 * 3600, // 24 hours
        },
        removeOnFail: {
          count: 500,
          age: 7 * 24 * 3600, // 7 days
        },
      },
    });

    queues.set(name, queue);
    logger.info({ queue: name }, "Queue created");
  }

  return queues.get(name)!;
}

// ============================================
// Job Scheduling
// ============================================

/**
 * Add a job to a queue
 */
export async function addJob<T extends JobData>(
  queueName: QueueName,
  data: T,
  options?: {
    delay?: number;
    priority?: number;
    jobId?: string;
    repeat?: {
      pattern?: string; // cron pattern
      every?: number; // milliseconds
      limit?: number;
    };
  }
): Promise<Job<T>> {
  const queue = getQueue(queueName);

  const job = await queue.add(queueName, data, {
    delay: options?.delay,
    priority: options?.priority,
    jobId: options?.jobId,
    repeat: options?.repeat,
  });

  logger.debug({ queue: queueName, jobId: job.id }, "Job added to queue");
  return job as Job<T>;
}

/**
 * Add email job
 */
export async function addEmailJob(
  data: EmailJobData,
  options?: { delay?: number; priority?: number }
): Promise<Job<EmailJobData>> {
  return addJob(QUEUES.EMAIL, data, options);
}

/**
 * Add document processing job
 */
export async function addDocumentProcessingJob(
  data: DocumentProcessingJobData,
  options?: { delay?: number; priority?: number }
): Promise<Job<DocumentProcessingJobData>> {
  return addJob(QUEUES.DOCUMENT_PROCESSING, data, {
    ...options,
    jobId: `doc-${data.documentId}`,
  });
}

/**
 * Schedule notification cleanup (runs daily)
 */
export async function scheduleNotificationCleanup(): Promise<void> {
  const queue = getQueue(QUEUES.NOTIFICATION_CLEANUP);

  // Remove any existing repeatable job
  const repeatableJobs = await queue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await queue.removeRepeatableByKey(job.key);
  }

  // Add new repeatable job (runs at 3 AM daily)
  await addJob(
    QUEUES.NOTIFICATION_CLEANUP,
    { daysOld: 30 },
    {
      repeat: {
        pattern: "0 3 * * *", // Every day at 3 AM
      },
      jobId: "notification-cleanup-daily",
    }
  );

  logger.info("Notification cleanup scheduled for daily execution at 3 AM");
}

/**
 * Schedule invoice reminder check
 */
export async function scheduleInvoiceReminderCheck(): Promise<void> {
  const queue = getQueue(QUEUES.INVOICE_REMINDER);

  // Remove any existing repeatable job
  const repeatableJobs = await queue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await queue.removeRepeatableByKey(job.key);
  }

  // This is a placeholder - you'd add specific invoice IDs when invoices become overdue
  logger.info("Invoice reminder system initialized");
}

// ============================================
// Queue Status
// ============================================

export interface QueueStatus {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

/**
 * Get status of all queues
 */
export async function getQueuesStatus(): Promise<QueueStatus[]> {
  const statuses: QueueStatus[] = [];

  for (const [name, queue] of queues) {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    const isPaused = await queue.isPaused();

    statuses.push({
      name,
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused: isPaused,
    });
  }

  return statuses;
}

/**
 * Get jobs from a queue
 */
export async function getJobs(
  queueName: QueueName,
  status: "waiting" | "active" | "completed" | "failed" | "delayed",
  start = 0,
  end = 20
): Promise<Job[]> {
  const queue = getQueue(queueName);
  return queue.getJobs([status], start, end);
}

// ============================================
// Cleanup
// ============================================

/**
 * Close all queue connections
 */
export async function closeQueues(): Promise<void> {
  for (const [name, queue] of queues) {
    await queue.close();
    logger.info({ queue: name }, "Queue closed");
  }
  queues.clear();
}

export default {
  getQueue,
  addJob,
  addEmailJob,
  addDocumentProcessingJob,
  scheduleNotificationCleanup,
  scheduleInvoiceReminderCheck,
  getQueuesStatus,
  getJobs,
  closeQueues,
  QUEUES,
};
