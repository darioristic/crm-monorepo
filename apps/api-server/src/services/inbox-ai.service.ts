/**
 * Inbox AI Processing Service
 * Handles AI extraction and features for inbox items
 * Uses Gemini AI for intelligent document extraction (like Midday)
 * Runs inline (synchronously) - no Redis/BullMQ required
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type DocumentExtractionResult,
  extractDocumentWithGemini,
} from "../ai/document-extraction";
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
  geminiResult?: DocumentExtractionResult;
  embeddingCreated?: boolean;
  error?: string;
}

// ==============================================
// MAIN PROCESSING FUNCTION
// ==============================================

/**
 * Process an inbox item with AI (Gemini extraction + optional OCR fallback + optional embedding)
 * Uses Gemini AI as primary extraction method (like Midday)
 * Falls back to basic OCR if Gemini fails
 */
export async function processInboxItem(
  inboxId: string,
  tenantId: string,
  options: {
    generateEmbeddings?: boolean;
    useGemini?: boolean;
    companyName?: string | null;
  } = {}
): Promise<ProcessInboxResult> {
  const {
    generateEmbeddings: shouldGenerateEmbeddings = false,
    useGemini = true, // Use Gemini by default
    companyName,
  } = options;

  serviceLogger.info({ inboxId, tenantId, useGemini }, "Starting inbox AI processing");

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

    // 4. Extract data using Gemini AI (primary method)
    let geminiResult: DocumentExtractionResult | undefined;
    let ocrResult: OCRResult | undefined;
    let extractedVendorName: string | null = null;
    let extractedAmount: number | null = null;
    let extractedCurrency: string | null = null;
    let extractedDate: string | null = null;
    let extractedWebsite: string | null = null;
    let extractedInvoiceNumber: string | null = null;
    let extractedDescription: string | null = null;
    let extractedDocumentType: string | null = null;

    if (useGemini && process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      try {
        serviceLogger.info({ inboxId }, "Attempting Gemini AI extraction");

        geminiResult = await extractDocumentWithGemini(fileBuffer, contentType, {
          companyName,
        });

        extractedVendorName = geminiResult.vendor_name;
        extractedAmount = geminiResult.total_amount;
        extractedCurrency = geminiResult.currency;
        extractedDate = geminiResult.date;
        extractedWebsite = geminiResult.website;
        extractedInvoiceNumber = geminiResult.invoice_number;
        extractedDocumentType = geminiResult.document_type;

        // Create description from notes or line items
        if (geminiResult.notes) {
          extractedDescription = geminiResult.notes;
        } else if (geminiResult.line_items && geminiResult.line_items.length > 0) {
          extractedDescription = geminiResult.line_items
            .map((item) => item.description)
            .filter(Boolean)
            .join(", ")
            .substring(0, 500);
        }

        serviceLogger.info(
          {
            inboxId,
            vendorName: extractedVendorName,
            amount: extractedAmount,
            currency: extractedCurrency,
            date: extractedDate,
            documentType: extractedDocumentType,
          },
          "Gemini extraction completed"
        );
      } catch (err) {
        serviceLogger.warn(
          { error: err instanceof Error ? err.message : "Unknown", inboxId },
          "Gemini extraction failed, falling back to OCR"
        );
      }
    }

    // 5. Fallback to OCR if Gemini didn't extract critical data
    if (!extractedVendorName || !extractedAmount) {
      try {
        serviceLogger.info({ inboxId }, "Running OCR fallback extraction");

        ocrResult = await processDocument(fileBuffer, contentType);

        const ocrData = ocrResult.extractedData || {};

        // Fill in missing fields from OCR
        if (!extractedVendorName && ocrData.vendorName) {
          extractedVendorName = ocrData.vendorName;
        }
        if (!extractedAmount && (ocrData.totalAmount || ocrData.amount)) {
          extractedAmount = ocrData.totalAmount || ocrData.amount || null;
        }
        if (!extractedCurrency && ocrData.currency) {
          extractedCurrency = ocrData.currency;
        }
        if (!extractedDate && ocrData.invoiceDate) {
          // Parse date from OCR result
          try {
            const dateStr = ocrData.invoiceDate;
            const parts = dateStr.split(/[./-]/);
            if (parts.length === 3) {
              const [day, month, year] = parts.map((p) => parseInt(p, 10));
              const fullYear = year < 100 ? 2000 + year : year;
              const date = new Date(fullYear, month - 1, day);
              if (!Number.isNaN(date.getTime())) {
                extractedDate = date.toISOString().split("T")[0];
              }
            }
          } catch {
            serviceLogger.warn({ dateStr: ocrData.invoiceDate }, "Failed to parse OCR date");
          }
        }
        if (!extractedWebsite && ocrData.vendorWebsite) {
          extractedWebsite = ocrData.vendorWebsite;
        }
        if (!extractedInvoiceNumber && ocrData.invoiceNumber) {
          extractedInvoiceNumber = ocrData.invoiceNumber;
        }
        if (!extractedDescription && ocrResult.text) {
          extractedDescription = ocrResult.text.substring(0, 500);
        }

        serviceLogger.info(
          { inboxId, ocrConfidence: ocrResult.confidence },
          "OCR fallback completed"
        );
      } catch (err) {
        serviceLogger.error({ error: err, inboxId }, "OCR processing failed");
        // Continue with whatever we have
      }
    }

    // 6. Derive website from vendor name if not extracted
    if (!extractedWebsite && extractedVendorName) {
      const cleanName = extractedVendorName
        .toLowerCase()
        .replace(/\s*(d\.?o\.?o\.?|a\.?d\.?|d\.?d\.?|ltd|llc|inc|gmbh|s\.?r\.?o\.?)\s*/gi, "")
        .replace(/[^a-z0-9]/g, "");
      if (cleanName.length >= 3 && cleanName.length <= 30) {
        extractedWebsite = `${cleanName}.com`;
      }
    }

    // 7. Prepare date for database (convert to timestamp)
    let parsedDate: string | null = null;
    if (extractedDate) {
      try {
        const date = new Date(extractedDate);
        if (!Number.isNaN(date.getTime())) {
          parsedDate = date.toISOString();
        }
      } catch {
        serviceLogger.warn({ dateStr: extractedDate }, "Failed to parse date for DB");
      }
    }

    // 7b. Validate reference_id - must be meaningful (not just "TR", "INV", etc.)
    const invalidRefIds = ["TR", "INV", "FAK", "PON", "BR", "NO", "REF", "ID"];
    if (extractedInvoiceNumber) {
      const upperRef = extractedInvoiceNumber.toUpperCase().trim();
      if (upperRef.length < 4 || invalidRefIds.includes(upperRef)) {
        serviceLogger.info(
          { invalidRefId: extractedInvoiceNumber },
          "Invalid reference_id detected, skipping"
        );
        extractedInvoiceNumber = null;
      }
    }

    serviceLogger.info(
      {
        inboxId,
        vendorName: extractedVendorName,
        website: extractedWebsite,
        amount: extractedAmount,
        currency: extractedCurrency,
        date: parsedDate,
        documentType: extractedDocumentType,
      },
      "Final extracted data"
    );

    // 8. Update inbox with extracted data
    await db`
      UPDATE inbox
      SET
        display_name = COALESCE(${extractedVendorName}, display_name),
        amount = COALESCE(${extractedAmount}, amount),
        currency = COALESCE(${extractedCurrency}, currency),
        date = COALESCE(${parsedDate}::timestamp, date),
        reference_id = COALESCE(${extractedInvoiceNumber}, reference_id),
        description = COALESCE(${extractedDescription}, description),
        website = COALESCE(${extractedWebsite}, website),
        type = COALESCE(${extractedDocumentType}, type),
        status = 'pending',
        updated_at = NOW()
      WHERE id = ${inboxId} AND tenant_id = ${tenantId}
    `;

    // 9. Generate embedding (optional)
    let embeddingCreated = false;
    if (shouldGenerateEmbeddings) {
      try {
        const textForEmbedding = prepareInboxText({
          displayName: extractedVendorName || (inboxItem.display_name as string) || null,
          website: extractedWebsite || null,
          description: extractedDescription || null,
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
      geminiResult,
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
