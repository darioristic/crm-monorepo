import { NextResponse } from "next/server";

export async function POST() {
  const isProduction = process.env.NODE_ENV === "production";
  const sameSite = isProduction ? "None" : "Lax";
  const secure = isProduction ? "Secure; " : "";

  const clearAccess = `access_token=; HttpOnly; ${secure}SameSite=${sameSite}; Path=/; Max-Age=0`;
  const clearRefresh = `refresh_token=; HttpOnly; ${secure}SameSite=${sameSite}; Path=/api/v1/auth/refresh; Max-Age=0`;
  const clearSession = `session_id=; HttpOnly; ${secure}SameSite=${sameSite}; Path=/; Max-Age=0`;

  const response = NextResponse.json({ success: true }, { status: 200 });
  response.headers.append("Set-Cookie", clearAccess);
  response.headers.append("Set-Cookie", clearRefresh);
  response.headers.append("Set-Cookie", clearSession);
  return response;
}
