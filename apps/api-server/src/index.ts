import { handleRequest } from "./routes";
import { db } from "./db/client";
import { redis } from "./cache/redis";
import { logger, createRequestLogger, logRequest } from "./lib/logger";
import {
	startWorkers,
	stopWorkers,
	closeQueues,
	scheduleNotificationCleanup,
} from "./jobs";

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "0.0.0.0";
const ENABLE_WORKERS = process.env.ENABLE_WORKERS !== "false";

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

		await db.end();
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

// Start server
const server = Bun.serve({
	port: PORT,
	hostname: HOST,

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const startTime = performance.now();
		const reqLogger = createRequestLogger(request);

		// Get origin from request for CORS
		const origin = request.headers.get("Origin") || "http://localhost:3000";
		const allowedOrigins = [
			"http://localhost:3000",
			"http://127.0.0.1:3000",
			"https://crm-frontend-crm-dev.apps.ocp-5.datsci.softergee.si",
			...(process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || []),
		];
		const allowOrigin = allowedOrigins.includes(origin)
			? origin
			: allowedOrigins[0];

		// CORS headers for development - must use specific origin with credentials
		const corsHeaders = {
			"Access-Control-Allow-Origin": allowOrigin,
			"Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
			"Access-Control-Allow-Credentials": "true",
		};

		// Handle preflight requests
		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: corsHeaders,
			});
		}

		try {
			// Route the request
			const response = await handleRequest(request, url);

			// Add CORS headers to response
			const headers = new Headers(response.headers);
			Object.entries(corsHeaders).forEach(([key, value]) => {
				headers.set(key, value);
			});

			// Log request
			const duration = performance.now() - startTime;
			logRequest(reqLogger, response.status, duration);

			return new Response(response.body, {
				status: response.status,
				headers,
			});
		} catch (error) {
			const duration = performance.now() - startTime;
			reqLogger.error({ error, durationMs: duration }, "Server error");

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
					headers: {
						"Content-Type": "application/json",
						...corsHeaders,
					},
				},
			);
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
		env: process.env.NODE_ENV || "development",
	},
	"CRM API Server started",
);

export { server };
