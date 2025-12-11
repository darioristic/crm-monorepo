import { type NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:3001";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string; orgId: string }> }
) {
  const token = request.cookies.get("access_token")?.value;
  const cookieHeader = request.headers.get("cookie") || "";
  const { id, orgId } = await context.params;

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
    const response = await fetch(`${API_URL}/api/superadmin/tenants/${id}/organizations/${orgId}`, {
      method: "PUT",
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
    return NextResponse.json({ error: "Failed to update organization" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; orgId: string }> }
) {
  const token = request.cookies.get("access_token")?.value;
  const cookieHeader = request.headers.get("cookie") || "";
  const { id, orgId } = await context.params;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const csrfResp = await fetch(`${API_URL}/api/v1/auth/csrf-token`, {
      headers: { Cookie: cookieHeader },
    });
    const csrfJson = await csrfResp.json();
    const csrfToken: string | undefined = csrfJson?.data?.csrfToken;
    const response = await fetch(`${API_URL}/api/superadmin/tenants/${id}/organizations/${orgId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      },
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (_error) {
    return NextResponse.json({ error: "Failed to delete organization" }, { status: 500 });
  }
}
