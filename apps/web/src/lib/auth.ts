import type { User, UserRole } from "@crm/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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

		const data = await response.json();
		return data as AuthResponse;
	} catch (error) {
		console.error("Login error:", error);
		return {
			success: false,
			error: {
				code: "NETWORK_ERROR",
				message: "Failed to connect to server",
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

		const data = await response.json();
		return data;
	} catch (error) {
		console.error("Logout error:", error);
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

		const data = await response.json();
		return data as RefreshResponse;
	} catch (error) {
		console.error("Refresh token error:", error);
		return {
			success: false,
			error: {
				code: "NETWORK_ERROR",
				message: "Failed to refresh token",
			},
		};
	}
}

/**
 * Get current user info
 */
export async function getCurrentUser(): Promise<MeResponse> {
	try {
		const response = await fetch(`${API_URL}/api/v1/auth/me`, {
			credentials: "include",
		});

		const data = await response.json();
		return data as MeResponse;
	} catch (error) {
		console.error("Get current user error:", error);
		return {
			success: false,
			error: {
				code: "NETWORK_ERROR",
				message: "Failed to get user info",
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

		const data = await response.json();
		return data;
	} catch (error) {
		console.error("Change password error:", error);
		return {
			success: false,
			error: {
				code: "NETWORK_ERROR",
				message: "Failed to change password",
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

