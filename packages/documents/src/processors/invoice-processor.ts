import { mistral } from "@ai-sdk/mistral";
import { generateObject } from "ai";
import type { z } from "zod";
import { createInvoicePrompt, invoicePrompt } from "../prompt";
import { invoiceSchema } from "../schema";
import type { ExtractedInvoice, GetDocumentRequest } from "../types";

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

export class InvoiceProcessor {
  private model = mistral("mistral-small-latest");

  #isDataQualityPoor(result: z.infer<typeof invoiceSchema>): boolean {
    const criticalFieldsMissing =
      !result.total_amount ||
      !result.currency ||
      !result.vendor_name ||
      (!result.invoice_date && !result.due_date);

    return criticalFieldsMissing;
  }

  async #processDocument({ documentUrl, companyName }: GetDocumentRequest) {
    if (!documentUrl) {
      throw new Error("Document URL is required");
    }

    const prompt = companyName
      ? createInvoicePrompt(companyName)
      : invoicePrompt;

    const result = await retryCall(() =>
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

  async #processText(text: string, companyName?: string) {
    const prompt = companyName
      ? createInvoicePrompt(companyName)
      : invoicePrompt;

    const result = await retryCall(() =>
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
            content: text,
          },
        ],
      })
    );

    return result.object;
  }

  #transformResult(result: z.infer<typeof invoiceSchema>): ExtractedInvoice {
    return {
      type: "invoice",
      invoiceNumber: result.invoice_number,
      invoiceDate: result.invoice_date,
      dueDate: result.due_date,
      vendorName: result.vendor_name,
      vendorAddress: result.vendor_address,
      customerName: result.customer_name,
      customerAddress: result.customer_address,
      email: result.email,
      website: result.website,
      totalAmount: result.total_amount,
      currency: result.currency,
      taxAmount: result.tax_amount,
      taxRate: result.tax_rate,
      taxType: result.tax_type,
      lineItems: result.line_items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        total: item.total,
        vatRate: item.vat_rate,
      })),
      paymentInstructions: result.payment_instructions,
      notes: result.notes,
      language: result.language,
    };
  }

  public async processDocument(params: GetDocumentRequest): Promise<ExtractedInvoice> {
    const result = await this.#processDocument(params);
    return this.#transformResult(result);
  }

  public async processText(text: string, companyName?: string): Promise<ExtractedInvoice> {
    const result = await this.#processText(text, companyName);
    return this.#transformResult(result);
  }
}

// Singleton instance
export const invoiceProcessor = new InvoiceProcessor();

