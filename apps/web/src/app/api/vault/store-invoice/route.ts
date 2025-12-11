/**
 * Store Invoice PDF in Vault
 *
 * This endpoint generates an invoice PDF and stores it in Vault server-side.
 * Unlike the fire-and-forget client approach, this ensures reliable storage.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import type { Invoice } from "@/types/invoice";
import { DEFAULT_INVOICE_TEMPLATE } from "@/types/invoice";

type InvoiceItemApi = {
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
    const body = (await request.json()) as {
      invoiceId: string;
      logo?: string;
    };

    if (!body.invoiceId) {
      return NextResponse.json({ error: "Invoice ID is required" }, { status: 400 });
    }

    // Step 1: Fetch invoice data
    const metaResp = await fetch(`${baseUrl}/api/v1/invoices/${body.invoiceId}`, {
      headers: { Cookie: cookieHeader },
    });

    if (!metaResp.ok) {
      return NextResponse.json({ error: "Invoice not found" }, { status: metaResp.status });
    }

    const metaJson = await metaResp.json();
    const apiInvoice = metaJson.data;

    // Build customer details
    let customerDetails = null;
    if (apiInvoice.customerDetails) {
      customerDetails =
        typeof apiInvoice.customerDetails === "string"
          ? JSON.parse(apiInvoice.customerDetails)
          : apiInvoice.customerDetails;
    } else {
      const customerLines: string[] = [];
      const companyName = apiInvoice.companyName || apiInvoice.company?.name;
      if (companyName) customerLines.push(companyName);
      if (apiInvoice.company?.addressLine1) customerLines.push(apiInvoice.company.addressLine1);
      else if (apiInvoice.company?.address) customerLines.push(apiInvoice.company.address);
      if (apiInvoice.company?.addressLine2) customerLines.push(apiInvoice.company.addressLine2);
      const cityLine = [
        apiInvoice.company?.city,
        apiInvoice.company?.zip || apiInvoice.company?.postalCode,
        apiInvoice.company?.country,
      ]
        .filter(Boolean)
        .join(", ");
      if (cityLine) customerLines.push(cityLine);
      if (apiInvoice.company?.billingEmail) customerLines.push(apiInvoice.company.billingEmail);
      else if (apiInvoice.company?.email) customerLines.push(apiInvoice.company.email);
      if (apiInvoice.company?.phone) customerLines.push(apiInvoice.company.phone);
      if (apiInvoice.company?.vatNumber) customerLines.push(`PIB: ${apiInvoice.company.vatNumber}`);
      if (apiInvoice.company?.registrationNumber)
        customerLines.push(`MB: ${apiInvoice.company.registrationNumber}`);
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
    if (apiInvoice.fromDetails) {
      fromDetails =
        typeof apiInvoice.fromDetails === "string"
          ? JSON.parse(apiInvoice.fromDetails)
          : apiInvoice.fromDetails;
    } else if (apiInvoice.tenantId) {
      try {
        const accountRes = await fetch(`${baseUrl}/api/v1/tenant-accounts/${apiInvoice.tenantId}`, {
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

    const companyName = apiInvoice.companyName || apiInvoice.company?.name;
    const invoiceNumber = apiInvoice.invoiceNumber || body.invoiceId;

    // Build invoice object for PDF generation
    const invoice: Invoice = {
      id: apiInvoice.id,
      invoiceNumber,
      issueDate: apiInvoice.issueDate,
      dueDate: apiInvoice.dueDate,
      createdAt: apiInvoice.createdAt,
      updatedAt: apiInvoice.updatedAt,
      amount: apiInvoice.total,
      currency: apiInvoice.currency || "EUR",
      lineItems:
        apiInvoice.items?.map((item: InvoiceItemApi) => ({
          name: item.productName || item.description || "",
          quantity: item.quantity || 1,
          price: item.unitPrice || 0,
          unit: item.unit || "pcs",
          discount: item.discount || 0,
          vat: item.vat ?? item.vatRate ?? apiInvoice.vatRate ?? 20,
        })) || [],
      paymentDetails: apiInvoice.terms
        ? {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: apiInvoice.terms }] }],
          }
        : null,
      customerDetails,
      fromDetails,
      noteDetails: apiInvoice.notes
        ? {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: apiInvoice.notes }] }],
          }
        : null,
      note: apiInvoice.notes,
      internalNote: null,
      vat: apiInvoice.vat || null,
      tax: apiInvoice.tax || null,
      discount: apiInvoice.discount || null,
      subtotal: apiInvoice.subtotal,
      status: apiInvoice.status,
      template: {
        ...DEFAULT_INVOICE_TEMPLATE,
        ...(apiInvoice.templateSettings || {}),
        logoUrl: getLogoDataUrl(body.logo),
        taxRate: apiInvoice.taxRate || 0,
        vatRate: apiInvoice.vatRate || 20,
        currency: apiInvoice.currency || "EUR",
        includeVat: true,
        includeTax: Boolean(apiInvoice.tax),
        includeDiscount: true,
        includeDecimals: true,
      },
      token: apiInvoice.token || "",
      filePath: null,
      paidAt: apiInvoice.paidAt,
      sentAt: apiInvoice.sentAt,
      viewedAt: apiInvoice.viewedAt,
      reminderSentAt: null,
      sentTo: null,
      topBlock: null,
      bottomBlock: null,
      customerId: apiInvoice.companyId,
      customerName: companyName || "Customer",
      customer: {
        id: apiInvoice.companyId,
        name: companyName || "Customer",
        website: apiInvoice.company?.website || null,
        email: apiInvoice.company?.email || null,
      },
      team: null,
      scheduledAt: null,
    };

    // Step 2: Generate PDF
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const { PdfTemplate } = await import("@/components/invoice/templates/pdf-template");
    const pdfDocument = await PdfTemplate({ invoice });
    const pdfBuffer = await renderToBuffer(pdfDocument as unknown as Parameters<typeof renderToBuffer>[0]);

    // Step 3: Convert to base64 and store in Vault
    const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");

    const storeResponse = await fetch(`${baseUrl}/api/v1/documents/store-generated`, {
      method: "POST",
      headers: {
        Cookie: cookieHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pdfBase64,
        documentType: "invoice",
        entityId: body.invoiceId,
        title: `Invoice ${invoiceNumber}`,
        documentNumber: invoiceNumber,
        metadata: {
          customerName: companyName,
          total: apiInvoice.total,
          currency: apiInvoice.currency || "EUR",
          dueDate: apiInvoice.dueDate,
          status: apiInvoice.status,
        },
      }),
    });

    if (!storeResponse.ok) {
      const errorData = await storeResponse.json().catch(() => ({}));
      logger.error("Failed to store invoice in vault", {
        status: storeResponse.status,
        error: errorData,
      });
      return NextResponse.json(
        { error: "Failed to store invoice in vault", details: errorData },
        { status: 500 }
      );
    }

    const storeResult = await storeResponse.json();

    logger.info("Invoice PDF stored in vault", {
      invoiceId: body.invoiceId,
      invoiceNumber,
      documentId: storeResult.data?.id,
    });

    return NextResponse.json({
      success: true,
      documentId: storeResult.data?.id,
      invoiceNumber,
    });
  } catch (error) {
    logger.error("Error storing invoice in vault:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to store invoice", details: errorMessage }, { status: 500 });
  }
}
