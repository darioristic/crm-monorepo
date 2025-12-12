/**
 * Vault Migration - Retroactively store existing invoices and quotes in Vault
 *
 * POST /api/vault/migrate
 * Body: { type: "invoices" | "quotes" | "all", limit?: number }
 *
 * This endpoint fetches existing documents that aren't in Vault yet
 * and stores them. Run once to backfill historical data.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import type { Invoice } from "@/types/invoice";
import { DEFAULT_INVOICE_TEMPLATE } from "@/types/invoice";
import type { Quote } from "@/types/quote";
import { DEFAULT_QUOTE_TEMPLATE } from "@/types/quote";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes for large migrations

function getLogoDataUrl(): string | null {
  try {
    const filePath = join(process.cwd(), "public", "logo.png");
    if (!existsSync(filePath)) return null;
    const logoBuffer = readFileSync(filePath);
    const base64 = logoBuffer.toString("base64");
    return `data:image/png;base64,${base64}`;
  } catch {
    return null;
  }
}

type MigrationResult = {
  type: "invoice" | "quote";
  id: string;
  number: string;
  success: boolean;
  error?: string;
  documentId?: string;
};

export async function POST(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie") || "";
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  try {
    const body = (await request.json()) as {
      type: "invoices" | "quotes" | "all";
      limit?: number;
    };

    const migrationType = body.type || "all";
    const limit = body.limit || 100;
    const results: MigrationResult[] = [];

    // Migrate invoices
    if (migrationType === "invoices" || migrationType === "all") {
      const invoiceResults = await migrateInvoices(cookieHeader, baseUrl, limit);
      results.push(...invoiceResults);
    }

    // Migrate quotes
    if (migrationType === "quotes" || migrationType === "all") {
      const quoteResults = await migrateQuotes(cookieHeader, baseUrl, limit);
      results.push(...quoteResults);
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    logger.info("Vault migration completed", {
      type: migrationType,
      total: results.length,
      successful,
      failed,
    });

    return NextResponse.json({
      success: true,
      summary: {
        total: results.length,
        successful,
        failed,
      },
      results,
    });
  } catch (error) {
    logger.error("Error during vault migration:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Migration failed", details: errorMessage }, { status: 500 });
  }
}

async function migrateInvoices(
  cookieHeader: string,
  baseUrl: string,
  limit: number
): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  try {
    // Fetch all invoices
    const listResponse = await fetch(`${baseUrl}/api/v1/invoices?limit=${limit}`, {
      headers: { Cookie: cookieHeader },
    });

    if (!listResponse.ok) {
      logger.error("Failed to fetch invoices list", { status: listResponse.status });
      return results;
    }

    const listData = await listResponse.json();
    const invoices = listData.data || [];

    logger.info(`Found ${invoices.length} invoices to check for migration`);

    // Get existing documents to avoid duplicates
    const existingDocs = await getExistingDocuments(cookieHeader, baseUrl, "invoice");

    for (const invoiceSummary of invoices) {
      const invoiceId = invoiceSummary.id;
      const invoiceNumber = invoiceSummary.invoiceNumber || invoiceId;

      // Skip if already in vault
      if (existingDocs.has(invoiceId)) {
        logger.debug(`Skipping invoice ${invoiceNumber} - already in vault`);
        continue;
      }

      try {
        // Fetch full invoice data
        const invoiceResponse = await fetch(`${baseUrl}/api/v1/invoices/${invoiceId}`, {
          headers: { Cookie: cookieHeader },
        });

        if (!invoiceResponse.ok) {
          results.push({
            type: "invoice",
            id: invoiceId,
            number: invoiceNumber,
            success: false,
            error: `Failed to fetch invoice: ${invoiceResponse.status}`,
          });
          continue;
        }

        const invoiceData = await invoiceResponse.json();
        const apiInvoice = invoiceData.data;

        // Build invoice object and generate PDF
        const invoice = buildInvoiceObject(apiInvoice);
        const pdfBuffer = await generateInvoicePdf(invoice);
        const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");

        // Store in vault
        const storeResponse = await fetch(`${baseUrl}/api/v1/documents/store-generated`, {
          method: "POST",
          headers: {
            Cookie: cookieHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pdfBase64,
            documentType: "invoice",
            entityId: invoiceId,
            title: `Invoice ${invoiceNumber}`,
            documentNumber: invoiceNumber,
            metadata: {
              customerName: apiInvoice.companyName || apiInvoice.company?.name,
              total: apiInvoice.total,
              currency: apiInvoice.currency || "EUR",
              dueDate: apiInvoice.dueDate,
              status: apiInvoice.status,
              migratedAt: new Date().toISOString(),
            },
          }),
        });

        if (storeResponse.ok) {
          const storeResult = await storeResponse.json();
          results.push({
            type: "invoice",
            id: invoiceId,
            number: invoiceNumber,
            success: true,
            documentId: storeResult.data?.id,
          });
          logger.info(`Migrated invoice ${invoiceNumber} to vault`);
        } else {
          const errorData = await storeResponse.json().catch(() => ({}));
          results.push({
            type: "invoice",
            id: invoiceId,
            number: invoiceNumber,
            success: false,
            error: `Store failed: ${JSON.stringify(errorData)}`,
          });
        }

        // Small delay to avoid overwhelming the server
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        results.push({
          type: "invoice",
          id: invoiceId,
          number: invoiceNumber,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  } catch (error) {
    logger.error("Error migrating invoices:", error);
  }

  return results;
}

async function migrateQuotes(
  cookieHeader: string,
  baseUrl: string,
  limit: number
): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  try {
    // Fetch all quotes
    const listResponse = await fetch(`${baseUrl}/api/v1/quotes?limit=${limit}`, {
      headers: { Cookie: cookieHeader },
    });

    if (!listResponse.ok) {
      logger.error("Failed to fetch quotes list", { status: listResponse.status });
      return results;
    }

    const listData = await listResponse.json();
    const quotes = listData.data || [];

    logger.info(`Found ${quotes.length} quotes to check for migration`);

    // Get existing documents to avoid duplicates
    const existingDocs = await getExistingDocuments(cookieHeader, baseUrl, "quote");

    for (const quoteSummary of quotes) {
      const quoteId = quoteSummary.id;
      const quoteNumber = quoteSummary.quoteNumber || quoteId;

      // Skip if already in vault
      if (existingDocs.has(quoteId)) {
        logger.debug(`Skipping quote ${quoteNumber} - already in vault`);
        continue;
      }

      try {
        // Fetch full quote data
        const quoteResponse = await fetch(`${baseUrl}/api/v1/quotes/${quoteId}`, {
          headers: { Cookie: cookieHeader },
        });

        if (!quoteResponse.ok) {
          results.push({
            type: "quote",
            id: quoteId,
            number: quoteNumber,
            success: false,
            error: `Failed to fetch quote: ${quoteResponse.status}`,
          });
          continue;
        }

        const quoteData = await quoteResponse.json();
        const apiQuote = quoteData.data;

        // Build quote object and generate PDF
        const quote = buildQuoteObject(apiQuote);
        const pdfBuffer = await generateQuotePdf(quote);
        const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");

        // Store in vault
        const storeResponse = await fetch(`${baseUrl}/api/v1/documents/store-generated`, {
          method: "POST",
          headers: {
            Cookie: cookieHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pdfBase64,
            documentType: "quote",
            entityId: quoteId,
            title: `Quote ${quoteNumber}`,
            documentNumber: quoteNumber,
            metadata: {
              customerName: apiQuote.companyName || apiQuote.company?.name,
              total: apiQuote.total,
              currency: apiQuote.currency || "EUR",
              validUntil: apiQuote.validUntil,
              status: apiQuote.status,
              migratedAt: new Date().toISOString(),
            },
          }),
        });

        if (storeResponse.ok) {
          const storeResult = await storeResponse.json();
          results.push({
            type: "quote",
            id: quoteId,
            number: quoteNumber,
            success: true,
            documentId: storeResult.data?.id,
          });
          logger.info(`Migrated quote ${quoteNumber} to vault`);
        } else {
          const errorData = await storeResponse.json().catch(() => ({}));
          results.push({
            type: "quote",
            id: quoteId,
            number: quoteNumber,
            success: false,
            error: `Store failed: ${JSON.stringify(errorData)}`,
          });
        }

        // Small delay to avoid overwhelming the server
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        results.push({
          type: "quote",
          id: quoteId,
          number: quoteNumber,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  } catch (error) {
    logger.error("Error migrating quotes:", error);
  }

  return results;
}

async function getExistingDocuments(
  cookieHeader: string,
  baseUrl: string,
  documentType: string
): Promise<Set<string>> {
  const existingIds = new Set<string>();

  try {
    // Search for documents with the specific type tag
    const response = await fetch(`${baseUrl}/api/v1/documents?limit=1000`, {
      headers: { Cookie: cookieHeader },
    });

    if (response.ok) {
      const data = await response.json();
      const documents = data.data || [];

      for (const doc of documents) {
        // Check if this document was generated from an invoice/quote
        const entityId = doc.metadata?.entityId;
        const docType = doc.metadata?.documentType;
        if (entityId && docType === documentType) {
          existingIds.add(entityId);
        }
      }
    }
  } catch (error) {
    logger.warn("Could not fetch existing documents for deduplication", { error });
  }

  return existingIds;
}

// Helper functions to build objects and generate PDFs

type ApiInvoiceItem = {
  productName?: string;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  unit?: string;
  discount?: number;
  vat?: number;
  vatRate?: number;
};

function buildInvoiceObject(apiInvoice: Record<string, unknown>): Invoice {
  let customerDetails = null;
  if (apiInvoice.customerDetails) {
    customerDetails =
      typeof apiInvoice.customerDetails === "string"
        ? JSON.parse(apiInvoice.customerDetails as string)
        : apiInvoice.customerDetails;
  } else {
    const company = apiInvoice.company as Record<string, unknown> | undefined;
    const customerLines: string[] = [];
    const companyName = (apiInvoice.companyName as string) || (company?.name as string);
    if (companyName) customerLines.push(companyName);
    if (company?.addressLine1) customerLines.push(company.addressLine1 as string);
    else if (company?.address) customerLines.push(company.address as string);
    if (company?.addressLine2) customerLines.push(company.addressLine2 as string);
    const cityLine = [company?.city, company?.zip || company?.postalCode, company?.country]
      .filter(Boolean)
      .join(", ");
    if (cityLine) customerLines.push(cityLine);
    if (company?.billingEmail) customerLines.push(company.billingEmail as string);
    else if (company?.email) customerLines.push(company.email as string);
    if (company?.vatNumber) customerLines.push(`PIB: ${company.vatNumber}`);
    customerDetails =
      customerLines.length > 0
        ? {
            type: "doc",
            content: customerLines.map((line) => ({
              type: "paragraph",
              content: [{ type: "text", text: line }],
            })),
          }
        : null;
  }

  const company = apiInvoice.company as Record<string, unknown> | undefined;
  const companyName = (apiInvoice.companyName as string) || (company?.name as string);
  const items = apiInvoice.items as ApiInvoiceItem[] | undefined;

  return {
    id: apiInvoice.id as string,
    invoiceNumber: (apiInvoice.invoiceNumber as string) || (apiInvoice.id as string),
    issueDate: apiInvoice.issueDate as string,
    dueDate: apiInvoice.dueDate as string,
    createdAt: apiInvoice.createdAt as string,
    updatedAt: apiInvoice.updatedAt as string,
    amount: apiInvoice.total as number,
    currency: (apiInvoice.currency as string) || "EUR",
    lineItems:
      items?.map((item) => ({
        name: item.productName || item.description || "",
        quantity: item.quantity || 1,
        price: item.unitPrice || 0,
        unit: item.unit || "pcs",
        discount: item.discount || 0,
        vat: item.vat ?? item.vatRate ?? (apiInvoice.vatRate as number) ?? 20,
      })) || [],
    paymentDetails: null,
    customerDetails,
    fromDetails: null,
    noteDetails: apiInvoice.notes
      ? {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: apiInvoice.notes as string }] },
          ],
        }
      : null,
    note: apiInvoice.notes as string | null,
    internalNote: null,
    vat: (apiInvoice.vat as number) || null,
    tax: (apiInvoice.tax as number) || null,
    discount: (apiInvoice.discount as number) || null,
    subtotal: apiInvoice.subtotal as number,
    status: ((): Invoice["status"] => {
      const raw = String(apiInvoice.status || "").toLowerCase();
      const map: Record<string, Invoice["status"]> = {
        draft: "draft",
        overdue: "overdue",
        paid: "paid",
        unpaid: "unpaid",
        canceled: "canceled",
        cancelled: "canceled",
        scheduled: "scheduled",
      };
      return map[raw] ?? "draft";
    })(),
    template: {
      ...DEFAULT_INVOICE_TEMPLATE,
      logoUrl: getLogoDataUrl(),
      taxRate: (apiInvoice.taxRate as number) || 0,
      vatRate: (apiInvoice.vatRate as number) || 20,
      currency: (apiInvoice.currency as string) || "EUR",
      includeVat: true,
      includeTax: Boolean(apiInvoice.tax),
      includeDiscount: true,
      includeDecimals: true,
    },
    token: (apiInvoice.token as string) || "",
    filePath: null,
    paidAt: apiInvoice.paidAt as string | null,
    sentAt: apiInvoice.sentAt as string | null,
    viewedAt: apiInvoice.viewedAt as string | null,
    reminderSentAt: null,
    sentTo: null,
    topBlock: null,
    bottomBlock: null,
    customerId: apiInvoice.companyId as string,
    customerName: companyName || "Customer",
    customer: {
      id: apiInvoice.companyId as string,
      name: companyName || "Customer",
      website: (company?.website as string) || null,
      email: (company?.email as string) || null,
    },
    team: null,
    scheduledAt: null,
  };
}

function buildQuoteObject(apiQuote: Record<string, unknown>): Quote {
  let customerDetails = null;
  if (apiQuote.customerDetails) {
    customerDetails =
      typeof apiQuote.customerDetails === "string"
        ? JSON.parse(apiQuote.customerDetails as string)
        : apiQuote.customerDetails;
  } else {
    const company = apiQuote.company as Record<string, unknown> | undefined;
    const customerLines: string[] = [];
    const companyName = (apiQuote.companyName as string) || (company?.name as string);
    if (companyName) customerLines.push(companyName);
    if (company?.addressLine1) customerLines.push(company.addressLine1 as string);
    else if (company?.address) customerLines.push(company.address as string);
    if (company?.addressLine2) customerLines.push(company.addressLine2 as string);
    const cityLine = [company?.city, company?.zip || company?.postalCode, company?.country]
      .filter(Boolean)
      .join(", ");
    if (cityLine) customerLines.push(cityLine);
    if (company?.billingEmail) customerLines.push(company.billingEmail as string);
    else if (company?.email) customerLines.push(company.email as string);
    if (company?.vatNumber) customerLines.push(`PIB: ${company.vatNumber}`);
    customerDetails =
      customerLines.length > 0
        ? {
            type: "doc",
            content: customerLines.map((line) => ({
              type: "paragraph",
              content: [{ type: "text", text: line }],
            })),
          }
        : null;
  }

  const company = apiQuote.company as Record<string, unknown> | undefined;
  const companyName = (apiQuote.companyName as string) || (company?.name as string);
  const items = apiQuote.items as ApiInvoiceItem[] | undefined;

  return {
    id: apiQuote.id as string,
    quoteNumber: (apiQuote.quoteNumber as string) || (apiQuote.id as string),
    issueDate: apiQuote.issueDate as string,
    validUntil: apiQuote.validUntil as string,
    createdAt: apiQuote.createdAt as string,
    updatedAt: apiQuote.updatedAt as string,
    amount: apiQuote.total as number,
    currency: (apiQuote.currency as string) || "EUR",
    lineItems:
      items?.map((item) => ({
        name: item.productName || item.description || "",
        quantity: item.quantity || 1,
        price: item.unitPrice || 0,
        unit: item.unit || "pcs",
        discount: item.discount || 0,
        vat: item.vat ?? item.vatRate ?? (apiQuote.vatRate as number) ?? 20,
      })) || [],
    paymentDetails: null,
    customerDetails,
    fromDetails: null,
    noteDetails: apiQuote.notes
      ? {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: apiQuote.notes as string }] },
          ],
        }
      : null,
    note: apiQuote.notes as string | null,
    internalNote: null,
    vat: (apiQuote.vat as number) || null,
    tax: (apiQuote.tax as number) || null,
    discount: (apiQuote.discount as number) || null,
    subtotal: apiQuote.subtotal as number,
    status: ((): Quote["status"] => {
      const raw = String(apiQuote.status || "").toLowerCase();
      const map: Record<string, Quote["status"]> = {
        draft: "draft",
        sent: "sent",
        accepted: "accepted",
        rejected: "rejected",
        expired: "expired",
        viewed: "sent",
      };
      return map[raw] ?? "draft";
    })(),
    template: {
      ...DEFAULT_QUOTE_TEMPLATE,
      logoUrl: getLogoDataUrl(),
      taxRate: (apiQuote.taxRate as number) || 0,
      vatRate: (apiQuote.vatRate as number) || 20,
      currency: (apiQuote.currency as string) || "EUR",
      includeVat: true,
      includeTax: Boolean(apiQuote.tax),
      includeDiscount: true,
      includeDecimals: true,
    },
    token: (apiQuote.token as string) || "",
    filePath: null,
    sentAt: (apiQuote.sentAt as string) || null,
    viewedAt: (apiQuote.viewedAt as string) || null,
    acceptedAt: (apiQuote.acceptedAt as string) || null,
    rejectedAt: (apiQuote.rejectedAt as string) || null,
    sentTo: null,
    topBlock: null,
    bottomBlock: null,
    customerId: apiQuote.companyId as string,
    customerName: companyName || "Customer",
    customer: {
      id: apiQuote.companyId as string,
      name: companyName || "Customer",
      website: (company?.website as string) || null,
      email: (company?.email as string) || null,
    },
    team: null,
    scheduledAt: null,
  };
}

async function generateInvoicePdf(invoice: Invoice): Promise<Uint8Array> {
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { PdfTemplate } = await import("@/components/invoice/templates/pdf-template");
  const pdfDocument = await PdfTemplate({ invoice });
  return renderToBuffer(pdfDocument as unknown as Parameters<typeof renderToBuffer>[0]);
}

async function generateQuotePdf(quote: Quote): Promise<Uint8Array> {
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { PdfTemplate } = await import("@/components/quote/templates/pdf-template");
  const pdfDocument = await PdfTemplate({ quote });
  return renderToBuffer(pdfDocument as unknown as Parameters<typeof renderToBuffer>[0]);
}
