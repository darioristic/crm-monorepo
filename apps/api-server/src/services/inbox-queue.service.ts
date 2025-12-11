/**
 * Inbox Queue Service
 * Uses simple in-memory queue (no Redis required)
 * Processes inbox items with OCR, embeddings, and matching
 */

import { serviceLogger } from "../lib/logger";
import { processInboxItem } from "./inbox-ai.service";
import { type Job, queueManager, type SimpleQueue } from "./simple-queue.service";

// ==============================================
// TYPES
// ==============================================

export interface InboxProcessJobData {
  inboxId: string;
  tenantId: string;
  generateEmbeddings?: boolean;
}

// ==============================================
// QUEUE SETUP
// ==============================================

let inboxQueue: SimpleQueue<InboxProcessJobData> | null = null;
let isInitialized = false;

/**
 * Initialize the inbox queue
 */
export async function initializeInboxQueue(): Promise<void> {
  if (isInitialized) return;

  try {
    // Initialize queue manager (creates table if needed)
    await queueManager.initialize();

    // Create inbox processing queue
    inboxQueue = queueManager.getQueue<InboxProcessJobData>("inbox-process", {
      concurrency: 2,
      maxAttempts: 3,
      retryDelay: 5000,
      pollInterval: 2000,
    });

    // Set up job handler
    inboxQueue.process(async (job: Job<InboxProcessJobData>) => {
      const { inboxId, tenantId, generateEmbeddings } = job.data;

      serviceLogger.info(
        { jobId: job.id, inboxId, attempt: job.attempts },
        "Processing inbox item"
      );

      const result = await processInboxItem(inboxId, tenantId, {
        generateEmbeddings: generateEmbeddings ?? false,
      });

      if (!result.success) {
        throw new Error(result.error || "Processing failed");
      }

      return {
        inboxId,
        ocrConfidence: result.ocrResult?.confidence,
        embeddingCreated: result.embeddingCreated,
      };
    });

    isInitialized = true;
    serviceLogger.info("Inbox queue initialized");
  } catch (error) {
    serviceLogger.error({ error }, "Failed to initialize inbox queue");
    throw error;
  }
}

/**
 * Add an inbox item to the processing queue
 */
export async function queueInboxProcessing(
  inboxId: string,
  tenantId: string,
  options: {
    generateEmbeddings?: boolean;
    delay?: number;
  } = {}
): Promise<string> {
  if (!inboxQueue) {
    await initializeInboxQueue();
  }

  if (!inboxQueue) {
    throw new Error("Inbox queue not initialized");
  }

  const jobId = await inboxQueue.add(
    {
      inboxId,
      tenantId,
      generateEmbeddings: options.generateEmbeddings ?? false,
    },
    {
      delay: options.delay,
      jobId: `inbox-${inboxId}`,
    }
  );

  serviceLogger.info({ jobId, inboxId }, "Inbox item queued for processing");
  return jobId;
}

/**
 * Get queue statistics
 */
export async function getInboxQueueStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  retrying: number;
}> {
  if (!inboxQueue) {
    return { pending: 0, processing: 0, completed: 0, failed: 0, retrying: 0 };
  }

  return inboxQueue.getStats();
}

/**
 * Stop the inbox queue
 */
export function stopInboxQueue(): void {
  if (inboxQueue) {
    inboxQueue.stop();
    inboxQueue = null;
    isInitialized = false;
    serviceLogger.info("Inbox queue stopped");
  }
}

/**
 * Cleanup old completed jobs
 */
export async function cleanupInboxQueue(maxAge?: number): Promise<number> {
  if (!inboxQueue) {
    return 0;
  }
  return inboxQueue.cleanup(maxAge);
}

// ==============================================
// EXPORTS
// ==============================================

export default {
  initializeInboxQueue,
  queueInboxProcessing,
  getInboxQueueStats,
  stopInboxQueue,
  cleanupInboxQueue,
};
