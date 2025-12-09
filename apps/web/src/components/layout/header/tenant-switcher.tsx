"use client";

import { Building2, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTenant } from "@/contexts/tenant-context";
import { cn } from "@/lib/utils";

export function TenantSwitcher() {
  const { currentTenant, availableTenants, switchTenant, isLoading, isSwitching } = useTenant();

  // Don't show if loading or no tenant
  if (isLoading || !currentTenant) {
    return null;
  }

  // If only one tenant, show as static display (no dropdown) with logo
  if (availableTenants.length <= 1) {
    return (
      <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-muted/50">
        <div className="h-8 w-8 rounded-md overflow-hidden bg-primary/10 flex items-center justify-center">
          {currentTenant.logoUrl ? (
            <img
              src={currentTenant.logoUrl}
              alt={currentTenant.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <Building2 className="h-4 w-4 text-primary" />
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{currentTenant.name}</span>
          <span className="text-xs text-muted-foreground capitalize">{currentTenant.role}</span>
        </div>
      </div>
    );
  }

  const handleSwitch = async (tenantId: string) => {
    if (tenantId === currentTenant?.id || isSwitching) return;

    try {
      await switchTenant(tenantId);
    } catch (error) {
      // Error handling is done in context
      console.error("Failed to switch tenant:", error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2" disabled={isSwitching}>
          {isSwitching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Building2 className="h-4 w-4" />
          )}
          <span className="font-semibold">{currentTenant?.name || "Select Tenant"}</span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[240px]">
        <DropdownMenuLabel>Switch Tenant</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {availableTenants.map((tenant) => (
          <DropdownMenuItem
            key={tenant.id}
            onClick={() => handleSwitch(tenant.id)}
            className={cn("gap-2 cursor-pointer", currentTenant?.id === tenant.id && "bg-accent")}
            disabled={isSwitching}
          >
            <Building2 className="h-4 w-4" />
            <div className="flex-1">
              <div className="font-medium">{tenant.name}</div>
              <div className="text-xs text-muted-foreground capitalize">{tenant.role}</div>
            </div>
            {currentTenant?.id === tenant.id && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
