import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication
const PROTECTED_ROUTES = ["/dashboard"];

// Public routes that should redirect to dashboard if logged in
const AUTH_ROUTES = ["/login"];

export function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Check for access_token cookie
	const accessToken = request.cookies.get("access_token")?.value;
	const isAuthenticated = !!accessToken;

	// Check if trying to access protected route
	const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
		pathname.startsWith(route),
	);

	// Check if trying to access auth route (login, register, etc.)
	const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

	// Redirect to login if not authenticated and trying to access protected route
	if (isProtectedRoute && !isAuthenticated) {
		const loginUrl = new URL("/login", request.url);
		loginUrl.searchParams.set("returnUrl", pathname);
		return NextResponse.redirect(loginUrl);
	}

	// Redirect to dashboard if authenticated and trying to access auth route
	if (isAuthRoute && isAuthenticated) {
		return NextResponse.redirect(new URL("/dashboard", request.url));
	}

	// Continue with the request
	return NextResponse.next();
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - api (API routes)
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 * - public folder
		 */
		"/((?!api|_next/static|_next/image|favicon.ico|images|.*\\..*).*)+"
	],
};

