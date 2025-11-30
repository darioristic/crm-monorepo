"use client";

import {
	createContext,
	useContext,
	useEffect,
	useState,
	useCallback,
	type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import {
	type AuthUser,
	type LoginCredentials,
	login as authLogin,
	logout as authLogout,
	getCurrentUser,
	refreshToken,
	isAdmin,
	getUserDisplayName,
	getUserInitials,
} from "@/lib/auth";

// ============================================
// Types
// ============================================

interface AuthContextType {
	user: AuthUser | null;
	isLoading: boolean;
	isAuthenticated: boolean;
	isAdmin: boolean;
	login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
	logout: () => Promise<void>;
	refreshUser: () => Promise<void>;
	getUserDisplayName: () => string;
	getUserInitials: () => string;
}

// ============================================
// Context
// ============================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================
// Provider
// ============================================

const REFRESH_INTERVAL = 13 * 60 * 1000; // 13 minutes (before 15min expiry)
const PUBLIC_PATHS = ["/login", "/"];

interface AuthProviderProps {
	children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
	const router = useRouter();
	const pathname = usePathname();
	const [user, setUser] = useState<AuthUser | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	// Check if current path is public
	const isPublicPath = PUBLIC_PATHS.some(
		(path) => pathname === path || pathname?.startsWith("/login"),
	);

	// Fetch current user
	const fetchUser = useCallback(async () => {
		try {
			const result = await getCurrentUser();
			if (result.success && result.data) {
				setUser(result.data);
				return true;
			}
			setUser(null);
			return false;
		} catch {
			setUser(null);
			return false;
		}
	}, []);

	// Silent refresh
	const silentRefresh = useCallback(async () => {
		try {
			const result = await refreshToken();
			if (!result.success) {
				// Refresh failed - user needs to re-login
				setUser(null);
				if (!isPublicPath) {
					router.push(`/login?returnUrl=${encodeURIComponent(pathname || "/dashboard")}`);
				}
			}
		} catch {
			// Ignore errors in silent refresh
		}
	}, [router, pathname, isPublicPath]);

	// Initial auth check
	useEffect(() => {
		const initAuth = async () => {
			setIsLoading(true);
			const authenticated = await fetchUser();

			if (!authenticated && !isPublicPath) {
				// Clear any stale cookies by calling logout
				// This ensures the middleware won't block access to login page
				await authLogout();
				router.push(`/login?returnUrl=${encodeURIComponent(pathname || "/dashboard")}`);
			}

			setIsLoading(false);
		};

		initAuth();
	}, [fetchUser, router, pathname, isPublicPath]);

	// Auto-refresh token
	useEffect(() => {
		if (!user) return;

		const interval = setInterval(() => {
			silentRefresh();
		}, REFRESH_INTERVAL);

		return () => clearInterval(interval);
	}, [user, silentRefresh]);

	// Login handler
	const login = useCallback(
		async (credentials: LoginCredentials) => {
			const result = await authLogin(credentials);

			if (result.success && result.data) {
				setUser(result.data.user);
				return { success: true };
			}

			const errorMsg = typeof result.error === 'object' && result.error?.message 
			? result.error.message 
			: typeof result.error === 'string' 
				? result.error 
				: "Login failed";
		return {
				success: false,
				error: errorMsg,
			};
		},
		[],
	);

	// Logout handler
	const logout = useCallback(async () => {
		await authLogout();
		setUser(null);
		router.push("/login");
	}, [router]);

	// Refresh user data
	const refreshUser = useCallback(async () => {
		await fetchUser();
	}, [fetchUser]);

	// Context value
	const value: AuthContextType = {
		user,
		isLoading,
		isAuthenticated: !!user,
		isAdmin: isAdmin(user),
		login,
		logout,
		refreshUser,
		getUserDisplayName: () => getUserDisplayName(user),
		getUserInitials: () => getUserInitials(user),
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================
// Hook
// ============================================

export function useAuth(): AuthContextType {
	const context = useContext(AuthContext);

	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}

	return context;
}

// ============================================
// Higher-Order Component for Protected Pages
// ============================================

export function withAuth<P extends object>(
	WrappedComponent: React.ComponentType<P>,
) {
	return function WithAuthComponent(props: P) {
		const { isAuthenticated, isLoading } = useAuth();
		const router = useRouter();
		const pathname = usePathname();

		useEffect(() => {
			if (!isLoading && !isAuthenticated) {
				router.push(`/login?returnUrl=${encodeURIComponent(pathname || "/dashboard")}`);
			}
		}, [isLoading, isAuthenticated, router, pathname]);

		if (isLoading) {
			return (
				<div className="flex h-screen items-center justify-center">
					<div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
				</div>
			);
		}

		if (!isAuthenticated) {
			return null;
		}

		return <WrappedComponent {...props} />;
	};
}

export default AuthProvider;

