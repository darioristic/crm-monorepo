import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PROTECTED_ROUTES = ["/dashboard", "/superadmin", "/tenant-admin"];
const AUTH_ROUTES = ["/login"];

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const accessToken = request.cookies.get("access_token")?.value;
  const isAuthenticated = !!accessToken;

  const isChatRoute = pathname.startsWith("/dashboard/chat");
  const allowPublicChat =
    (process.env.NEXT_PUBLIC_ENABLE_PUBLIC_CHAT || "").toLowerCase() === "true" ||
    process.env.NODE_ENV !== "production";
  const isProtectedRoute =
    PROTECTED_ROUTES.some((route) => pathname.startsWith(route)) &&
    !(isChatRoute && allowPublicChat);

  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && isAuthenticated) {
    const search = request.nextUrl.searchParams;
    const redirectParam = search.get("redirect") || search.get("returnUrl") || "";

    // If redirect parameter is present, honor it
    if (redirectParam?.startsWith("/")) {
      return NextResponse.redirect(new URL(redirectParam, request.url));
    }

    // Decode JWT to choose default landing based on role
    const token = accessToken;
    let role: string | null = null;
    try {
      const parts = (token || "").split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
        role = typeof payload?.role === "string" ? payload.role : null;
      }
    } catch {}

    const defaultPath =
      role === "superadmin"
        ? "/superadmin"
        : role === "tenant_admin"
          ? "/tenant-admin"
          : "/dashboard";
    return NextResponse.redirect(new URL(defaultPath, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|images|.*\\..*).*)+"],
};
