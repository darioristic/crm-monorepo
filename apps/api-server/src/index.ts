import { env } from "./config/env";
import { handleRequest } from "./routes";
import { sql, closeConnection } from "./db/client";
import { redis } from "./cache/redis";
import { logger, createRequestLogger, logRequest } from "./lib/logger";
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

			// Apply CORS headers and return
			return applyCorsHeaders(response, corsHeaders);
		} catch (error) {
			const duration = performance.now() - startTime;
			reqLogger.error({ error, durationMs: duration }, "Server error");

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

			return applyCorsHeaders(errorResponse, corsHeaders);
		}
	},

	error(error: Error): Response {
		logger.error({ error }, "Unhandled server error");
		return new Response(
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
