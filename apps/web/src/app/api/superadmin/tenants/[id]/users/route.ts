import { type NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:3001";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const token = request.cookies.get("access_token")?.value;
  const { id } = await context.params;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await fetch(`${API_URL}/api/superadmin/tenants/${id}/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (_error) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const token = request.cookies.get("access_token")?.value;
  const cookieHeader = request.headers.get("cookie") || "";
  const { id } = await context.params;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const csrfResp = await fetch(`${API_URL}/api/v1/auth/csrf-token`, {
      headers: { Cookie: cookieHeader },
    });
    const csrfJson = await csrfResp.json();
    const csrfToken: string | undefined = csrfJson?.data?.csrfToken;
    const response = await fetch(`${API_URL}/api/superadmin/tenants/${id}/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (_error) {
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
