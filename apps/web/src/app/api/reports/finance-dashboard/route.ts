import { type NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:3001";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("access_token")?.value;
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId");

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(`${API_URL}/api/v1/reports/finance-dashboard`);
    if (tenantId) {
      url.searchParams.set("tenantId", tenantId);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (_error) {
    return NextResponse.json({ error: "Failed to fetch finance dashboard data" }, { status: 500 });
  }
}
