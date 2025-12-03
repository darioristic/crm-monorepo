/**
 * Sentry integration for frontend error tracking
 */

export function initSentry() {
	if (typeof window === "undefined") {
		return; // Only initialize on client side
	}

	if (process.env.NODE_ENV !== "production") {
		return; // Only initialize Sentry in production
	}

	const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
	if (!dsn) {
		console.warn("NEXT_PUBLIC_SENTRY_DSN not set, error tracking disabled");
		return;
	}

	// Dynamically import Sentry to reduce bundle size
	import("@sentry/nextjs").then((Sentry) => {
		Sentry.init({
			dsn,
			environment: process.env.NODE_ENV,
			// Performance monitoring
			tracesSampleRate: 0.1, // 10% of transactions
			// Capture unhandled promise rejections
			integrations: [
				new Sentry.BrowserTracing({
					tracePropagationTargets: ["localhost", /^https:\/\/.*\.vercel\.app/],
				}),
			],
			// Filter out health check requests
			beforeSend(event, hint) {
				// Don't send events for health check endpoints
				if (event.request?.url?.includes("/health")) {
					return null;
				}
				return event;
			},
		});

		console.log("✅ Sentry initialized for error tracking");
	});
}

/**
 * Capture an exception and send it to Sentry
 */
export async function captureException(error: Error, context?: Record<string, unknown>) {
	if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_SENTRY_DSN) {
		const Sentry = await import("@sentry/nextjs");
		Sentry.captureException(error, {
			extra: context,
		});
	}
}

/**
 * Capture a message and send it to Sentry
 */
export async function captureMessage(
	message: string,
	level: "info" | "warning" | "error" = "info",
	context?: Record<string, unknown>,
) {
	if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_SENTRY_DSN) {
		const Sentry = await import("@sentry/nextjs");
		Sentry.captureMessage(message, {
			level: level as Sentry.SeverityLevel,
			extra: context,
		});
	}
}

