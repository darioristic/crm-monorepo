/**
 * File Proxy API Route
 *
 * Securely serves files from the vault storage through the frontend.
 * This route proxies requests to the backend API with proper authentication.
 */

import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get("filePath");

    if (!filePath) {
      return NextResponse.json({ error: "filePath parameter is required" }, { status: 400 });
    }

    // Get auth token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get("access_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Proxy the request to the backend API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const downloadUrl = `${apiUrl}/api/v1/documents/download/${filePath}`;

    const response = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "File not found or access denied" },
        { status: response.status }
      );
    }

    // Get content type from response
    const contentType = response.headers.get("content-type") || "application/octet-stream";

    // Stream the response
    const blob = await response.blob();

    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    logger.error("Proxy error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
