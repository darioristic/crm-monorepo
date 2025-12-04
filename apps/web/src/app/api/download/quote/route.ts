import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Quote } from "@/types/quote";
import { DEFAULT_QUOTE_TEMPLATE } from "@/types/quote";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

function getLogoDataUrl(logoPath?: string): string | null {
  try {
    let filePath: string;
    if (logoPath && logoPath.startsWith("data:")) return logoPath;
    if (logoPath && logoPath.startsWith("http")) return logoPath;
    if (logoPath && logoPath.startsWith("/")) {
      filePath = join(process.cwd(), "public", logoPath.substring(1));
    } else {
      filePath = join(process.cwd(), "public", "logo.png");
    }
    if (!existsSync(filePath)) return null;
    const logoBuffer = readFileSync(filePath);
    const base64 = logoBuffer.toString("base64");
    const ext = filePath.toLowerCase().split(".").pop();
    const mimeType = ext === "svg" ? "image/svg+xml" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
    return `data:${mimeType};base64,${base64}`;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const quoteId = searchParams.get("id");

  if (!quoteId) {
    return NextResponse.json({ error: "Quote ID is required" }, { status: 400 });
  }

  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const fetchOptions: RequestInit = { headers: { Cookie: cookieHeader } };
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    const response = await fetch(`${baseUrl}/api/v1/quotes/${quoteId}`, fetchOptions);
    if (!response.ok) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }
    const data = await response.json();
    const apiQuote = data.data;

    // Customer (Bill to)
    let customerDetails = null;
    if (apiQuote.customerDetails) {
      customerDetails = typeof apiQuote.customerDetails === 'string' ? JSON.parse(apiQuote.customerDetails) : apiQuote.customerDetails;
    } else {
      const customerLines: string[] = [];
      const companyName = apiQuote.companyName || apiQuote.company?.name;
      if (companyName) customerLines.push(companyName);
      if (apiQuote.company?.addressLine1) customerLines.push(apiQuote.company.addressLine1);
      else if (apiQuote.company?.address) customerLines.push(apiQuote.company.address);
      if (apiQuote.company?.addressLine2) customerLines.push(apiQuote.company.addressLine2);
      const cityLine = [apiQuote.company?.city, apiQuote.company?.zip || apiQuote.company?.postalCode, apiQuote.company?.country].filter(Boolean).join(", ");
      if (cityLine) customerLines.push(cityLine);
      if (apiQuote.company?.billingEmail) customerLines.push(apiQuote.company.billingEmail);
      else if (apiQuote.company?.email) customerLines.push(apiQuote.company.email);
      if (apiQuote.company?.phone) customerLines.push(apiQuote.company.phone);
      if (apiQuote.company?.vatNumber) customerLines.push(`PIB: ${apiQuote.company.vatNumber}`);
      if (apiQuote.company?.registrationNumber) customerLines.push(`MB: ${apiQuote.company.registrationNumber}`);
      customerDetails = customerLines.length > 0 ? { type: "doc", content: customerLines.map((line) => ({ type: "paragraph", content: [{ type: "text", text: line }] })) } : null;
    }

    // From (Tenant company)
    let fromDetails = null;
    if (apiQuote.fromDetails) {
      fromDetails = typeof apiQuote.fromDetails === 'string' ? JSON.parse(apiQuote.fromDetails) : apiQuote.fromDetails;
    } else {
      try {
        const userRes = await fetch(`${baseUrl}/api/v1/users/${apiQuote.createdBy}`, fetchOptions);
        if (userRes.ok) {
          const userData = await userRes.json();
          const company = userData.data?.company;
          const lines: string[] = [];
          if (company?.name) lines.push(company.name);
          if (company?.address) lines.push(company.address);
          const cityLine = [company?.city, company?.zip, company?.country].filter(Boolean).join(", ");
          if (cityLine) lines.push(cityLine);
          if (company?.email) lines.push(company.email);
          if (company?.phone) lines.push(company.phone);
          fromDetails = lines.length > 0 ? { type: "doc", content: lines.map((line) => ({ type: "paragraph", content: [{ type: "text", text: line }] })) } : null;
        }
      } catch {}
    }

    const logoUrl = getLogoDataUrl(apiQuote.logoUrl);
    const companyName = apiQuote.companyName || apiQuote.company?.name;

    const quote: Quote = {
      id: apiQuote.id,
      quoteNumber: apiQuote.quoteNumber,
      issueDate: apiQuote.issueDate,
      validUntil: apiQuote.validUntil,
      createdAt: apiQuote.createdAt,
      updatedAt: apiQuote.updatedAt,
      amount: apiQuote.total,
      currency: apiQuote.currency || "EUR",
      lineItems: apiQuote.items?.map((item: any) => ({
        name: item.productName || item.description || "",
        quantity: item.quantity || 1,
        price: item.unitPrice || 0,
        unit: item.unit || "pcs",
        discount: item.discount || 0,
        vat: item.vat ?? item.vatRate ?? apiQuote.vatRate ?? 20,
      })) || [],
      paymentDetails: apiQuote.terms ? { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: apiQuote.terms }] }] } : null,
      customerDetails,
      fromDetails,
      noteDetails: apiQuote.notes ? { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: apiQuote.notes }] }] } : null,
      note: apiQuote.notes,
      internalNote: null,
      vat: apiQuote.vat || null,
      tax: apiQuote.tax || null,
      discount: apiQuote.discount || null,
      subtotal: apiQuote.subtotal,
      status: apiQuote.status,
      template: {
        ...DEFAULT_QUOTE_TEMPLATE,
        ...(apiQuote.templateSettings || {}),
        logoUrl: logoUrl,
        taxRate: apiQuote.taxRate || 0,
        vatRate: apiQuote.vatRate || 20,
        currency: apiQuote.currency || "EUR",
        includeVat: true,
        includeTax: Boolean(apiQuote.tax),
        includeDiscount: true,
        includeDecimals: true,
      },
      token: apiQuote.token || "",
      filePath: null,
      sentAt: apiQuote.sentAt,
      viewedAt: apiQuote.viewedAt,
      acceptedAt: apiQuote.acceptedAt,
      rejectedAt: apiQuote.rejectedAt,
      sentTo: null,
      topBlock: null,
      bottomBlock: null,
      customerId: apiQuote.companyId,
      customerName: companyName || "Customer",
      customer: {
        id: apiQuote.companyId,
        name: companyName || "Customer",
        website: apiQuote.company?.website || null,
        email: apiQuote.company?.email || null,
      },
      team: null,
      scheduledAt: null,
    };

    const { renderToStream } = await import("@react-pdf/renderer");
    const { PdfTemplate } = await import("@/components/quote/templates/pdf-template");
    const pdfDocument = await PdfTemplate({ quote });
    const stream = await renderToStream(pdfDocument as any);
    const blob = await new Response(stream).blob();

    const headers: Record<string, string> = {
      "Content-Type": "application/pdf",
      "Cache-Control": "no-store, max-age=0",
      "Content-Disposition": `attachment; filename="${quote.quoteNumber || quoteId}.pdf"`,
    };

    return new Response(blob, { headers });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to generate PDF", details: errorMessage }, { status: 500 });
  }
}
