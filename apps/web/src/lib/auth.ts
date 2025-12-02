import type { User, UserRole } from "@crm/types";
import { logger } from "./logger";

// Use empty string for client-side requests (will use proxy via rewrites)
// Use full URL for server-side requests
const API_URL = typeof window === "undefined"
  ? (process.env.API_URL || "http://localhost:3001")
  : "";

// ============================================
// Auth Types
// ============================================

export interface AuthUser {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	role: UserRole;
	companyId?: string;
	avatarUrl?: string;
	company?: {
		id: string;
		name: string;
		industry: string;
		address: string;
		logoUrl?: string | null;
		email?: string | null;
	};
}

export interface LoginCredentials {
	email: string;
	password: string;
}

export interface AuthResponse {
	success: boolean;
	data?: {
		user: AuthUser;
		expiresIn: number;
	};
	error?: {
		code: string;
		message: string;
	};
}

export interface RefreshResponse {
	success: boolean;
	data?: {
		expiresIn: number;
	};
	error?: {
		code: string;
		message: string;
	};
}

export interface MeResponse {
	success: boolean;
	data?: AuthUser;
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
				// If the response is already in our error format, return it
				if (errorData && typeof errorData === "object" && "error" in errorData) {
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
// Auth API Functions
// ============================================

/**
 * Login with email and password
 */
export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
	try {
		const response = await fetch(`${API_URL}/api/v1/auth/login`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(credentials),
			credentials: "include", // Important for cookies
		});

		return handleApiResponse<AuthResponse>(response, "LOGIN_ERROR");
	} catch (error) {
		logger.error("Login error", error);
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
 * Logout current user
 */
export async function logout(): Promise<{ success: boolean }> {
	try {
		const response = await fetch(`${API_URL}/api/v1/auth/logout`, {
			method: "POST",
			credentials: "include",
		});

		if (!response.ok) {
			const errorData = await handleApiResponse<{ success: boolean; error?: { code: string; message: string } }>(
				response,
				"LOGOUT_ERROR"
			);
			return { success: false };
		}

		const data = await parseJsonResponse<{ success: boolean }>(response);
		return data;
	} catch (error) {
		logger.error("Logout error", error);
		return { success: false };
	}
}

/**
 * Refresh the access token
 */
export async function refreshToken(): Promise<RefreshResponse> {
	try {
		const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
			method: "POST",
			credentials: "include",
		});

		return handleApiResponse<RefreshResponse>(response, "REFRESH_ERROR");
	} catch (error) {
		logger.error("Refresh token error", error);
		return {
			success: false,
			error: {
				code: "NETWORK_ERROR",
				message: error instanceof Error 
					? error.message 
					: "Failed to refresh token",
			},
		};
	}
}

/**
 * Get current user info (includes company information)
 */
export async function getCurrentUser(): Promise<MeResponse & {
	data?: AuthUser & {
		company?: {
			id: string;
			name: string;
			industry: string;
			address: string;
			logoUrl?: string | null;
			email?: string | null;
		};
	};
}> {
	try {
		const response = await fetch(`${API_URL}/api/v1/auth/me`, {
			credentials: "include",
		});

		return handleApiResponse<MeResponse & {
			data?: AuthUser & {
				company?: {
					id: string;
					name: string;
					industry: string;
					address: string;
					logoUrl?: string | null;
					email?: string | null;
				};
			};
		}>(response, "GET_USER_ERROR");
	} catch (error) {
		logger.error("Get current user error", error);
		return {
			success: false,
			error: {
				code: "NETWORK_ERROR",
				message: error instanceof Error 
					? error.message 
					: "Failed to get user info",
			},
		};
	}
}

/**
 * Change password
 */
export async function changePassword(
	currentPassword: string,
	newPassword: string,
): Promise<{ success: boolean; error?: { code: string; message: string } }> {
	try {
		const response = await fetch(`${API_URL}/api/v1/auth/change-password`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ currentPassword, newPassword }),
			credentials: "include",
		});

		return handleApiResponse<{ success: boolean; error?: { code: string; message: string } }>(
			response,
			"CHANGE_PASSWORD_ERROR"
		);
	} catch (error) {
		logger.error("Change password error", error);
		return {
			success: false,
			error: {
				code: "NETWORK_ERROR",
				message: error instanceof Error 
					? error.message 
					: "Failed to change password",
			},
		};
	}
}

// ============================================
// Helper Functions
// ============================================

export function isAdmin(user: AuthUser | null): boolean {
	return user?.role === "admin";
}

export function getUserDisplayName(user: AuthUser | null): string {
	if (!user) return "";
	return `${user.firstName} ${user.lastName}`;
}

export function getUserInitials(user: AuthUser | null): string {
	if (!user) return "";
	return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
}

