import { Worker, Job } from "bullmq";
import { logger } from "../lib/logger";
import { emailService } from "../integrations/email.service";
import { notificationQueries } from "../db/queries/notifications";
import {
	QUEUES,
	type EmailJobData,
	type NotificationCleanupJobData,
	type InvoiceReminderJobData,
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
			const { to, subject, text, html, templateId, templateData } = job.data;

			logger.info({ jobId: job.id, to, subject }, "Processing email job");

			try {
				await emailService.sendEmail({
					to,
					subject,
					text,
					html,
				});

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
		},
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
				return { success: true, deletedCount, cleanedAt: new Date().toISOString() };
			} catch (error) {
				logger.error({ jobId: job.id, error }, "Failed to cleanup notifications");
				throw error;
			}
		},
		{
			connection: REDIS_CONNECTION,
			concurrency: 1,
		},
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
				return { success: true, status: response.status, deliveredAt: new Date().toISOString() };
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
		},
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
	);

	logger.info({ workerCount: workers.length }, "Background workers started");
}

/**
 * Stop all workers
 */
export async function stopWorkers(): Promise<void> {
	logger.info("Stopping background workers...");

	await Promise.all(workers.map((worker) => worker.close()));
	workers.length = 0;

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

