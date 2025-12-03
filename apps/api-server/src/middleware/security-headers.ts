/**
 * Security Headers Middleware
 * Implements security headers like CSP, HSTS, X-Frame-Options, etc.
 */

export interface SecurityHeadersConfig {
	contentSecurityPolicy?: string;
	strictTransportSecurity?: string;
	xFrameOptions?: string;
	xContentTypeOptions?: string;
	xXSSProtection?: string;
	referrerPolicy?: string;
	permissionsPolicy?: string;
}

/**
 * Get default security headers configuration
 */
export function getSecurityHeaders(): SecurityHeadersConfig {
	const isProduction = process.env.NODE_ENV === "production";

	return {
		// Content Security Policy
		contentSecurityPolicy: isProduction
			? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.sentry.io;"
			: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http://localhost:* https://api.sentry.io;",

		// Strict Transport Security (only in production)
		strictTransportSecurity: isProduction
			? "max-age=31536000; includeSubDomains; preload"
			: undefined,

		// Prevent clickjacking
		xFrameOptions: "DENY",

		// Prevent MIME type sniffing
		xContentTypeOptions: "nosniff",

		// XSS Protection (legacy, but still useful)
		xXSSProtection: "1; mode=block",

		// Referrer Policy
		referrerPolicy: "strict-origin-when-cross-origin",

		// Permissions Policy (formerly Feature Policy)
		permissionsPolicy: "camera=(), microphone=(), geolocation=()",
	};
}

/**
 * Apply security headers to a Response
 */
export function applySecurityHeaders(
	response: Response,
	config?: SecurityHeadersConfig,
): Response {
	const headers = config || getSecurityHeaders();

	// Apply headers
	if (headers.contentSecurityPolicy) {
		response.headers.set("Content-Security-Policy", headers.contentSecurityPolicy);
	}

	if (headers.strictTransportSecurity) {
		response.headers.set("Strict-Transport-Security", headers.strictTransportSecurity);
	}

	if (headers.xFrameOptions) {
		response.headers.set("X-Frame-Options", headers.xFrameOptions);
	}

	if (headers.xContentTypeOptions) {
		response.headers.set("X-Content-Type-Options", headers.xContentTypeOptions);
	}

	if (headers.xXSSProtection) {
		response.headers.set("X-XSS-Protection", headers.xXSSProtection);
	}

	if (headers.referrerPolicy) {
		response.headers.set("Referrer-Policy", headers.referrerPolicy);
	}

	if (headers.permissionsPolicy) {
		response.headers.set("Permissions-Policy", headers.permissionsPolicy);
	}

	return response;
}

