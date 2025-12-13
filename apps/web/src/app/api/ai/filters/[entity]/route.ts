/**
 * Smart Filter API Route
 * Proxies to backend AI filter generation
 */

import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const validEntities = ["transactions", "invoices", "customers", "documents", "products", "search"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  try {
    const { entity } = await params;

    // Validate entity
    if (!validEntities.includes(entity)) {
      return NextResponse.json(
        { success: false, error: { message: `Invalid filter entity: ${entity}` } },
        { status: 400 }
      );
    }

    const body = await request.json();
    const cookieStore = await cookies();

    // Build cookie header from all cookies
    const allCookies = cookieStore.getAll();
    const cookieHeader = allCookies.map((c) => `${c.name}=${c.value}`).join("; ");

    // Proxy to backend
    const response = await fetch(`${API_URL}/api/v1/ai/filters/${entity}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      try {
        const error = JSON.parse(errorText);
        return NextResponse.json(
          {
            success: false,
            error: { message: error?.error?.message || "Filter generation failed" },
          },
          { status: response.status }
        );
      } catch {
        return NextResponse.json(
          { success: false, error: { message: errorText || "Filter generation failed" } },
          { status: response.status }
        );
      }
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Smart filter API error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Internal server error" } },
      { status: 500 }
    );
  }
}
