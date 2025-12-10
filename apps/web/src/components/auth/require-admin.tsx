"use client";

import { RiShieldLine } from "@remixicon/react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";

// ============================================
// RequireAdmin Component
// ============================================

interface RequireAdminProps {
  children: ReactNode;
  fallback?: ReactNode;
  redirectTo?: string;
}

/**
 * Wrapper component that only renders children if user is admin
 * Redirects to specified path or shows fallback if not admin
 */
export function RequireAdmin({ children, fallback, redirectTo }: RequireAdminProps) {
  const { isAdmin, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated && !isAdmin && redirectTo) {
      router.push(redirectTo);
    }
  }, [isLoading, isAuthenticated, isAdmin, redirectTo, router]);

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (!isAdmin) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <RiShieldLine className="h-8 w-8 text-destructive" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold">Pristup odbijen</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Nemate dozvolu za pristup ovoj stranici.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// ============================================
// AdminOnly Component
// ============================================

interface AdminOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Conditionally renders content only for admin users
 * Does not redirect, just hides content
 */
export function AdminOnly({ children, fallback = null }: AdminOnlyProps) {
  const { isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAdmin) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// ============================================
// UserOnly Component
// ============================================

interface UserOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Conditionally renders content only for regular users (non-admin)
 */
export function UserOnly({ children, fallback = null }: UserOnlyProps) {
  const { isAdmin, isLoading, isAuthenticated } = useAuth();

  if (isLoading || !isAuthenticated) {
    return null;
  }

  if (isAdmin) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// ============================================
// WithPermission HOC
// ============================================

interface WithPermissionOptions {
  adminOnly?: boolean;
  fallback?: ReactNode;
  redirectTo?: string;
}

/**
 * Higher-order component for permission-based rendering
 */
export function withPermission<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: WithPermissionOptions = {}
) {
  const { adminOnly = false, fallback, redirectTo } = options;

  return function WithPermissionComponent(props: P) {
    const { isAdmin, isLoading, isAuthenticated } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!isLoading && adminOnly && isAuthenticated && !isAdmin && redirectTo) {
        router.push(redirectTo);
      }
    }, [isLoading, isAuthenticated, isAdmin, router]);

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

    if (adminOnly && !isAdmin) {
      if (fallback) {
        return <>{fallback}</>;
      }
      return null;
    }

    return <WrappedComponent {...props} />;
  };
}

export default RequireAdmin;
