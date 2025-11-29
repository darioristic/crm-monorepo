// Integration Exports
export { cache, redis } from "../cache/redis";
export { emailService } from "./email.service";
export { erpClient } from "./erp.client";
export {
	authenticateApiKey,
	hasScope,
	hasAnyScope,
	requireScope,
	checkRateLimit,
	getRateLimitHeaders,
	generateApiKey,
	revokeApiKey,
	listUserApiKeys,
	logApiRequest,
	apiErrorResponse,
	rateLimitResponse,
	type ApiKeyData,
	type ApiScope,
	type AuthResult,
	type RateLimitResult,
} from "./api-auth";
