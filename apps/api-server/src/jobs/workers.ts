import { type Job, Worker } from "bullmq";
import {
  documentQueries,
  documentTagAssignmentQueries,
  documentTagQueries,
} from "../db/queries/documents";
import { notificationQueries } from "../db/queries/notifications";
import { emailService } from "../integrations/email.service";
import { logger } from "../lib/logger";
import { aiService } from "../services/ai.service";
import { startInboxWorkers, stopInboxWorkers } from "./inbox-jobs";
import {
  type DocumentProcessingJobData,
  type EmailJobData,
  type NotificationCleanupJobData,
  QUEUES,
  type WebhookDeliveryJobData,
} from "./queue";

// ============================================
// Worker Configuration
// ============================================

const REDIS_CONNECTION = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

const workers: Worker[] = [];

// ============================================
// Email Worker
// ============================================

function createEmailWorker(): Worker {
  const worker = new Worker<EmailJobData>(
    QUEUES.EMAIL,
    async (job: Job<EmailJobData>) => {
      const { to, subject, text, html } = job.data;

      logger.info({ jobId: job.id, to, subject }, "Processing email job");

      try {
        await emailService.send({ to }, subject, html || text || "", text);

        logger.info({ jobId: job.id }, "Email sent successfully");
        return { success: true, sentAt: new Date().toISOString() };
      } catch (error) {
        logger.error({ jobId: job.id, error }, "Failed to send email");
        throw error;
      }
    },
    {
      connection: REDIS_CONNECTION,
      concurrency: 5,
      limiter: {
        max: 50,
        duration: 60000, // 50 emails per minute
      },
    }
  );

  worker.on("completed", (job) => {
    logger.debug({ jobId: job.id, queue: QUEUES.EMAIL }, "Job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, queue: QUEUES.EMAIL, error: err }, "Job failed");
  });

  return worker;
}

// ============================================
// Notification Cleanup Worker
// ============================================

function createNotificationCleanupWorker(): Worker {
  const worker = new Worker<NotificationCleanupJobData>(
    QUEUES.NOTIFICATION_CLEANUP,
    async (job: Job<NotificationCleanupJobData>) => {
      const { daysOld = 30 } = job.data;

      logger.info({ jobId: job.id, daysOld }, "Processing notification cleanup job");

      try {
        const deletedCount = await notificationQueries.deleteOld(daysOld);

        logger.info({ jobId: job.id, deletedCount }, "Notification cleanup completed");
        return {
          success: true,
          deletedCount,
          cleanedAt: new Date().toISOString(),
        };
      } catch (error) {
        logger.error({ jobId: job.id, error }, "Failed to cleanup notifications");
        throw error;
      }
    },
    {
      connection: REDIS_CONNECTION,
      concurrency: 1,
    }
  );

  worker.on("completed", (job) => {
    logger.debug({ jobId: job.id, queue: QUEUES.NOTIFICATION_CLEANUP }, "Job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, queue: QUEUES.NOTIFICATION_CLEANUP, error: err }, "Job failed");
  });

  return worker;
}

// ============================================
// Webhook Delivery Worker
// ============================================

function createWebhookDeliveryWorker(): Worker {
  const worker = new Worker<WebhookDeliveryJobData>(
    QUEUES.WEBHOOK_DELIVERY,
    async (job: Job<WebhookDeliveryJobData>) => {
      const { url, payload, headers = {}, retryCount = 0 } = job.data;

      logger.info({ jobId: job.id, url, retryCount }, "Processing webhook delivery job");

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "CRM-Webhook/1.0",
            ...headers,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Webhook failed with status ${response.status}`);
        }

        logger.info({ jobId: job.id, status: response.status }, "Webhook delivered successfully");
        return {
          success: true,
          status: response.status,
          deliveredAt: new Date().toISOString(),
        };
      } catch (error) {
        logger.error({ jobId: job.id, error }, "Failed to deliver webhook");
        throw error;
      }
    },
    {
      connection: REDIS_CONNECTION,
      concurrency: 10,
      limiter: {
        max: 100,
        duration: 60000, // 100 webhooks per minute
      },
    }
  );

  worker.on("completed", (job) => {
    logger.debug({ jobId: job.id, queue: QUEUES.WEBHOOK_DELIVERY }, "Job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, queue: QUEUES.WEBHOOK_DELIVERY, error: err }, "Job failed");
  });

  return worker;
}

// ============================================
// Document Processing Worker
// ============================================

function createDocumentProcessingWorker(): Worker {
  const worker = new Worker<DocumentProcessingJobData>(
    QUEUES.DOCUMENT_PROCESSING,
    async (job: Job<DocumentProcessingJobData>) => {
      const { documentId, companyId, filePath, mimetype, processingType } = job.data;

      logger.info({ jobId: job.id, documentId, processingType }, "Processing document job");

      try {
        // Update status to processing
        await documentQueries.update(documentId, companyId, {
          processingStatus: "processing",
        });

        // Process based on type
        let result: {
          title?: string;
          summary?: string;
          tags?: string[];
          language?: string;
          content?: string;
        } = {};

        // Check if this is an image that needs OCR
        const isImage = aiService.isImageForOcr(mimetype);

        if (isImage) {
          // Use OCR for images
          try {
            const fileStorage = await import("../services/file-storage.service");
            const imageBuffer = await fileStorage.readFileAsBuffer(filePath);

            if (imageBuffer) {
              const ocrResult = await aiService.extractTextFromImage({
                imageBuffer,
                mimetype,
                filename: filePath[filePath.length - 1],
              });

              if (ocrResult) {
                result = {
                  title: ocrResult.title,
                  summary: ocrResult.summary,
                  tags: ocrResult.tags,
                  content: ocrResult.text,
                };
                logger.info(
                  { jobId: job.id, documentId, textLength: ocrResult.text.length },
                  "OCR extraction completed"
                );
              }
            }
          } catch (ocrError) {
            logger.warn(
              { jobId: job.id, error: ocrError },
              "OCR extraction failed, continuing with basic processing"
            );
          }
        } else if (processingType === "classify" || processingType === "full") {
          // Use AI to classify and extract metadata for non-image files
          try {
            const classificationResult = await aiService.classifyDocument({
              documentId,
              companyId,
              filePath,
              mimetype,
            });
            result = { ...result, ...classificationResult };
          } catch (aiError) {
            logger.warn(
              { jobId: job.id, error: aiError },
              "AI classification failed, continuing with basic processing"
            );
          }
        }

        // Update document with extracted data
        await documentQueries.update(documentId, companyId, {
          title: result.title || undefined,
          summary: result.summary || undefined,
          content: result.content || undefined,
          language: result.language || undefined,
          processingStatus: "completed",
        });

        // Create tags if any were suggested by AI
        if (result.tags && result.tags.length > 0) {
          for (const tagName of result.tags) {
            try {
              const tagSlug = tagName.toLowerCase().replace(/\s+/g, "-");
              // Find or create the tag
              let tag = await documentTagQueries.findBySlug(tagSlug, companyId);
              if (!tag) {
                tag = await documentTagQueries.create({
                  name: tagName,
                  slug: tagSlug,
                  companyId,
                });
              }
              // Assign tag to document
              await documentTagAssignmentQueries.create({
                documentId,
                tagId: tag.id,
                companyId,
              });
            } catch (tagError) {
              logger.warn({ tagError, tagName }, "Failed to create/assign tag in worker");
            }
          }
        }

        logger.info({ jobId: job.id, documentId }, "Document processing completed");

        return {
          success: true,
          documentId,
          processedAt: new Date().toISOString(),
          ...result,
        };
      } catch (error) {
        logger.error({ jobId: job.id, documentId, error }, "Failed to process document");

        // Update status to failed
        await documentQueries.update(documentId, companyId, {
          processingStatus: "failed",
        });

        throw error;
      }
    },
    {
      connection: REDIS_CONNECTION,
      concurrency: 3,
      limiter: {
        max: 10,
        duration: 60000, // 10 documents per minute
      },
    }
  );

  worker.on("completed", (job) => {
    logger.debug({ jobId: job.id, queue: QUEUES.DOCUMENT_PROCESSING }, "Job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, queue: QUEUES.DOCUMENT_PROCESSING, error: err }, "Job failed");
  });

  return worker;
}

// ============================================
// Worker Management
// ============================================

/**
 * Start all workers
 */
export function startWorkers(): void {
  logger.info("Starting background workers...");

  workers.push(
    createEmailWorker(),
    createNotificationCleanupWorker(),
    createWebhookDeliveryWorker(),
    createDocumentProcessingWorker()
  );

  // Start inbox workers (OCR, embedding, matching)
  startInboxWorkers();

  logger.info({ workerCount: workers.length }, "Background workers started");
}

/**
 * Stop all workers
 */
export async function stopWorkers(): Promise<void> {
  logger.info("Stopping background workers...");

  await Promise.all(workers.map((worker) => worker.close()));
  workers.length = 0;

  // Stop inbox workers
  await stopInboxWorkers();

  logger.info("Background workers stopped");
}

/**
 * Get worker statuses
 */
export function getWorkerStatuses(): { queue: string; running: boolean }[] {
  return workers.map((worker) => ({
    queue: worker.name,
    running: worker.isRunning(),
  }));
}

export default {
  startWorkers,
  stopWorkers,
  getWorkerStatuses,
};
