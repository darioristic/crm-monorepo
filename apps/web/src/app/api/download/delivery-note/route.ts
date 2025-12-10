import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get("token");
  const deliveryNoteId = searchParams.get("id");

  if (!token && !deliveryNoteId) {
    return NextResponse.json({ error: "Token or delivery note ID is required" }, { status: 400 });
  }

  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const fetchOptions: RequestInit = {
      headers: {
        Cookie: cookieHeader,
      },
    };

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    let response: Response;

    if (token) {
      response = await fetch(`${baseUrl}/api/delivery-notes/token/${token}`, fetchOptions);
    } else {
      response = await fetch(`${baseUrl}/api/v1/delivery-notes/${deliveryNoteId}`, fetchOptions);
    }

    if (!response.ok) {
      return NextResponse.json({ error: "Delivery note not found" }, { status: 404 });
    }

    const data = await response.json();
    const apiDeliveryNote = data.data;

    // Extract customerDetails
    let customerDetails = null;
    if (apiDeliveryNote.customerDetails) {
      customerDetails =
        typeof apiDeliveryNote.customerDetails === "string"
          ? JSON.parse(apiDeliveryNote.customerDetails)
          : apiDeliveryNote.customerDetails;
    }

    let fromDetails = null;
    if (apiDeliveryNote.fromDetails) {
      fromDetails =
        typeof apiDeliveryNote.fromDetails === "string"
          ? JSON.parse(apiDeliveryNote.fromDetails)
          : apiDeliveryNote.fromDetails;
    } else if (apiDeliveryNote.tenantId) {
      // Fallback: fetch the tenant account (seller business details)
      try {
        const accountRes = await fetch(
          `${baseUrl}/api/v1/tenant-accounts/${apiDeliveryNote.tenantId}`,
          fetchOptions
        );
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
      } catch {}
    }

    // Dynamically import PDF components
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const { PdfTemplate } = await import("@/components/delivery-note/templates/pdf-template");

    // Generate PDF
    const pdfDocument = await PdfTemplate({
      deliveryNote: apiDeliveryNote,
      fromDetails: fromDetails,
      customerDetails: customerDetails,
    });
    const buffer = await renderToBuffer(
      pdfDocument as unknown as Parameters<typeof renderToBuffer>[0]
    );

    const headers: Record<string, string> = {
      "Content-Type": "application/pdf",
      "Cache-Control": "no-store, max-age=0",
      "Content-Disposition": `attachment; filename="${apiDeliveryNote.deliveryNumber || token || deliveryNoteId}.pdf"`,
    };

    const uint8 = new Uint8Array(buffer);
    const arrayBuffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
    return new Response(arrayBuffer, { headers });
  } catch (error) {
    logger.error("Error generating PDF:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate PDF", details: errorMessage },
      { status: 500 }
    );
  }
}
