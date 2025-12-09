import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import type { Invoice } from "@/types/invoice";
import { DEFAULT_INVOICE_TEMPLATE } from "@/types/invoice";

export const runtime = "nodejs";

// Get logo as base64 data URL for PDF rendering
// PDF renderer can't fetch from localhost, so we read the file directly
function getLogoDataUrl(logoPath?: string): string | null {
  try {
    // Determine the path to read
    let filePath: string;

    if (logoPath?.startsWith("data:")) {
      // Already a data URL, return as-is
      return logoPath;
    }

    if (logoPath?.startsWith("http")) {
      // External URL - can't read directly, return as-is
      // Note: PDF renderer may still have issues with this
      return logoPath;
    }

    if (logoPath?.startsWith("/")) {
      // Relative URL like /logo.png - read from public folder
      filePath = join(process.cwd(), "public", logoPath.substring(1));
    } else {
      // Default to logo.png in public folder
      filePath = join(process.cwd(), "public", "logo.png");
    }

    if (!existsSync(filePath)) {
      logger.warn("Logo file not found", { filePath });
      return null;
    }

    const logoBuffer = readFileSync(filePath);
    const base64 = logoBuffer.toString("base64");

    // Determine MIME type from extension
    const ext = filePath.toLowerCase().split(".").pop();
    const mimeType =
      ext === "svg"
        ? "image/svg+xml"
        : ext === "jpg" || ext === "jpeg"
          ? "image/jpeg"
          : "image/png";

    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    logger.error("Error reading logo file:", error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get("token");
  const invoiceId = searchParams.get("id");
  const logoParam = searchParams.get("logo") || undefined;

  if (!token && !invoiceId) {
    return NextResponse.json({ error: "Token or invoice ID is required" }, { status: 400 });
  }

  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    let resolvedId = invoiceId || null;
    if (token && !resolvedId) {
      const res = await fetch(`${baseUrl}/api/invoices/token/${token}`, {
        headers: { Cookie: cookieHeader },
      });
      if (!res.ok) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
      }
      const data = await res.json();
      resolvedId = data?.data?.id || null;
      if (!resolvedId) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
      }
    }

    const pdfResp = await fetch(`${baseUrl}/api/v1/invoices/${resolvedId}/pdf`, {
      headers: { Cookie: cookieHeader },
    });

    if (pdfResp.ok) {
      const headers: Record<string, string> = {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store, max-age=0",
        "Content-Disposition": `attachment; filename="${resolvedId}.pdf"`,
      };
      const blob = await pdfResp.blob();
      return new Response(blob, { headers });
    }

    const metaResp = await fetch(`${baseUrl}/api/v1/invoices/${resolvedId}`, {
      headers: { Cookie: cookieHeader },
    });
    if (!metaResp.ok) {
      return NextResponse.json({ error: "Invoice not found" }, { status: metaResp.status });
    }
    const metaJson = await metaResp.json();
    const apiInvoice = metaJson.data;

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

    let fromDetails = null;
    if (apiInvoice.fromDetails) {
      fromDetails =
        typeof apiInvoice.fromDetails === "string"
          ? JSON.parse(apiInvoice.fromDetails)
          : apiInvoice.fromDetails;
    } else if (apiInvoice.tenantId) {
      // Fallback: fetch the tenant account (seller business details)
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
          const cityLine = [account?.city, account?.zip, account?.country]
            .filter(Boolean)
            .join(", ");
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
        // Ignore errors, fromDetails will remain null
      }
    }

    const companyName = apiInvoice.companyName || apiInvoice.company?.name;
    const invoice: Invoice = {
      id: apiInvoice.id,
      invoiceNumber: apiInvoice.invoiceNumber,
      issueDate: apiInvoice.issueDate,
      dueDate: apiInvoice.dueDate,
      createdAt: apiInvoice.createdAt,
      updatedAt: apiInvoice.updatedAt,
      amount: apiInvoice.total,
      currency: apiInvoice.currency || "EUR",
      lineItems:
        apiInvoice.items?.map((item: any) => ({
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
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: apiInvoice.terms }],
              },
            ],
          }
        : null,
      customerDetails,
      fromDetails,
      noteDetails: apiInvoice.notes
        ? {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: apiInvoice.notes }],
              },
            ],
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
        logoUrl: getLogoDataUrl(logoParam),
        taxRate: apiInvoice.taxRate || 0,
        vatRate: apiInvoice.vatRate || 20,
        currency: apiInvoice.currency || "EUR",
        includeVat: true,
        includeTax: Boolean(apiInvoice.tax),
        includeDiscount: true,
        includeDecimals: true,
      },
      token: token || apiInvoice.token || "",
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

    const { renderToBuffer } = await import("@react-pdf/renderer");
    const { PdfTemplate } = await import("@/components/invoice/templates/pdf-template");
    const pdfDocument = await PdfTemplate({ invoice });
    const buffer = await renderToBuffer(pdfDocument as any);
    const headers: Record<string, string> = {
      "Content-Type": "application/pdf",
      "Cache-Control": "no-store, max-age=0",
      "Content-Disposition": `attachment; filename="${invoice.invoiceNumber || resolvedId}.pdf"`,
    };
    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(buffer);
        controller.close();
      },
    });
    return new Response(readable, { headers });
  } catch (error) {
    logger.error("Error generating PDF:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate PDF", details: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const body = (await request.json()) as {
      id?: string;
      token?: string;
      logo?: string;
    };

    const invoiceId = body.id || null;
    const token = body.token || null;
    let resolvedId = invoiceId || null;

    if (token && !resolvedId) {
      const res = await fetch(`${baseUrl}/api/invoices/token/${token}`, {
        headers: { Cookie: cookieHeader },
      });
      if (!res.ok) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
      }
      const data = await res.json();
      resolvedId = data?.data?.id || null;
      if (!resolvedId) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
      }
    }

    if (!resolvedId) {
      return NextResponse.json({ error: "Invoice ID is required" }, { status: 400 });
    }

    const metaResp = await fetch(`${baseUrl}/api/v1/invoices/${resolvedId}`, {
      headers: { Cookie: cookieHeader },
    });
    if (!metaResp.ok) {
      return NextResponse.json({ error: "Invoice not found" }, { status: metaResp.status });
    }
    const metaJson = await metaResp.json();
    const apiInvoice = metaJson.data;

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

    let fromDetails = null;
    if (apiInvoice.fromDetails) {
      fromDetails =
        typeof apiInvoice.fromDetails === "string"
          ? JSON.parse(apiInvoice.fromDetails)
          : apiInvoice.fromDetails;
    } else if (apiInvoice.tenantId) {
      // Fallback: fetch the tenant account (seller business details)
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
          const cityLine = [account?.city, account?.zip, account?.country]
            .filter(Boolean)
            .join(", ");
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
        // Ignore errors, fromDetails will remain null
      }
    }

    const companyName = apiInvoice.companyName || apiInvoice.company?.name;
    const invoice: Invoice = {
      id: apiInvoice.id,
      invoiceNumber: apiInvoice.invoiceNumber,
      issueDate: apiInvoice.issueDate,
      dueDate: apiInvoice.dueDate,
      createdAt: apiInvoice.createdAt,
      updatedAt: apiInvoice.updatedAt,
      amount: apiInvoice.total,
      currency: apiInvoice.currency || "EUR",
      lineItems:
        apiInvoice.items?.map((item: any) => ({
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
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: apiInvoice.terms }],
              },
            ],
          }
        : null,
      customerDetails,
      fromDetails,
      noteDetails: apiInvoice.notes
        ? {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: apiInvoice.notes }],
              },
            ],
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
      token: token || apiInvoice.token || "",
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

    const { renderToBuffer } = await import("@react-pdf/renderer");
    const { PdfTemplate } = await import("@/components/invoice/templates/pdf-template");
    const pdfDocument = await PdfTemplate({ invoice });
    const buffer = await renderToBuffer(pdfDocument as any);
    const headers: Record<string, string> = {
      "Content-Type": "application/pdf",
      "Cache-Control": "no-store, max-age=0",
      "Content-Disposition": `attachment; filename="${invoice.invoiceNumber || resolvedId}.pdf"`,
    };
    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(buffer);
        controller.close();
      },
    });
    return new Response(readable, { headers });
  } catch (error) {
    logger.error("Error generating PDF:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate PDF", details: errorMessage },
      { status: 500 }
    );
  }
}
