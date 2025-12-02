import { mistral } from "@ai-sdk/mistral";
import { generateObject } from "ai";
import type { z } from "zod";
import { receiptPrompt } from "../prompt";
import { receiptSchema } from "../schema";
import type { ExtractedReceipt, GetDocumentRequest } from "../types";

// Retry helper
async function retryCall<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`Attempt ${attempt} failed: ${lastError.message}`);

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
  }

  throw lastError;
}

export class ReceiptProcessor {
  private model = mistral("mistral-small-latest");

  async #processDocument({ documentUrl }: GetDocumentRequest) {
    if (!documentUrl) {
      throw new Error("Document URL is required");
    }

    const result = await retryCall(() =>
      generateObject({
        model: this.model,
        schema: receiptSchema,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: receiptPrompt,
          },
          {
            role: "user",
            content: [
              {
                type: "file",
                data: documentUrl,
                mimeType: "application/pdf",
              },
            ],
          },
        ],
      })
    );

    return result.object;
  }

  async #processImage(imageUrl: string) {
    const result = await retryCall(() =>
      generateObject({
        model: this.model,
        schema: receiptSchema,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: receiptPrompt,
          },
          {
            role: "user",
            content: [
              {
                type: "image",
                image: imageUrl,
              },
            ],
          },
        ],
      })
    );

    return result.object;
  }

  async #processText(text: string) {
    const result = await retryCall(() =>
      generateObject({
        model: this.model,
        schema: receiptSchema,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: receiptPrompt,
          },
          {
            role: "user",
            content: text,
          },
        ],
      })
    );

    return result.object;
  }

  #transformResult(result: z.infer<typeof receiptSchema>): ExtractedReceipt {
    return {
      type: "receipt",
      merchantName: result.merchant_name,
      merchantAddress: result.merchant_address,
      date: result.date,
      totalAmount: result.total_amount,
      currency: result.currency,
      taxAmount: result.tax_amount,
      paymentMethod: result.payment_method,
      items: result.items,
      language: result.language,
    };
  }

  public async processDocument(params: GetDocumentRequest): Promise<ExtractedReceipt> {
    const result = await this.#processDocument(params);
    return this.#transformResult(result);
  }

  public async processImage(imageUrl: string): Promise<ExtractedReceipt> {
    const result = await this.#processImage(imageUrl);
    return this.#transformResult(result);
  }

  public async processText(text: string): Promise<ExtractedReceipt> {
    const result = await this.#processText(text);
    return this.#transformResult(result);
  }
}

// Singleton instance
export const receiptProcessor = new ReceiptProcessor();

