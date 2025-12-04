import { env } from "./config/env";
import { handleRequest } from "./routes";
import { closeConnection } from "./db/client";
import { closeTenantConnection } from "./tenant-mgmt/db/client";
import { redis } from "./cache/redis";
import { logger, createRequestLogger, logRequest } from "./lib/logger";
import { initSentry } from "./lib/sentry";
import {
	startWorkers,
	stopWorkers,
	closeQueues,
	scheduleNotificationCleanup,
} from "./jobs";
import {
	getCorsConfig,
	buildCorsHeaders,
	handlePreflight,
	applyCorsHeaders,
} from "./middleware/cors";
import { applySecurityHeaders } from "./middleware/security-headers";

// Initialize Sentry before anything else
initSentry();

const { PORT, HOST, ENABLE_WORKERS, NODE_ENV } = env;

// Start background workers if enabled
if (ENABLE_WORKERS) {
	startWorkers();
	scheduleNotificationCleanup().catch((err) => {
		logger.error({ error: err }, "Failed to schedule notification cleanup");
	});
}

// Graceful shutdown handler
  async function shutdown() {
	logger.info("Shutting down server...");
	try {
		// Stop workers first
		if (ENABLE_WORKERS) {
			await stopWorkers();
			await closeQueues();
		}

    await closeConnection();
    await closeTenantConnection();
		redis.disconnect();
		logger.info("Database and cache connections closed");
		process.exit(0);
	} catch (error) {
		logger.error({ error }, "Error during shutdown");
		process.exit(1);
	}
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Initialize CORS configuration once at startup
const corsConfig = getCorsConfig();

// Start server
const server = Bun.serve({
	port: PORT,
	hostname: HOST,

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const startTime = performance.now();
		const reqLogger = createRequestLogger(request);

		// Build CORS headers for this request
		const origin = request.headers.get("Origin");
		const corsHeaders = buildCorsHeaders(origin, corsConfig);

		// Handle preflight requests
		if (request.method === "OPTIONS") {
			return handlePreflight(corsHeaders);
		}

		try {
			// Route the request
			const response = await handleRequest(request, url);

			// Log request
			const duration = performance.now() - startTime;
			logRequest(reqLogger, response.status, duration);

			// Apply CORS and security headers with error handling
			try {
				const corsResponse = applyCorsHeaders(response, corsHeaders);
				return applySecurityHeaders(corsResponse);
			} catch (middlewareError) {
				reqLogger.error({ error: middlewareError }, "Error applying middleware headers");
				// Return original response if middleware fails
				return response;
			}
		} catch (error) {
			const duration = performance.now() - startTime;
			reqLogger.error({ error, durationMs: duration }, "Server error");

			// Capture error in Sentry
			try {
				if (error instanceof Error) {
					const { captureException } = await import("./lib/sentry");
					captureException(error, {
						url: request.url,
						method: request.method,
						durationMs: duration,
					});
				}
      } catch (_sentryError) {
        // Ignore Sentry errors
      }

			const errorResponse = new Response(
				JSON.stringify({
					success: false,
					error: {
						code: "INTERNAL_ERROR",
						message: "Internal server error",
					},
				}),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				},
			);

			try {
				const corsErrorResponse = applyCorsHeaders(errorResponse, corsHeaders);
				return applySecurityHeaders(corsErrorResponse);
      } catch (_middlewareError) {
        // If middleware fails, return error response without CORS/security headers
        return errorResponse;
      }
		}
	},

  async error(error: Error): Promise<Response> {
    logger.error({ error }, "Unhandled server error");
    // Capture error in Sentry
    try {
      const { captureException } = await import("./lib/sentry");
      captureException(error, { context: "unhandled_server_error" });
    } catch (_sentryError) {
      // Ignore Sentry errors to prevent recursive errors
    }

    const baseErrorResponse = new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Internal server error",
        },
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );

    // Apply CORS and security headers even for unhandled server errors
    try {
      const corsHeaders = buildCorsHeaders(null, corsConfig);
      const corsErrorResponse = applyCorsHeaders(baseErrorResponse, corsHeaders);
      return applySecurityHeaders(corsErrorResponse);
    } catch {
      return baseErrorResponse;
    }
  },
});

logger.info(
	{
		host: HOST,
		port: PORT,
		env: NODE_ENV,
	},
	"CRM API Server started",
);

export { server };
