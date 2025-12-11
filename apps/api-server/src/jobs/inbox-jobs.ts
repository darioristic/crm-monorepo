/**
 * Inbox Background Jobs
 * Handles OCR, embedding generation, and transaction matching for Magic Inbox
 */

import { type Job, Worker } from "bullmq";
import { sql as db } from "../db/client";
import { serviceLogger } from "../lib/logger";
import { processDocument, type OCRResult } from "../services/document-ocr";
import { generateEmbedding } from "../services/embeddings";
import { findMatchesForInbox } from "../services/inbox-matching";
import type {
  InboxOCRJobData,
  InboxEmbeddingJobData,
  InboxMatchingJobData,
  InboxFullProcessJobData,
} from "./queue";

// ==============================================
// QUEUE NAMES (for worker configuration)
// ==============================================

const INBOX_QUEUES = {
  OCR: "inbox-ocr",
  EMBEDDING: "inbox-embedding",
  MATCHING: "inbox-matching",
  FULL_PROCESS: "inbox-full-process",
} as const;

// ==============================================
// REDIS CONNECTION
// ==============================================

const REDIS_CONNECTION = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

// ==============================================
// WORKERS
// ==============================================

const inboxWorkers: Worker[] = [];

/**
 * OCR Worker - extracts text from documents
 */
function createInboxOCRWorker(): Worker {
  const worker = new Worker<InboxOCRJobData>(
    INBOX_QUEUES.OCR,
    async (job: Job<InboxOCRJobData>) => {
      const { inboxId, tenantId, filePath, mimeType } = job.data;

      serviceLogger.info({ jobId: job.id, inboxId }, "Processing inbox OCR job");

      try {
        // Update status to processing
        await db`
          UPDATE inbox SET status = 'processing', updated_at = NOW()
          WHERE id = ${inboxId} AND tenant_id = ${tenantId}
        `;

        // Read file from storage
        const fs = await import("fs/promises");
        const path = await import("path");
        const vaultPath = process.env.VAULT_PATH || "./vault";
        const fullPath = path.join(vaultPath, ...filePath);

        const fileBuffer = await fs.readFile(fullPath);

        // Process document with OCR
        const ocrResult = await processDocument(fileBuffer, mimeType);

        // Update inbox with extracted data
        await db`
          UPDATE inbox
          SET
            extracted_text = ${ocrResult.text},
            ocr_confidence = ${ocrResult.confidence},
            amount = COALESCE(${ocrResult.extractedData?.totalAmount || null}, amount),
            currency = COALESCE(${ocrResult.extractedData?.currency || null}, currency),
            date = COALESCE(${ocrResult.extractedData?.invoiceDate || null}::timestamp, date),
            reference_id = COALESCE(${ocrResult.extractedData?.invoiceNumber || null}, reference_id),
            status = 'pending',
            updated_at = NOW()
          WHERE id = ${inboxId} AND tenant_id = ${tenantId}
        `;

        serviceLogger.info(
          { jobId: job.id, inboxId, confidence: ocrResult.confidence },
          "Inbox OCR completed"
        );

        return {
          success: true,
          inboxId,
          confidence: ocrResult.confidence,
          extractedData: ocrResult.extractedData,
        };
      } catch (error) {
        serviceLogger.error({ jobId: job.id, inboxId, error }, "Inbox OCR failed");

        // Update status to failed
        await db`
          UPDATE inbox SET status = 'new', updated_at = NOW()
          WHERE id = ${inboxId} AND tenant_id = ${tenantId}
        `;

        throw error;
      }
    },
    {
      connection: REDIS_CONNECTION,
      concurrency: 2, // OCR is CPU-intensive
      limiter: {
        max: 5,
        duration: 60000, // 5 per minute
      },
    }
  );

  worker.on("completed", (job) => {
    serviceLogger.debug({ jobId: job.id, queue: INBOX_QUEUES.OCR }, "Job completed");
  });

  worker.on("failed", (job, err) => {
    serviceLogger.error({ jobId: job?.id, queue: INBOX_QUEUES.OCR, error: err }, "Job failed");
  });

  return worker;
}

/**
 * Embedding Worker - generates vector embeddings for inbox items
 */
function createInboxEmbeddingWorker(): Worker {
  const worker = new Worker<InboxEmbeddingJobData>(
    INBOX_QUEUES.EMBEDDING,
    async (job: Job<InboxEmbeddingJobData>) => {
      const { inboxId, tenantId, text } = job.data;

      serviceLogger.info({ jobId: job.id, inboxId }, "Processing inbox embedding job");

      try {
        // Generate embedding
        const result = await generateEmbedding(text);

        // Store embedding in database
        await db`
          INSERT INTO inbox_embeddings (tenant_id, inbox_id, embedding, source_text, model)
          VALUES (
            ${tenantId},
            ${inboxId},
            ${JSON.stringify(result.embedding)}::vector,
            ${text},
            ${result.model}
          )
          ON CONFLICT (inbox_id)
          DO UPDATE SET
            embedding = ${JSON.stringify(result.embedding)}::vector,
            source_text = ${text},
            model = ${result.model},
            updated_at = NOW()
        `;

        serviceLogger.info({ jobId: job.id, inboxId }, "Inbox embedding generated");

        return {
          success: true,
          inboxId,
          model: result.model,
          dimensions: result.embedding.length,
        };
      } catch (error) {
        serviceLogger.error({ jobId: job.id, inboxId, error }, "Inbox embedding failed");
        throw error;
      }
    },
    {
      connection: REDIS_CONNECTION,
      concurrency: 5,
      limiter: {
        max: 30,
        duration: 60000, // 30 per minute (API rate limit)
      },
    }
  );

  worker.on("completed", (job) => {
    serviceLogger.debug({ jobId: job.id, queue: INBOX_QUEUES.EMBEDDING }, "Job completed");
  });

  worker.on("failed", (job, err) => {
    serviceLogger.error({ jobId: job?.id, queue: INBOX_QUEUES.EMBEDDING, error: err }, "Job failed");
  });

  return worker;
}

/**
 * Matching Worker - finds transaction matches for inbox items
 */
function createInboxMatchingWorker(): Worker {
  const worker = new Worker<InboxMatchingJobData>(
    INBOX_QUEUES.MATCHING,
    async (job: Job<InboxMatchingJobData>) => {
      const { inboxId, tenantId } = job.data;

      serviceLogger.info({ jobId: job.id, inboxId }, "Processing inbox matching job");

      try {
        // Get inbox item
        const inboxResult = await db`
          SELECT * FROM inbox WHERE id = ${inboxId} AND tenant_id = ${tenantId}
        `;

        if (inboxResult.length === 0) {
          throw new Error(`Inbox item not found: ${inboxId}`);
        }

        const inboxItem = inboxResult[0];

        // Find matches
        const matches = await findMatchesForInbox(tenantId, {
          id: inboxItem.id as string,
          displayName: inboxItem.display_name as string | null,
          amount: inboxItem.amount ? Number(inboxItem.amount) : null,
          currency: inboxItem.currency as string | null,
          date: inboxItem.date as string | null,
          website: inboxItem.website as string | null,
          description: inboxItem.extracted_text as string | null,
          type: (inboxItem.type as "invoice" | "expense" | "receipt" | "other") || null,
        });

        // Store match suggestions
        for (const match of matches) {
          await db`
            INSERT INTO transaction_match_suggestions (
              tenant_id,
              inbox_id,
              transaction_id,
              confidence_score,
              embedding_similarity,
              amount_similarity,
              metadata,
              status
            )
            VALUES (
              ${tenantId},
              ${inboxId},
              ${match.paymentId},
              ${match.confidenceScore},
              ${match.embeddingScore},
              ${match.amountScore},
              ${JSON.stringify({ matchType: match.matchType })}::jsonb,
              'pending'
            )
            ON CONFLICT (inbox_id, transaction_id)
            DO UPDATE SET
              confidence_score = ${match.confidenceScore},
              embedding_similarity = ${match.embeddingScore},
              amount_similarity = ${match.amountScore},
              metadata = ${JSON.stringify({ matchType: match.matchType })}::jsonb,
              updated_at = NOW()
          `;
        }

        serviceLogger.info(
          { jobId: job.id, inboxId, matchCount: matches.length },
          "Inbox matching completed"
        );

        return {
          success: true,
          inboxId,
          matchCount: matches.length,
          matches: matches.map((m) => ({
            paymentId: m.paymentId,
            confidence: m.confidenceScore,
          })),
        };
      } catch (error) {
        serviceLogger.error({ jobId: job.id, inboxId, error }, "Inbox matching failed");
        throw error;
      }
    },
    {
      connection: REDIS_CONNECTION,
      concurrency: 3,
      limiter: {
        max: 20,
        duration: 60000,
      },
    }
  );

  worker.on("completed", (job) => {
    serviceLogger.debug({ jobId: job.id, queue: INBOX_QUEUES.MATCHING }, "Job completed");
  });

  worker.on("failed", (job, err) => {
    serviceLogger.error({ jobId: job?.id, queue: INBOX_QUEUES.MATCHING, error: err }, "Job failed");
  });

  return worker;
}

/**
 * Full Process Worker - runs complete pipeline (OCR -> Embedding -> Matching)
 */
function createInboxFullProcessWorker(): Worker {
  const worker = new Worker<InboxFullProcessJobData>(
    INBOX_QUEUES.FULL_PROCESS,
    async (job: Job<InboxFullProcessJobData>) => {
      const { inboxId, tenantId, filePath, mimeType } = job.data;

      serviceLogger.info({ jobId: job.id, inboxId }, "Processing full inbox pipeline");

      try {
        // Update status
        await db`
          UPDATE inbox SET status = 'processing', updated_at = NOW()
          WHERE id = ${inboxId} AND tenant_id = ${tenantId}
        `;

        // Step 1: OCR
        serviceLogger.info({ inboxId }, "Step 1: Running OCR");
        const fs = await import("fs/promises");
        const path = await import("path");
        const vaultPath = process.env.VAULT_PATH || "./vault";
        const fullPath = path.join(vaultPath, ...filePath);

        let ocrResult: OCRResult;
        try {
          const fileBuffer = await fs.readFile(fullPath);
          ocrResult = await processDocument(fileBuffer, mimeType);
        } catch (ocrError) {
          serviceLogger.warn({ inboxId, error: ocrError }, "OCR failed, using display name only");
          ocrResult = {
            text: "",
            confidence: 0,
            provider: "none",
            processingTimeMs: 0,
          };
        }

        // Update inbox with OCR results
        await db`
          UPDATE inbox
          SET
            extracted_text = ${ocrResult.text || null},
            ocr_confidence = ${ocrResult.confidence || null},
            amount = COALESCE(${ocrResult.extractedData?.totalAmount || null}, amount),
            currency = COALESCE(${ocrResult.extractedData?.currency || null}, currency),
            date = COALESCE(${ocrResult.extractedData?.invoiceDate || null}::timestamp, date),
            reference_id = COALESCE(${ocrResult.extractedData?.invoiceNumber || null}, reference_id),
            updated_at = NOW()
          WHERE id = ${inboxId} AND tenant_id = ${tenantId}
        `;

        // Step 2: Generate Embedding
        serviceLogger.info({ inboxId }, "Step 2: Generating embedding");
        const inboxData = await db`
          SELECT display_name, extracted_text, website FROM inbox
          WHERE id = ${inboxId} AND tenant_id = ${tenantId}
        `;

        if (inboxData.length > 0) {
          const textForEmbedding = [
            inboxData[0].display_name,
            inboxData[0].extracted_text,
            inboxData[0].website,
          ]
            .filter(Boolean)
            .join(" ");

          if (textForEmbedding.length > 10) {
            try {
              const embeddingResult = await generateEmbedding(textForEmbedding);

              await db`
                INSERT INTO inbox_embeddings (tenant_id, inbox_id, embedding, source_text, model)
                VALUES (
                  ${tenantId},
                  ${inboxId},
                  ${JSON.stringify(embeddingResult.embedding)}::vector,
                  ${textForEmbedding.substring(0, 5000)},
                  ${embeddingResult.model}
                )
                ON CONFLICT (inbox_id)
                DO UPDATE SET
                  embedding = ${JSON.stringify(embeddingResult.embedding)}::vector,
                  source_text = ${textForEmbedding.substring(0, 5000)},
                  model = ${embeddingResult.model},
                  updated_at = NOW()
              `;
            } catch (embError) {
              serviceLogger.warn({ inboxId, error: embError }, "Embedding generation failed");
            }
          }
        }

        // Step 3: Find Matches
        serviceLogger.info({ inboxId }, "Step 3: Finding matches");
        const inboxItem = await db`
          SELECT * FROM inbox WHERE id = ${inboxId} AND tenant_id = ${tenantId}
        `;

        let matchCount = 0;
        if (inboxItem.length > 0) {
          try {
            const matches = await findMatchesForInbox(tenantId, {
              id: inboxItem[0].id as string,
              displayName: inboxItem[0].display_name as string | null,
              amount: inboxItem[0].amount ? Number(inboxItem[0].amount) : null,
              currency: inboxItem[0].currency as string | null,
              date: inboxItem[0].date as string | null,
              website: inboxItem[0].website as string | null,
              description: inboxItem[0].extracted_text as string | null,
              type: (inboxItem[0].type as "invoice" | "expense" | "receipt" | "other") || null,
            });

            matchCount = matches.length;

            // Store matches
            for (const match of matches) {
              await db`
                INSERT INTO transaction_match_suggestions (
                  tenant_id, inbox_id, transaction_id, confidence_score,
                  embedding_similarity, amount_similarity, metadata, status
                )
                VALUES (
                  ${tenantId}, ${inboxId}, ${match.paymentId}, ${match.confidenceScore},
                  ${match.embeddingScore}, ${match.amountScore},
                  ${JSON.stringify({ matchType: match.matchType })}::jsonb, 'pending'
                )
                ON CONFLICT (inbox_id, transaction_id) DO UPDATE SET
                  confidence_score = EXCLUDED.confidence_score,
                  embedding_similarity = EXCLUDED.embedding_similarity,
                  amount_similarity = EXCLUDED.amount_similarity,
                  updated_at = NOW()
              `;
            }
          } catch (matchError) {
            serviceLogger.warn({ inboxId, error: matchError }, "Matching failed");
          }
        }

        // Update final status
        await db`
          UPDATE inbox SET status = 'pending', updated_at = NOW()
          WHERE id = ${inboxId} AND tenant_id = ${tenantId}
        `;

        serviceLogger.info(
          { jobId: job.id, inboxId, matchCount },
          "Full inbox pipeline completed"
        );

        return {
          success: true,
          inboxId,
          ocrConfidence: ocrResult.confidence,
          matchCount,
        };
      } catch (error) {
        serviceLogger.error({ jobId: job.id, inboxId, error }, "Full inbox pipeline failed");

        await db`
          UPDATE inbox SET status = 'new', updated_at = NOW()
          WHERE id = ${inboxId} AND tenant_id = ${tenantId}
        `;

        throw error;
      }
    },
    {
      connection: REDIS_CONNECTION,
      concurrency: 2,
      limiter: {
        max: 5,
        duration: 60000,
      },
    }
  );

  worker.on("completed", (job) => {
    serviceLogger.debug({ jobId: job.id, queue: INBOX_QUEUES.FULL_PROCESS }, "Job completed");
  });

  worker.on("failed", (job, err) => {
    serviceLogger.error(
      { jobId: job?.id, queue: INBOX_QUEUES.FULL_PROCESS, error: err },
      "Job failed"
    );
  });

  return worker;
}

// ==============================================
// WORKER MANAGEMENT
// ==============================================

/**
 * Start inbox workers
 */
export function startInboxWorkers(): void {
  serviceLogger.info("Starting inbox workers...");

  inboxWorkers.push(
    createInboxOCRWorker(),
    createInboxEmbeddingWorker(),
    createInboxMatchingWorker(),
    createInboxFullProcessWorker()
  );

  serviceLogger.info({ workerCount: inboxWorkers.length }, "Inbox workers started");
}

/**
 * Stop inbox workers
 */
export async function stopInboxWorkers(): Promise<void> {
  serviceLogger.info("Stopping inbox workers...");

  await Promise.all(inboxWorkers.map((worker) => worker.close()));
  inboxWorkers.length = 0;

  serviceLogger.info("Inbox workers stopped");
}

export default {
  startInboxWorkers,
  stopInboxWorkers,
  INBOX_QUEUES,
};
