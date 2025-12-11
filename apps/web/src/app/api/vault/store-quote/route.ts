/**
 * Store Quote PDF in Vault
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import type { Quote } from "@/types/quote";
import { DEFAULT_QUOTE_TEMPLATE } from "@/types/quote";

type QuoteItemApi = {
  productName?: string;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  unit?: string;
  discount?: number;
  vat?: number;
  vatRate?: number;
};

export const runtime = "nodejs";

function getLogoDataUrl(logoPath?: string): string | null {
  try {
    if (logoPath?.startsWith("data:")) return logoPath;
    if (logoPath?.startsWith("http")) return logoPath;
    let filePath: string;
    if (logoPath?.startsWith("/")) {
      filePath = join(process.cwd(), "public", logoPath.substring(1));
    } else {
      filePath = join(process.cwd(), "public", "logo.png");
    }
    if (!existsSync(filePath)) return null;
    const logoBuffer = readFileSync(filePath);
    const base64 = logoBuffer.toString("base64");
    const ext = filePath.toLowerCase().split(".").pop();
    const mimeType =
      ext === "svg" ? "image/svg+xml" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
    return `data:${mimeType};base64,${base64}`;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie") || "";
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  try {
    const body = (await request.json()) as { quoteId: string; logo?: string };

    if (!body.quoteId) {
      return NextResponse.json({ error: "Quote ID is required" }, { status: 400 });
    }

    // Step 1: Fetch quote data
    const metaResp = await fetch(`${baseUrl}/api/v1/quotes/${body.quoteId}`, {
      headers: { Cookie: cookieHeader },
    });

    if (!metaResp.ok) {
      return NextResponse.json({ error: "Quote not found" }, { status: metaResp.status });
    }

    const metaJson = await metaResp.json();
    const apiQuote = metaJson.data;

    // Build customer details
    let customerDetails = null;
    if (apiQuote.customerDetails) {
      customerDetails =
        typeof apiQuote.customerDetails === "string"
          ? JSON.parse(apiQuote.customerDetails)
          : apiQuote.customerDetails;
    } else {
      const customerLines: string[] = [];
      const companyName = apiQuote.companyName || apiQuote.company?.name;
      if (companyName) customerLines.push(companyName);
      if (apiQuote.company?.addressLine1) customerLines.push(apiQuote.company.addressLine1);
      else if (apiQuote.company?.address) customerLines.push(apiQuote.company.address);
      if (apiQuote.company?.addressLine2) customerLines.push(apiQuote.company.addressLine2);
      const cityLine = [
        apiQuote.company?.city,
        apiQuote.company?.zip || apiQuote.company?.postalCode,
        apiQuote.company?.country,
      ]
        .filter(Boolean)
        .join(", ");
      if (cityLine) customerLines.push(cityLine);
      if (apiQuote.company?.billingEmail) customerLines.push(apiQuote.company.billingEmail);
      else if (apiQuote.company?.email) customerLines.push(apiQuote.company.email);
      if (apiQuote.company?.phone) customerLines.push(apiQuote.company.phone);
      if (apiQuote.company?.vatNumber) customerLines.push(`PIB: ${apiQuote.company.vatNumber}`);
      if (apiQuote.company?.registrationNumber)
        customerLines.push(`MB: ${apiQuote.company.registrationNumber}`);
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

    // Build from details
    let fromDetails = null;
    if (apiQuote.fromDetails) {
      fromDetails =
        typeof apiQuote.fromDetails === "string"
          ? JSON.parse(apiQuote.fromDetails)
          : apiQuote.fromDetails;
    } else if (apiQuote.tenantId) {
      try {
        const accountRes = await fetch(`${baseUrl}/api/v1/tenant-accounts/${apiQuote.tenantId}`, {
          headers: { Cookie: cookieHeader },
        });
        if (accountRes.ok) {
          const accountData = await accountRes.json();
          const account = accountData.data;
          const lines: string[] = [];
          if (account?.name) lines.push(account.name);
          if (account?.address) lines.push(account.address);
          const cityLine = [account?.city, account?.zip, account?.country].filter(Boolean).join(", ");
          if (cityLine) lines.push(cityLine);
          if (account?.email) lines.push(account.email);
          if (account?.phone) lines.push(account.phone);
          if (account?.website) lines.push(account.website);
          if (account?.vatNumber) lines.push(`PIB: ${account.vatNumber}`);
          if (account?.companyNumber) lines.push(`MB: ${account.companyNumber}`);
          fromDetails =
            lines.length > 0
              ? {
                  type: "doc",
                  content: lines.map((line) => ({
                    type: "paragraph",
                    content: [{ type: "text", text: line }],
                  })),
                }
              : null;
        }
      } catch {
        // Ignore errors
      }
    }

    const companyName = apiQuote.companyName || apiQuote.company?.name;
    const quoteNumber = apiQuote.quoteNumber || body.quoteId;

    const quote: Quote = {
      id: apiQuote.id,
      quoteNumber,
      issueDate: apiQuote.issueDate,
      validUntil: apiQuote.validUntil,
      createdAt: apiQuote.createdAt,
      updatedAt: apiQuote.updatedAt,
      amount: apiQuote.total,
      currency: apiQuote.currency || "EUR",
      lineItems:
        apiQuote.items?.map((item: QuoteItemApi) => ({
          name: item.productName || item.description || "",
          quantity: item.quantity || 1,
          price: item.unitPrice || 0,
          unit: item.unit || "pcs",
          discount: item.discount || 0,
          vat: item.vat ?? item.vatRate ?? apiQuote.vatRate ?? 20,
        })) || [],
      customerDetails,
      fromDetails,
      noteDetails: apiQuote.notes
        ? {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: apiQuote.notes }] }],
          }
        : null,
      note: apiQuote.notes,
      vat: apiQuote.vat || null,
      tax: apiQuote.tax || null,
      discount: apiQuote.discount || null,
      subtotal: apiQuote.subtotal,
      status: apiQuote.status,
      template: {
        ...DEFAULT_QUOTE_TEMPLATE,
        ...(apiQuote.templateSettings || {}),
        logoUrl: getLogoDataUrl(body.logo),
        taxRate: apiQuote.taxRate || 0,
        vatRate: apiQuote.vatRate || 20,
        currency: apiQuote.currency || "EUR",
        includeVat: true,
        includeTax: Boolean(apiQuote.tax),
        includeDiscount: true,
        includeDecimals: true,
      },
      customerId: apiQuote.companyId,
      customerName: companyName || "Customer",
      customer: {
        id: apiQuote.companyId,
        name: companyName || "Customer",
        website: apiQuote.company?.website || null,
        email: apiQuote.company?.email || null,
      },
    };

    // Step 2: Generate PDF
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const { QuotePdfTemplate } = await import("@/components/quote/templates/pdf-template");
    const pdfDocument = await QuotePdfTemplate({ quote });
    const pdfBuffer = await renderToBuffer(pdfDocument as unknown as Parameters<typeof renderToBuffer>[0]);

    // Step 3: Store in Vault
    const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");

    const storeResponse = await fetch(`${baseUrl}/api/v1/documents/store-generated`, {
      method: "POST",
      headers: {
        Cookie: cookieHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pdfBase64,
        documentType: "quote",
        entityId: body.quoteId,
        title: `Quote ${quoteNumber}`,
        documentNumber: quoteNumber,
        metadata: {
          customerName: companyName,
          total: apiQuote.total,
          currency: apiQuote.currency || "EUR",
          validUntil: apiQuote.validUntil,
          status: apiQuote.status,
        },
      }),
    });

    if (!storeResponse.ok) {
      const errorData = await storeResponse.json().catch(() => ({}));
      logger.error("Failed to store quote in vault", { status: storeResponse.status, error: errorData });
      return NextResponse.json({ error: "Failed to store quote in vault", details: errorData }, { status: 500 });
    }

    const storeResult = await storeResponse.json();

    logger.info("Quote PDF stored in vault", {
      quoteId: body.quoteId,
      quoteNumber,
      documentId: storeResult.data?.id,
    });

    return NextResponse.json({
      success: true,
      documentId: storeResult.data?.id,
      quoteNumber,
    });
  } catch (error) {
    logger.error("Error storing quote in vault:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to store quote", details: errorMessage }, { status: 500 });
  }
}
