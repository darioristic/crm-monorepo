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

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";
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

    let fromDetails = null;
    if (apiDeliveryNote.fromDetails) {
      fromDetails =
        typeof apiDeliveryNote.fromDetails === "string"
          ? JSON.parse(apiDeliveryNote.fromDetails)
          : apiDeliveryNote.fromDetails;
    } else {
      try {
        const userRes = await fetch(
          `${baseUrl}/api/v1/users/${apiDeliveryNote.createdBy}`,
          fetchOptions
        );
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

    // Dynamically import PDF components
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const { PdfTemplate } = await import("@/components/delivery-note/templates/pdf-template");

    // Generate PDF
    const pdfDocument = await PdfTemplate({
      deliveryNote: apiDeliveryNote,
      fromDetails: fromDetails,
    });
    const buffer = await renderToBuffer(pdfDocument as any);

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
