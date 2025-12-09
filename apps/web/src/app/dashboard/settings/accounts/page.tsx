"use client";

import { useTenant } from "@/contexts/tenant-context";

export default function SettingsAccountsPage() {
  const { currentTenant } = useTenant();

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Account Settings</h1>
      {currentTenant ? (
        <div className="space-y-2" data-account>
          <div className="text-lg font-semibold">{currentTenant.name}</div>
          <div className="text-sm text-muted-foreground">Role: {currentTenant.role}</div>
          <div className="text-sm text-muted-foreground">Slug: {currentTenant.slug}</div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">No tenant selected</div>
      )}
    </main>
  );
}
