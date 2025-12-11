/**
 * Inbox AI Processing Service
 * Handles OCR extraction and AI features for inbox items
 * Runs inline (synchronously) - no Redis/BullMQ required
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sql as db } from "../db/client";
import { createInboxEmbedding } from "../db/queries/inbox";
import { serviceLogger } from "../lib/logger";
import { type OCRResult, processDocument } from "./document-ocr";
import { generateEmbedding, prepareInboxText } from "./embeddings";

// ==============================================
// TYPES
// ==============================================

export interface ProcessInboxResult {
  success: boolean;
  inboxId: string;
  ocrResult?: OCRResult;
  embeddingCreated?: boolean;
  error?: string;
}

// ==============================================
// MAIN PROCESSING FUNCTION
// ==============================================

/**
 * Process an inbox item with AI (OCR + optional embedding)
 * Call this after file upload to extract data from the document
 */
export async function processInboxItem(
  inboxId: string,
  tenantId: string,
  options: {
    generateEmbeddings?: boolean;
  } = {}
): Promise<ProcessInboxResult> {
  const { generateEmbeddings: shouldGenerateEmbeddings = false } = options;

  serviceLogger.info({ inboxId, tenantId }, "Starting inbox AI processing");

  try {
    // 1. Get inbox item details
    const [inboxItem] = await db`
      SELECT id, file_path, content_type, display_name, status
      FROM inbox
      WHERE id = ${inboxId} AND tenant_id = ${tenantId}
    `;

    if (!inboxItem) {
      return { success: false, inboxId, error: "Inbox item not found" };
    }

    const filePath = inboxItem.file_path as string[];
    const contentType = inboxItem.content_type as string;

    if (!filePath || filePath.length === 0) {
      return { success: false, inboxId, error: "No file path" };
    }

    // 2. Update status to processing
    await db`
      UPDATE inbox
      SET status = 'processing', updated_at = NOW()
      WHERE id = ${inboxId} AND tenant_id = ${tenantId}
    `;

    // 3. Read file from storage
    const vaultPath = process.env.UPLOAD_DIR || "./uploads";
    const fullPath = join(vaultPath, "vault", ...filePath);

    let fileBuffer: Buffer;
    try {
      fileBuffer = await readFile(fullPath);
    } catch (err) {
      serviceLogger.error({ error: err, fullPath }, "Failed to read file");
      await db`
        UPDATE inbox
        SET status = 'pending', updated_at = NOW()
        WHERE id = ${inboxId} AND tenant_id = ${tenantId}
      `;
      return { success: false, inboxId, error: "File not found" };
    }

    // 4. Process with OCR
    let ocrResult: OCRResult | undefined;
    try {
      ocrResult = await processDocument(fileBuffer, contentType);
      serviceLogger.info(
        { inboxId, confidence: ocrResult.confidence, provider: ocrResult.provider },
        "OCR completed"
      );
    } catch (err) {
      serviceLogger.error({ error: err, inboxId }, "OCR processing failed");
      // Continue without OCR data - just mark as pending
      await db`
        UPDATE inbox
        SET status = 'pending', updated_at = NOW()
        WHERE id = ${inboxId} AND tenant_id = ${tenantId}
      `;
      return { success: false, inboxId, error: "OCR failed" };
    }

    // 5. Update inbox with extracted data
    const extractedData = ocrResult.extractedData || {};

    await db`
      UPDATE inbox
      SET
        amount = COALESCE(${extractedData.totalAmount || extractedData.amount || null}, amount),
        currency = COALESCE(${extractedData.currency || null}, currency),
        date = COALESCE(${extractedData.invoiceDate ? new Date(extractedData.invoiceDate).toISOString() : null}::timestamp, date),
        reference_id = COALESCE(${extractedData.invoiceNumber || null}, reference_id),
        description = COALESCE(${ocrResult.text?.substring(0, 500) || null}, description),
        website = COALESCE(${extractedData.vendorName || null}, website),
        status = 'pending',
        updated_at = NOW()
      WHERE id = ${inboxId} AND tenant_id = ${tenantId}
    `;

    // 6. Generate embedding (optional)
    let embeddingCreated = false;
    if (shouldGenerateEmbeddings) {
      try {
        const textForEmbedding = prepareInboxText({
          displayName: (inboxItem.display_name as string) || extractedData.vendorName || null,
          website: extractedData.vendorName || null,
          description: ocrResult.text?.substring(0, 200) || null,
        });

        const { embedding, model } = await generateEmbedding(textForEmbedding);

        await createInboxEmbedding({
          inboxId,
          tenantId,
          embedding,
          sourceText: textForEmbedding,
          model,
        });

        embeddingCreated = true;
        serviceLogger.info({ inboxId }, "Embedding created");
      } catch (err) {
        serviceLogger.error({ error: err, inboxId }, "Embedding generation failed");
        // Continue without embedding - not critical
      }
    }

    serviceLogger.info({ inboxId, embeddingCreated }, "Inbox AI processing completed");

    return {
      success: true,
      inboxId,
      ocrResult,
      embeddingCreated,
    };
  } catch (error) {
    serviceLogger.error({ error, inboxId }, "Inbox AI processing failed");

    // Reset status to pending on error
    try {
      await db`
        UPDATE inbox
        SET status = 'pending', updated_at = NOW()
        WHERE id = ${inboxId} AND tenant_id = ${tenantId}
      `;
    } catch {
      // Ignore cleanup errors
    }

    return {
      success: false,
      inboxId,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Process multiple inbox items
 */
export async function processInboxItems(
  items: Array<{ id: string; tenantId: string }>,
  options: { generateEmbeddings?: boolean } = {}
): Promise<ProcessInboxResult[]> {
  const results: ProcessInboxResult[] = [];

  for (const item of items) {
    const result = await processInboxItem(item.id, item.tenantId, options);
    results.push(result);
  }

  return results;
}

export default {
  processInboxItem,
  processInboxItems,
};
