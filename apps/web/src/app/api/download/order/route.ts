import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Order } from "@/types/order";
import { DEFAULT_ORDER_TEMPLATE } from "@/types/order";

function getLogoDataUrl(logoPath?: string): string | null {
  try {
    let filePath: string;
    if (logoPath?.startsWith("data:")) return logoPath;
    if (logoPath?.startsWith("http")) return logoPath;
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
      ext === "svg"
        ? "image/svg+xml"
        : ext === "jpg" || ext === "jpeg"
          ? "image/jpeg"
          : "image/png";
    return `data:${mimeType};base64,${base64}`;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const orderId = searchParams.get("id");

  if (!orderId) {
    return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
  }

  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const fetchOptions: RequestInit = { headers: { Cookie: cookieHeader } };
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

    const response = await fetch(`${baseUrl}/api/v1/orders/${orderId}`, fetchOptions);
    if (!response.ok) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    const data = await response.json();
    const apiOrder = data.data;

    // Customer (Bill to)
    let customerDetails = null;
    if (apiOrder.customerDetails) {
      customerDetails =
        typeof apiOrder.customerDetails === "string"
          ? JSON.parse(apiOrder.customerDetails)
          : apiOrder.customerDetails;
    } else {
      try {
        const companyRes = await fetch(
          `${baseUrl}/api/v1/companies/${apiOrder.companyId}`,
          fetchOptions
        );
        if (companyRes.ok) {
          const companyData = await companyRes.json();
          const company = companyData.data;
          const lines: string[] = [];
          if (company?.name) lines.push(company.name);
          if ((company as any)?.addressLine1) lines.push((company as any).addressLine1);
          else if (company?.address) lines.push(company.address);
          if ((company as any)?.addressLine2) lines.push((company as any).addressLine2);
          const postal = (company as any)?.postalCode || company?.zip;
          const cityLine = [company?.city, postal, company?.country].filter(Boolean).join(", ");
          if (cityLine) lines.push(cityLine);
          const email = (company as any)?.billingEmail || company?.email;
          if (email) lines.push(email);
          if (company?.phone) lines.push(company.phone);
          if (company?.vatNumber) lines.push(`PIB: ${company.vatNumber}`);
          const mbSource = (company as any)?.companyNumber || (company as any)?.registrationNumber;
          if (mbSource) lines.push(`MB: ${String(mbSource)}`);
          customerDetails =
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
      } catch {}
      // Fallback if company fetch is forbidden or failed
      if (!customerDetails) {
        const company = apiOrder.company || {};
        const lines: string[] = [];
        const name = apiOrder.companyName || company.name;
        if (name) lines.push(name);
        if ((company as any).addressLine1) lines.push((company as any).addressLine1);
        else if (company.address) lines.push(company.address);
        if ((company as any).addressLine2) lines.push((company as any).addressLine2);
        const postal = (company as any).postalCode || company.zip;
        const cityLine = [company.city, postal, company.country].filter(Boolean).join(", ");
        if (cityLine) lines.push(cityLine);
        const email = (company as any).billingEmail || company.email;
        if (email) lines.push(email);
        if (company.phone) lines.push(company.phone);
        if ((company as any).vatNumber) lines.push(`PIB: ${(company as any).vatNumber}`);
        const mbSource = (company as any).companyNumber || (company as any).registrationNumber;
        if (mbSource) lines.push(`MB: ${String(mbSource)}`);
        customerDetails =
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
    }

    // From (Tenant company)
    let fromDetails = null;
    if (apiOrder.fromDetails) {
      fromDetails =
        typeof apiOrder.fromDetails === "string"
          ? JSON.parse(apiOrder.fromDetails)
          : apiOrder.fromDetails;
    } else {
      try {
        const userRes = await fetch(`${baseUrl}/api/v1/users/${apiOrder.createdBy}`, fetchOptions);
        if (userRes.ok) {
          const userData = await userRes.json();
          const company = userData.data?.company;
          const lines: string[] = [];
          if (company?.name) lines.push(company.name);
          if (company?.address) lines.push(company.address);
          const cityLine = [company?.city, company?.zip, company?.country]
            .filter(Boolean)
            .join(", ");
          if (cityLine) lines.push(cityLine);
          if (company?.email) lines.push(company.email);
          if (company?.phone) lines.push(company.phone);
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
      } catch {}
    }

    const logoUrl = getLogoDataUrl(apiOrder.logoUrl);
    const companyName = apiOrder.companyName || apiOrder.company?.name;

    const order: Order = {
      id: apiOrder.id,
      orderNumber: apiOrder.orderNumber,
      issueDate: apiOrder.issueDate || apiOrder.createdAt,
      createdAt: apiOrder.createdAt,
      updatedAt: apiOrder.updatedAt,
      amount: apiOrder.total,
      currency: apiOrder.currency || "EUR",
      lineItems:
        apiOrder.items?.map((item: any) => ({
          name: item.productName || item.description || "",
          quantity: item.quantity || 1,
          price: item.unitPrice || 0,
          unit: item.unit || "pcs",
          discount: item.discount || 0,
          vat: item.vat ?? item.vatRate ?? apiOrder.vatRate ?? 20,
        })) || [],
      paymentDetails: apiOrder.terms
        ? {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: apiOrder.terms }],
              },
            ],
          }
        : null,
      customerDetails,
      fromDetails,
      noteDetails: apiOrder.notes
        ? {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: apiOrder.notes }],
              },
            ],
          }
        : null,
      note: apiOrder.notes,
      internalNote: null,
      vat: apiOrder.vat || null,
      tax: apiOrder.tax || null,
      discount: apiOrder.discount || null,
      subtotal: apiOrder.subtotal,
      status: apiOrder.status,
      template: {
        ...DEFAULT_ORDER_TEMPLATE,
        ...(apiOrder.templateSettings || {}),
        logoUrl: logoUrl,
        taxRate: apiOrder.taxRate || 0,
        vatRate: apiOrder.vatRate || 20,
        currency: apiOrder.currency || "EUR",
        includeVat: true,
        includeTax: Boolean(apiOrder.tax),
        includeDiscount: true,
        includeDecimals: true,
      },
      token: apiOrder.token || "",
      filePath: null,
      completedAt: null,
      viewedAt: null,
      cancelledAt: null,
      refundedAt: null,
      sentTo: null,
      topBlock: null,
      bottomBlock: null,
      customerId: apiOrder.companyId,
      customerName: companyName || "Customer",
      quoteId: apiOrder.quoteId || null,
      invoiceId: apiOrder.invoiceId || null,
      customer: {
        id: apiOrder.companyId,
        name: companyName || "Customer",
        website: apiOrder.company?.website || null,
        email: apiOrder.company?.email || null,
      },
      team: null,
      scheduledAt: null,
    };

    const { renderToStream } = await import("@react-pdf/renderer");
    const { PdfTemplate } = await import("@/components/order/templates/pdf-template");
    const pdfDocument = await PdfTemplate({ order });
    const stream = await renderToStream(pdfDocument as any);
    const blob = await new Response(stream).blob();

    const headers: Record<string, string> = {
      "Content-Type": "application/pdf",
      "Cache-Control": "no-store, max-age=0",
      "Content-Disposition": `attachment; filename="${order.orderNumber || orderId}.pdf"`,
    };

    return new Response(blob, { headers });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate PDF", details: errorMessage },
      { status: 500 }
    );
  }
}
