import { logger } from "./logger";

// Use empty string for client-side requests (will use proxy via rewrites)
// Use full URL for server-side requests
const API_URL = typeof window === "undefined"
	? (process.env.API_URL || "http://localhost:3001")
	: "";

// ============================================
// Company Types
// ============================================

export interface Company {
	id: string;
	name: string;
	industry: string;
	address: string;
	logoUrl?: string | null;
	email?: string | null;
	createdAt: string;
	updatedAt?: string;
	role?: "owner" | "member" | "admin";
}

export interface CompanyMember {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	avatarUrl?: string | null;
	role: "owner" | "member" | "admin";
}

export interface CompanyResponse {
	success: boolean;
	data?: Company;
	error?: {
		code: string;
		message: string;
	};
}

export interface CompaniesResponse {
	success: boolean;
	data?: Company[];
	error?: {
		code: string;
		message: string;
	};
}

export interface CompanyMembersResponse {
	success: boolean;
	data?: CompanyMember[];
	error?: {
		code: string;
		message: string;
	};
}

// ============================================
// Helper Functions for API Calls
// ============================================

/**
 * Safely parse JSON response, handling non-JSON error responses
 */
async function parseJsonResponse<T>(response: Response): Promise<T> {
	const contentType = response.headers.get("content-type");
	const isJson = contentType?.includes("application/json");

	if (!isJson) {
		const text = await response.text();
		const errorMessage = text.length > 200 
			? `${text.substring(0, 200)}...` 
			: text;
		
		throw new Error(
			`Server returned non-JSON response (${response.status}): ${errorMessage}`
		);
	}

	return response.json() as Promise<T>;
}

/**
 * Handle API response with proper error handling
 */
async function handleApiResponse<T>(
	response: Response,
	defaultErrorCode: string = "API_ERROR"
): Promise<T> {
	if (!response.ok) {
		try {
			const contentType = response.headers.get("content-type");
			if (contentType?.includes("application/json")) {
				const errorData = await response.json();
				console.log("🔍 handleApiResponse: Error data received:", errorData);
				
				// If the response is already in our error format, ensure it has valid structure
				if (errorData && typeof errorData === "object" && "error" in errorData) {
					const errorObj = errorData.error;
					
					// If error object is missing or empty, create a valid one
					if (!errorObj || (typeof errorObj === "object" && Object.keys(errorObj).length === 0)) {
						const statusMessages: Record<number, string> = {
							401: "Unauthorized",
							403: "Forbidden",
							404: "Not found",
							400: "Bad request",
						};
						
						return {
							success: false,
							error: {
								code: errorData.code || defaultErrorCode,
								message: errorData.message || statusMessages[response.status] || `Server error (${response.status})`,
							},
						} as T;
					}
					
					// Ensure error object has both code and message
					if (typeof errorObj === "object") {
						const code = typeof errorObj.code === "string" && errorObj.code.trim() 
							? errorObj.code 
							: errorData.code || defaultErrorCode;
						const message = typeof errorObj.message === "string" && errorObj.message.trim()
							? errorObj.message
							: errorData.message || `Server error (${response.status})`;
						
						// If we had to fix the error, return the fixed version
						if (code !== errorObj.code || message !== errorObj.message) {
							return {
								success: false,
								error: { code, message },
							} as T;
						}
					}
					
					// Error object is valid - return as is
					return errorData as T;
				}
				// Otherwise, wrap it in our error format
				return {
					success: false,
					error: {
						code: errorData.code || defaultErrorCode,
						message: errorData.message || `Server error: ${response.status}`,
					},
				} as T;
			} else {
				// Non-JSON error response (HTML error page, etc.)
				const text = await response.text();
				const errorMessage = text.length > 200 
					? `${text.substring(0, 200)}...` 
					: text;
				
				return {
					success: false,
					error: {
						code: defaultErrorCode,
						message: `Server error (${response.status}): ${errorMessage}`,
					},
				} as T;
			}
		} catch (parseError) {
			// If we can't parse the error response, return a generic error
			return {
				success: false,
				error: {
					code: defaultErrorCode,
					message: `Server error: ${response.status} ${response.statusText}`,
				},
			} as T;
		}
	}

	// Successful response - parse JSON
	return parseJsonResponse<T>(response);
}

// ============================================
// Company API Functions
// ============================================

/**
 * Get current active company
 */
export async function getCurrentCompany(): Promise<CompanyResponse> {
	try {
		const response = await fetch(`${API_URL}/api/v1/companies/current`, {
			credentials: "include",
		});

		return handleApiResponse<CompanyResponse>(response, "GET_COMPANY_ERROR");
	} catch (error) {
		logger.error("Get current company error", error);
		return {
			success: false,
			error: {
				code: "NETWORK_ERROR",
				message: error instanceof Error 
					? error.message 
					: "Failed to connect to server",
			},
		};
	}
}

/**
 * Get all companies user is a member of
 */
export async function getCompanies(): Promise<CompaniesResponse> {
	try {
		const response = await fetch(`${API_URL}/api/v1/companies`, {
			credentials: "include",
		});

		return handleApiResponse<CompaniesResponse>(response, "GET_COMPANIES_ERROR");
	} catch (error) {
		logger.error("Get companies error", error);
		return {
			success: false,
			error: {
				code: "NETWORK_ERROR",
				message: error instanceof Error 
					? error.message 
					: "Failed to connect to server",
			},
		};
	}
}

/**
 * Create a new company
 */
export async function createCompany(data: {
	name: string;
	industry: string;
	address: string;
	email?: string;
	phone?: string | null;
	website?: string | null;
	contact?: string | null;
	city?: string | null;
	zip?: string | null;
	country?: string | null;
	countryCode?: string | null;
	vatNumber?: string | null;
	companyNumber?: string | null;
	note?: string | null;
	logoUrl?: string;
	switchCompany?: boolean;
}): Promise<CompanyResponse> {
	try {
		const response = await fetch(`${API_URL}/api/v1/companies`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(data),
			credentials: "include",
		});

		return handleApiResponse<CompanyResponse>(response, "CREATE_COMPANY_ERROR");
	} catch (error) {
		logger.error("Create company error", error);
		return {
			success: false,
			error: {
				code: "NETWORK_ERROR",
				message: error instanceof Error 
					? error.message 
					: "Failed to connect to server",
			},
		};
	}
}

/**
 * Update company
 */
export async function updateCompany(
	id: string,
	data: {
		name?: string;
		industry?: string;
		address?: string;
		email?: string;
		logoUrl?: string;
	}
): Promise<CompanyResponse> {
	try {
		const response = await fetch(`${API_URL}/api/v1/companies/${id}`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(data),
			credentials: "include",
		});

		return handleApiResponse<CompanyResponse>(response, "UPDATE_COMPANY_ERROR");
	} catch (error) {
		logger.error("Update company error", error);
		return {
			success: false,
			error: {
				code: "NETWORK_ERROR",
				message: error instanceof Error 
					? error.message 
					: "Failed to connect to server",
			},
		};
	}
}

/**
 * Switch to a different company
 */
export async function switchCompany(companyId: string): Promise<{
	success: boolean;
	data?: { id: string; companyId: string; accessToken?: string };
	error?: { code: string; message: string };
}> {
	try {
		console.log("🔄 switchCompany: Making request to /api/v1/users/me", { companyId, API_URL });
		const response = await fetch(`${API_URL}/api/v1/users/me`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ companyId }),
			credentials: "include",
		});

		console.log("📡 switchCompany: Response received", {
			status: response.status,
			statusText: response.statusText,
			ok: response.ok,
			headers: Object.fromEntries(response.headers.entries()),
		});

		// Use handleApiResponse for both success and error cases
		const result = await handleApiResponse<{
			success: boolean;
			data?: { id: string; companyId: string; accessToken?: string };
			error?: { code: string; message: string };
		}>(response, "SWITCH_COMPANY_ERROR");

		// Ensure error object has valid structure if success is false
		if (!result.success) {
			// If error is missing or empty, create a fallback
			if (!result.error || (typeof result.error === "object" && Object.keys(result.error).length === 0)) {
				const statusMessages: Record<number, string> = {
					401: "Unauthorized - please log in again",
					403: "Forbidden - you don't have access to this company",
					404: "Company not found",
					400: "Invalid request - company ID is required",
				};
				
				result.error = {
					code: "UNKNOWN_ERROR",
					message: statusMessages[response.status] || `Server error (${response.status})`,
				};
			}
			
			// Ensure error has both code and message
			if (!result.error.code || !result.error.message) {
				result.error = {
					code: result.error.code || "UNKNOWN_ERROR",
					message: result.error.message || `Server error (${response.status})`,
				};
			}
		}

		// If we received a new accessToken, the backend should have set it as a cookie
		// via Set-Cookie header, which will be automatically handled by the browser
		// when using credentials: "include". However, we log it for debugging.
		if (result.success && result.data?.accessToken) {
			logger.info("New access token received after company switch");
			// Token is automatically saved via cookie, no manual action needed
		}

		return result;
	} catch (error) {
		console.error("❌ switchCompany: Exception caught:", error);
		logger.error("Switch company error", error);
		return {
			success: false,
			error: {
				code: "NETWORK_ERROR",
				message: error instanceof Error 
					? error.message 
					: "Failed to connect to server",
			},
		};
	}
}

/**
 * Get company members
 */
export async function getCompanyMembers(companyId: string): Promise<CompanyMembersResponse> {
	try {
		const response = await fetch(`${API_URL}/api/v1/companies/${companyId}/members`, {
			credentials: "include",
		});

		return handleApiResponse<CompanyMembersResponse>(response, "GET_MEMBERS_ERROR");
	} catch (error) {
		logger.error("Get company members error", error);
		return {
			success: false,
			error: {
				code: "NETWORK_ERROR",
				message: error instanceof Error 
					? error.message 
					: "Failed to connect to server",
			},
		};
	}
}

/**
 * Delete company
 */
export async function deleteCompany(companyId: string): Promise<{
	success: boolean;
	data?: { id: string };
	error?: { code: string; message: string };
}> {
	try {
		const response = await fetch(`${API_URL}/api/v1/companies/${companyId}`, {
			method: "DELETE",
			credentials: "include",
		});

		return handleApiResponse<{
			success: boolean;
			data?: { id: string };
			error?: { code: string; message: string };
		}>(response, "DELETE_COMPANY_ERROR");
	} catch (error) {
		logger.error("Delete company error", error);
		return {
			success: false,
			error: {
				code: "NETWORK_ERROR",
				message: error instanceof Error 
					? error.message 
					: "Failed to connect to server",
			},
		};
	}
}

/**
 * Leave company
 */
export async function leaveCompany(companyId: string): Promise<{
	success: boolean;
	error?: { code: string; message: string };
}> {
	try {
		const response = await fetch(`${API_URL}/api/v1/companies/${companyId}/leave`, {
			method: "POST",
			credentials: "include",
		});

		return handleApiResponse<{
			success: boolean;
			error?: { code: string; message: string };
		}>(response, "LEAVE_COMPANY_ERROR");
	} catch (error) {
		logger.error("Leave company error", error);
		return {
			success: false,
			error: {
				code: "NETWORK_ERROR",
				message: error instanceof Error 
					? error.message 
					: "Failed to connect to server",
			},
		};
	}
}

/**
 * Update company member role
 */
export async function updateCompanyMember(
	companyId: string,
	userId: string,
	role: "owner" | "member" | "admin"
): Promise<{
	success: boolean;
	error?: { code: string; message: string };
}> {
	try {
		const response = await fetch(`${API_URL}/api/v1/companies/${companyId}/members/${userId}`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ role }),
			credentials: "include",
		});

		return handleApiResponse<{
			success: boolean;
			error?: { code: string; message: string };
		}>(response, "UPDATE_MEMBER_ERROR");
	} catch (error) {
		logger.error("Update company member error", error);
		return {
			success: false,
			error: {
				code: "NETWORK_ERROR",
				message: error instanceof Error 
					? error.message 
					: "Failed to connect to server",
			},
		};
	}
}

/**
 * Delete company member
 */
export async function deleteCompanyMember(
	companyId: string,
	userId: string
): Promise<{
	success: boolean;
	error?: { code: string; message: string };
}> {
	try {
		const response = await fetch(`${API_URL}/api/v1/companies/${companyId}/members/${userId}`, {
			method: "DELETE",
			credentials: "include",
		});

		return handleApiResponse<{
			success: boolean;
			error?: { code: string; message: string };
		}>(response, "DELETE_MEMBER_ERROR");
	} catch (error) {
		logger.error("Delete company member error", error);
		return {
			success: false,
			error: {
				code: "NETWORK_ERROR",
				message: error instanceof Error 
					? error.message 
					: "Failed to connect to server",
			},
		};
	}
}

