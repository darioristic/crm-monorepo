import { type Job, Queue, Worker } from "bullmq";
import { logger } from "../lib/logger";

const connection = {
  host: process.env.REDIS_HOST || "redis",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

export const QUEUE_FIRECRAWL = "firecrawl-batch";

export interface BatchScrapeJobData {
  tenantId: string;
  userId?: string;
  urls: string[];
  options?: Record<string, unknown>;
}

export const queue = new Queue(QUEUE_FIRECRAWL, { connection });

export async function addBatchScrapeJob(data: BatchScrapeJobData): Promise<Job> {
  return queue.add(QUEUE_FIRECRAWL, data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { count: 100, age: 24 * 3600 },
    removeOnFail: { count: 500, age: 7 * 24 * 3600 },
  });
}

async function processBatch(job: Job<BatchScrapeJobData>): Promise<{ processed: number }> {
  logger.info({ id: job.id, urls: job.data.urls.length }, "Processing Firecrawl batch scrape");
  // Placeholder: in real worker we'd call firecrawlService.request for each URL
  // and push results to a sink
  return { processed: job.data.urls.length };
}

export function startWorker(): void {
  const worker = new Worker(
    QUEUE_FIRECRAWL,
    async (job) => processBatch(job as Job<BatchScrapeJobData>),
    { connection }
  );
  worker.on("completed", (job) => logger.info({ id: job.id }, "Batch job completed"));
  worker.on("failed", (job, err) => logger.error({ id: job?.id, err }, "Batch job failed"));
}

startWorker();
