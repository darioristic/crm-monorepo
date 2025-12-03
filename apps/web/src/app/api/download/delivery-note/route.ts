import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { DeliveryNote } from "@crm/types";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get("token");
  const deliveryNoteId = searchParams.get("id");

  if (!token && !deliveryNoteId) {
    return NextResponse.json(
      { error: "Token or delivery note ID is required" },
      { status: 400 },
    );
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
      response = await fetch(
        `${baseUrl}/api/delivery-notes/token/${token}`,
        fetchOptions,
      );
    } else {
      response = await fetch(
        `${baseUrl}/api/v1/delivery-notes/${deliveryNoteId}`,
        fetchOptions,
      );
    }

    if (!response.ok) {
      return NextResponse.json({ error: "Delivery note not found" }, { status: 404 });
    }

    const data = await response.json();
    const apiDeliveryNote = data.data;

    // Build from details (seller info) - similar to invoice
    // For now, we'll use a simple fallback since delivery notes don't have seller/team data
    // In the future, this could be stored in localStorage or database
    let fromDetails = null;
    
    // Try to get from stored settings (this would need to be passed from client or stored in DB)
    // For now, we'll leave it null and let the PDF template handle it

    // Dynamically import PDF components
    const { renderToStream } = await import("@react-pdf/renderer");
    const { PdfTemplate } = await import(
      "@/components/delivery-note/templates/pdf-template"
    );

    // Generate PDF
    const pdfDocument = await PdfTemplate({ 
      deliveryNote: apiDeliveryNote,
      fromDetails: fromDetails,
    });
    const stream = await renderToStream(pdfDocument as any);

    // Convert stream to blob
    const blob = await new Response(stream).blob();

    const headers: Record<string, string> = {
      "Content-Type": "application/pdf",
      "Cache-Control": "no-store, max-age=0",
      "Content-Disposition": `attachment; filename="${apiDeliveryNote.deliveryNumber || token || deliveryNoteId}.pdf"`,
    };

    return new Response(blob, { headers });
  } catch (error) {
    console.error("Error generating PDF:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate PDF", details: errorMessage },
      { status: 500 },
    );
  }
}

