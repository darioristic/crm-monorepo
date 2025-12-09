import type { UserRole } from "@crm/types";
import { logger } from "./logger";

// Use empty string for client-side requests (will use proxy via rewrites)
// Use full URL for server-side requests
const API_URL = typeof window === "undefined" ? process.env.API_URL || "http://localhost:3001" : "";
let csrfTokenCache: string | null = null;
function _requiresCsrf(method?: string): boolean {
  if (!method) return false;
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  return !safeMethods.includes(method.toUpperCase());
}
async function getCsrfToken(): Promise<string | null> {
  try {
    if (csrfTokenCache) return csrfTokenCache;
    const resp = await fetch(`${API_URL}/api/v1/auth/csrf-token`, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const text = await resp.text();
    const data = JSON.parse(text) as {
      success: boolean;
      data?: { csrfToken: string };
    };
    const token = data?.data?.csrfToken;
    if (token) {
      csrfTokenCache = token;
      return token;
    }
    return null;
  } catch {
    return null;
  }
}

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
    const errorMessage = text.length > 200 ? `${text.substring(0, 200)}...` : text;

    throw new Error(`Server returned non-JSON response (${response.status}): ${errorMessage}`);
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
        const errorMessage = text.length > 200 ? `${text.substring(0, 200)}...` : text;

        return {
          success: false,
          error: {
            code: defaultErrorCode,
            message: `Server error (${response.status}): ${errorMessage}`,
          },
        } as T;
      }
    } catch (_parseError) {
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
        message: error instanceof Error ? error.message : "Failed to connect to server",
      },
    };
  }
}

/**
 * Logout current user
 */
export async function logout(): Promise<{ success: boolean }> {
  try {
    const headers: Record<string, string> = {};
    const token = await getCsrfToken();
    if (token) headers["X-CSRF-Token"] = token;
    const response = await fetch(`${API_URL}/api/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers,
    });

    if (!response.ok) {
      const _errorData = await handleApiResponse<{
        success: boolean;
        error?: { code: string; message: string };
      }>(response, "LOGOUT_ERROR");
      if (response.status === 403) {
        csrfTokenCache = null;
        const newToken = await getCsrfToken();
        const retry = await fetch(`${API_URL}/api/v1/auth/logout`, {
          method: "POST",
          credentials: "include",
          headers: newToken ? { "X-CSRF-Token": newToken } : {},
        });
        if (retry.ok) {
          const data = await parseJsonResponse<{ success: boolean }>(retry);
          return data;
        }
      }
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
        message: error instanceof Error ? error.message : "Failed to refresh token",
      },
    };
  }
}

/**
 * Get current user info (includes company information)
 */
export async function getCurrentUser(): Promise<
  MeResponse & {
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
  }
> {
  try {
    const fetchOptions: RequestInit = { credentials: "include" };
    if (typeof window === "undefined") {
      try {
        const { cookies } = await import("next/headers");
        const cookieStore = await cookies();
        const all = cookieStore.getAll();
        const cookieHeader = all.map((c) => `${c.name}=${c.value}`).join("; ");
        if (cookieHeader) {
          fetchOptions.headers = {
            ...(fetchOptions.headers || {}),
            Cookie: cookieHeader,
          };
        }
      } catch (_err) {
        // ignore cookie forwarding errors and proceed without cookies
      }
    }
    const response = await fetch(`${API_URL}/api/v1/auth/me`, fetchOptions);

    return handleApiResponse<
      MeResponse & {
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
      }
    >(response, "GET_USER_ERROR");
  } catch (error) {
    logger.error("Get current user error", error);
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: error instanceof Error ? error.message : "Failed to get user info",
      },
    };
  }
}

/**
 * Change password
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const token = await getCsrfToken();
    if (token) headers["X-CSRF-Token"] = token;
    const response = await fetch(`${API_URL}/api/v1/auth/change-password`, {
      method: "POST",
      headers,
      body: JSON.stringify({ currentPassword, newPassword }),
      credentials: "include",
    });

    return handleApiResponse<{
      success: boolean;
      error?: { code: string; message: string };
    }>(response, "CHANGE_PASSWORD_ERROR");
  } catch (error) {
    logger.error("Change password error", error);
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: error instanceof Error ? error.message : "Failed to change password",
      },
    };
  }
}

// ============================================
// Helper Functions
// ============================================

export function isAdmin(user: AuthUser | null): boolean {
  const role = user?.role;
  return role === "admin" || role === "tenant_admin" || role === "superadmin";
}

export function getUserDisplayName(user: AuthUser | null): string {
  if (!user) return "";
  return `${user.firstName} ${user.lastName}`;
}

export function getUserInitials(user: AuthUser | null): string {
  if (!user) return "";
  return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
}
