"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import type { AuthUser } from "@/lib/auth";

interface Tenant {
  id: string;
  slug: string;
  name: string;
  role: "admin" | "manager" | "user";
  logoUrl?: string | null;
}

interface TenantContextType {
  currentTenant: Tenant | null;
  availableTenants: Tenant[];
  switchTenant: (tenantId: string) => Promise<void>;
  isLoading: boolean;
  isSwitching: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);

  // Load tenant data from user object
  useEffect(() => {
    if (user) {
      type UserWithTenants = AuthUser & { tenantRoles?: Tenant[]; activeTenant?: Tenant };
      const userData = user as UserWithTenants;
      const tenants = userData.tenantRoles ?? [];
      setAvailableTenants(tenants);

      // Set current tenant from user.activeTenant
      if (userData.activeTenant) {
        setCurrentTenant(userData.activeTenant);
      } else if (tenants.length > 0) {
        // Fallback to first tenant if no active tenant
        setCurrentTenant(tenants[0]);
      }

      setIsLoading(false);
    } else {
      setCurrentTenant(null);
      setAvailableTenants([]);
      setIsLoading(false);
    }
  }, [user]);

  const switchTenant = useCallback(
    async (tenantId: string) => {
      if (!user || isSwitching) return;

      setIsSwitching(true);

      try {
        const response = await fetch("/api/v1/auth/switch-tenant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ tenantId }),
        });

        const data = await response.json();

        if (data.success) {
          // Reload the page to refresh all data with new tenant context
          window.location.reload();
        } else {
          console.error("Failed to switch tenant:", data.error);
          throw new Error(data.error?.message || "Failed to switch tenant");
        }
      } catch (error) {
        console.error("Error switching tenant:", error);
        throw error;
      } finally {
        setIsSwitching(false);
      }
    },
    [user, isSwitching]
  );

  return (
    <TenantContext.Provider
      value={{
        currentTenant,
        availableTenants,
        switchTenant,
        isLoading,
        isSwitching,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant must be used within TenantProvider");
  }
  return context;
}
