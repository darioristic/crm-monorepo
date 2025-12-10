export default function TenantAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Tenant Admin Dashboard</h1>
            <div className="flex gap-4">
              <a href="/tenant-admin/users" className="text-sm">
                Users
              </a>
              <a href="/tenant-admin/companies" className="text-sm">
                Companies
              </a>
              <a href="/tenant-admin/locations" className="text-sm">
                Locations
              </a>
              <a href="/tenant-admin/settings" className="text-sm">
                Settings
              </a>
            </div>
          </div>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
