import { z } from "zod";
import { configLogger } from "../lib/logger";

// Custom validator for comma-separated URLs
const commaSeparatedUrls = z
	.string()
	.optional()
	.refine(
		(val) => {
			if (!val) return true;
			const urls = val.split(",").map((u) => u.trim());
			return urls.every((url) => {
				try {
					new URL(url);
					return true;
				} catch {
					return false;
				}
			});
		},
		{ message: "CORS_ORIGINS must be comma-separated valid URLs" },
	);

const envSchema = z.object({
	// Server configuration
	PORT: z.coerce.number().min(1000).max(65535).default(3001),
	HOST: z.string().default("0.0.0.0"),
	NODE_ENV: z
		.enum(["development", "production", "test", "staging"])
		.default("development"),

	// Database configuration
	DATABASE_URL: z.string().url("Invalid DATABASE_URL format"),

	// Redis configuration
	REDIS_URL: z.string().url("Invalid REDIS_URL format"),

	// Workers
	ENABLE_WORKERS: z.coerce.boolean().default(true),

	// CORS Configuration
	CORS_ORIGINS: commaSeparatedUrls,
	CORS_CREDENTIALS: z.coerce.boolean().default(true),
	CORS_MAX_AGE: z.coerce.number().min(0).max(86400).default(86400), // Max 24 hours

	// Legacy - kept for backwards compatibility, use CORS_ORIGINS instead
	ALLOWED_ORIGINS: z.string().optional(),

	// File storage configuration
	UPLOAD_DIR: z.string().default("./uploads"),
	MAX_FILE_SIZE: z.coerce.number().default(5 * 1024 * 1024), // 5MB default

	// Optional configurations
	LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

	// AI Configuration (optional - features disabled if not set)
	OPENAI_API_KEY: z.string().optional(),
	MISTRAL_API_KEY: z.string().optional(),
	GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

// Validate and export environment variables
const parsedEnv = envSchema.parse(process.env);

// Merge legacy ALLOWED_ORIGINS with CORS_ORIGINS for backwards compatibility
const mergedCorsOrigins =
	[parsedEnv.CORS_ORIGINS, parsedEnv.ALLOWED_ORIGINS]
		.filter(Boolean)
		.join(",") || undefined;

export const env: Env = {
	...parsedEnv,
	CORS_ORIGINS: mergedCorsOrigins,
};

// Log validation success in development
if (env.NODE_ENV === "development") {
	configLogger.info("Environment variables validated successfully");
}
