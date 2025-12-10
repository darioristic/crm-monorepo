/**
 * Receipt Processor
 *
 * AI-powered receipt data extraction from images
 */

import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import type { z } from "zod";
import { logger } from "../../lib/logger";
import { retryCall } from "../../utils/retry";
import { getDomainFromEmail, removeProtocolFromDomain } from "../document-loader.service";
import * as fileStorage from "../file-storage.service";
import { createReceiptPrompt, receiptPrompt } from "./prompts";
import { receiptSchema } from "./schemas";

export interface GetReceiptRequest {
  documentUrl?: string;
  filePath?: string[];
  content?: Buffer;
  mimetype: string;
  companyName?: string | null;
}

export interface ReceiptResult {
  type: "expense";
  name: string | null;
  date: string | null;
  amount: number;
  currency: string;
  website: string | null;
  tax_amount: number;
  tax_rate: number | undefined;
  tax_type: string | null;
  language: string | null;
  metadata: {
    register_number: string | null;
    cashier_name: string | null;
    email: string | null;
    payment_method: string | null;
  };
  items: Array<{
    description: string | null;
    quantity: number | null;
    unit_price: number | null;
    total_price: number | null;
    discount: number | null;
  }>;
}

export class ReceiptProcessor {
  private model = openai("gpt-4o-mini");

  /**
   * Process receipt image using vision capabilities
   */
  async #processImage({
    imageData,
    mimeType,
    companyName,
  }: {
    imageData: string; // base64 encoded image
    mimeType: string;
    companyName?: string | null;
  }) {
    const prompt = companyName ? createReceiptPrompt(companyName) : receiptPrompt;

    const result = await retryCall(
      () =>
        generateObject({
          model: this.model,
          schema: receiptSchema,
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content: prompt,
            },
            {
              role: "user",
              content: [
                {
                  type: "image",
                  image: `data:${mimeType};base64,${imageData}`,
                },
              ],
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
   * Process a receipt image and extract structured data
   */
  public async getReceipt(params: GetReceiptRequest): Promise<ReceiptResult> {
    let imageBuffer: Buffer | null = null;
    let mimeType = params.mimetype;

    // Get image content from various sources
    if (params.content) {
      imageBuffer = params.content;
    } else if (params.filePath) {
      imageBuffer = await fileStorage.readFileAsBuffer(params.filePath);
    } else if (params.documentUrl) {
      const response = await fetch(params.documentUrl);
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      // Try to get content type from response
      const contentType = response.headers.get("content-type");
      if (contentType) {
        mimeType = contentType.split(";")[0];
      }
    }

    if (!imageBuffer) {
      throw new Error("Could not load receipt image");
    }

    // Convert to base64
    const base64Image = imageBuffer.toString("base64");

    logger.info({ imageSize: imageBuffer.length, mimeType }, "Processing receipt image");

    let result: z.infer<typeof receiptSchema>;

    try {
      result = await this.#processImage({
        imageData: base64Image,
        mimeType,
        companyName: params.companyName,
      });
    } catch (error) {
      logger.error({ error }, "Failed to process receipt image");
      throw error;
    }

    const website = this.#getWebsite({
      website: result.website,
      email: result.email,
    });

    return {
      type: "expense",
      name: result.store_name,
      date: result.date,
      amount: result.total_amount,
      currency: result.currency,
      website,
      tax_amount: result.tax_amount,
      tax_rate: result.tax_rate,
      tax_type: result.tax_type,
      language: result.language,
      metadata: {
        register_number: result.register_number ?? null,
        cashier_name: result.cashier_name ?? null,
        email: result.email ?? null,
        payment_method: result.payment_method ?? null,
      },
      items: result.items ?? [],
    };
  }
}

export const receiptProcessor = new ReceiptProcessor();
export default receiptProcessor;
