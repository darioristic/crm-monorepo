/**
 * Invoice Processor
 *
 * AI-powered invoice data extraction with OCR fallback
 */

import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import type { z } from "zod";
import { logger } from "../../lib/logger";
import { retryCall } from "../../utils/retry";
import {
  getDomainFromEmail,
  loadDocument,
  removeProtocolFromDomain,
} from "../document-loader.service";
import * as fileStorage from "../file-storage.service";
import { createInvoicePrompt, invoicePrompt } from "./prompts";
import { invoiceSchema } from "./schemas";

export interface GetInvoiceRequest {
  documentUrl?: string;
  filePath?: string[];
  content?: Buffer;
  mimetype: string;
  companyName?: string | null;
}

export interface InvoiceResult {
  type: "invoice";
  name: string | null;
  date: string | null;
  amount: number;
  currency: string;
  website: string | null;
  description: string | null;
  tax_amount: number | null;
  tax_rate: number | null;
  tax_type: string | null;
  language: string | null;
  metadata: {
    invoice_date: string | null;
    invoice_number: string | null;
    payment_instructions: string | null;
    customer_name: string | null;
    customer_address: string | null;
    vendor_address: string | null;
    vendor_name: string | null;
    email: string | null;
  };
  line_items: Array<{
    description: string | null;
    quantity: number | null;
    unit_price: number | null;
    total_price: number | null;
  }>;
}

export class InvoiceProcessor {
  private model = openai("gpt-4o-mini");

  /**
   * Check if the extracted data meets minimum quality standards
   */
  #isDataQualityPoor(result: z.infer<typeof invoiceSchema>): boolean {
    const criticalFieldsMissing =
      !result.total_amount ||
      !result.currency ||
      !result.vendor_name ||
      (!result.invoice_date && !result.due_date);

    return criticalFieldsMissing;
  }

  /**
   * Process invoice using direct AI analysis
   */
  async #processDocument({
    content,
    companyName,
  }: {
    content: string;
    companyName?: string | null;
  }) {
    const prompt = companyName ? createInvoicePrompt(companyName) : invoicePrompt;

    const result = await retryCall(
      () =>
        generateObject({
          model: this.model,
          schema: invoiceSchema,
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content: prompt,
            },
            {
              role: "user",
              content: content,
            },
          ],
        }),
      { maxRetries: 2, baseDelay: 1000 }
    );

    return result.object;
  }

  /**
   * Fallback extraction using text content
   */
  async #fallbackExtract(textContent: string) {
    const result = await retryCall(
      () =>
        generateObject({
          model: this.model,
          schema: invoiceSchema,
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content: invoicePrompt,
            },
            {
              role: "user",
              content: textContent,
            },
          ],
        }),
      { maxRetries: 2, baseDelay: 1000 }
    );

    return result.object;
  }

  /**
   * Get website from result or infer from email
   */
  #getWebsite({ website, email }: { website: string | null; email: string | null }): string | null {
    if (website) {
      return website;
    }
    return removeProtocolFromDomain(getDomainFromEmail(email));
  }

  /**
   * Process an invoice and extract structured data
   */
  public async getInvoice(params: GetInvoiceRequest): Promise<InvoiceResult> {
    let textContent: string | null = null;

    // Get text content from various sources
    if (params.content) {
      textContent = await loadDocument({
        content: params.content,
        mimetype: params.mimetype,
      });
    } else if (params.filePath) {
      const buffer = await fileStorage.readFileAsBuffer(params.filePath);
      if (buffer) {
        textContent = await loadDocument({
          content: buffer,
          mimetype: params.mimetype,
        });
      }
    } else if (params.documentUrl) {
      // Fetch from URL
      const response = await fetch(params.documentUrl);
      const arrayBuffer = await response.arrayBuffer();
      textContent = await loadDocument({
        content: Buffer.from(arrayBuffer),
        mimetype: params.mimetype,
      });
    }

    if (!textContent || textContent.length < 50) {
      throw new Error("Could not extract text from invoice document");
    }

    logger.info({ contentLength: textContent.length }, "Processing invoice document");

    let result: z.infer<typeof invoiceSchema>;

    try {
      // Primary processing
      result = await this.#processDocument({
        content: textContent,
        companyName: params.companyName,
      });

      // Check data quality and use fallback if needed
      if (this.#isDataQualityPoor(result)) {
        logger.warn("Primary processing completed but data quality is poor, running fallback");

        try {
          const fallbackResult = await this.#fallbackExtract(textContent);

          // Merge results, preferring primary but filling gaps from fallback
          result = {
            ...result,
            total_amount: result.total_amount || fallbackResult.total_amount,
            currency: result.currency || fallbackResult.currency,
            vendor_name: result.vendor_name || fallbackResult.vendor_name,
            invoice_date: result.invoice_date || fallbackResult.invoice_date,
            due_date: result.due_date || fallbackResult.due_date,
            invoice_number: result.invoice_number || fallbackResult.invoice_number,
            customer_name: result.customer_name || fallbackResult.customer_name,
            vendor_address: result.vendor_address || fallbackResult.vendor_address,
            customer_address: result.customer_address || fallbackResult.customer_address,
            email: result.email || fallbackResult.email,
            website: result.website || fallbackResult.website,
            tax_amount: result.tax_amount || fallbackResult.tax_amount,
            tax_rate: result.tax_rate || fallbackResult.tax_rate,
            tax_type: result.tax_type || fallbackResult.tax_type,
            payment_instructions:
              result.payment_instructions || fallbackResult.payment_instructions,
            notes: result.notes || fallbackResult.notes,
            language: result.language || fallbackResult.language,
            line_items:
              result.line_items?.length > 0 ? result.line_items : fallbackResult.line_items,
          };
        } catch (fallbackError) {
          logger.warn({ error: fallbackError }, "Fallback extraction also failed");
        }
      }
    } catch (error) {
      logger.warn({ error }, "Primary processing failed, attempting fallback");
      result = await this.#fallbackExtract(textContent);
    }

    const website = this.#getWebsite({
      website: result.website,
      email: result.email,
    });

    return {
      type: "invoice",
      name: result.vendor_name,
      date: result.due_date ?? result.invoice_date,
      amount: result.total_amount,
      currency: result.currency,
      website,
      description: result.notes,
      tax_amount: result.tax_amount,
      tax_rate: result.tax_rate,
      tax_type: result.tax_type,
      language: result.language,
      metadata: {
        invoice_date: result.invoice_date ?? null,
        invoice_number: result.invoice_number ?? null,
        payment_instructions: result.payment_instructions ?? null,
        customer_name: result.customer_name ?? null,
        customer_address: result.customer_address ?? null,
        vendor_address: result.vendor_address ?? null,
        vendor_name: result.vendor_name ?? null,
        email: result.email ?? null,
      },
      line_items: result.line_items ?? [],
    };
  }
}

export const invoiceProcessor = new InvoiceProcessor();
export default invoiceProcessor;
