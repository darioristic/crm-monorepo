import { NextRequest, NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { PdfTemplate } from "@/components/invoice/templates/pdf-template";
import type { Invoice } from "@/types/invoice";
import { DEFAULT_INVOICE_TEMPLATE } from "@/types/invoice";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get("token");
  const invoiceId = searchParams.get("id");

  if (!token && !invoiceId) {
    return NextResponse.json(
      { error: "Token or invoice ID is required" },
      { status: 400 }
    );
  }

  try {
    // Fetch invoice data
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    let response;

    if (token) {
      response = await fetch(`${baseUrl}/api/invoices/token/${token}`);
    } else {
      response = await fetch(`${baseUrl}/api/invoices/${invoiceId}`);
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    const data = await response.json();
    const apiInvoice = data.data;

    // Transform API data to Invoice type
    const invoice: Invoice = {
      id: apiInvoice.id,
      invoiceNumber: apiInvoice.invoiceNumber,
      issueDate: apiInvoice.issueDate,
      dueDate: apiInvoice.dueDate,
      createdAt: apiInvoice.createdAt,
      updatedAt: apiInvoice.updatedAt,
      amount: apiInvoice.total,
      currency: apiInvoice.currency || "EUR",
      lineItems: apiInvoice.items?.map((item: any) => ({
        name: item.productName || item.description,
        quantity: item.quantity,
        price: item.unitPrice,
        unit: "pcs",
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
      customerDetails: apiInvoice.company
        ? {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: apiInvoice.company.name || "" },
                ],
              },
              {
                type: "paragraph",
                content: [
                  { type: "text", text: apiInvoice.company.address || "" },
                ],
              },
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: [
                      apiInvoice.company.city,
                      apiInvoice.company.postalCode,
                      apiInvoice.company.country,
                    ]
                      .filter(Boolean)
                      .join(", "),
                  },
                ],
              },
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: apiInvoice.company.vatNumber
                      ? `VAT: ${apiInvoice.company.vatNumber}`
                      : "",
                  },
                ],
              },
            ],
          }
        : null,
      fromDetails: null,
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
      vat: null,
      tax: apiInvoice.tax,
      discount: null,
      subtotal: apiInvoice.subtotal,
      status: apiInvoice.status,
      template: {
        ...DEFAULT_INVOICE_TEMPLATE,
        taxRate: apiInvoice.taxRate || 0,
        currency: apiInvoice.currency || "EUR",
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
      customerName: apiInvoice.company?.name,
      customer: apiInvoice.company,
      team: null,
      scheduledAt: null,
    };

    // Generate PDF
    const pdfStream = await renderToStream(PdfTemplate({ invoice }) as any);

    // Collect stream into buffer
    const chunks: Uint8Array[] = [];
    
    // Convert Node.js readable stream to buffer
    for await (const chunk of pdfStream as any) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);

    // Return PDF response
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${invoice.invoiceNumber || token || invoiceId}.pdf"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
