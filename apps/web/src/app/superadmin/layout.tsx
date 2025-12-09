import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  // Auth check - only superadmin can access
  const userResponse = await getCurrentUser();

  if (!userResponse.success || !userResponse.data) {
    redirect("/login?redirect=/superadmin");
  }

  const user = userResponse.data;

  if (user.role !== "superadmin") {
    redirect("/unauthorized");
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Superadmin Dashboard</h1>
            <div className="flex items-center gap-4">
              <Link href="/superadmin" className="text-sm hover:underline">
                Overview
              </Link>
              <Link href="/superadmin/provision" className="text-sm hover:underline">
                Provision Tenant
              </Link>
              <div className="ml-4 flex items-center gap-2 text-sm text-muted-foreground">
                <span>
                  {user.firstName} {user.lastName}
                </span>
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                  Superadmin
                </span>
              </div>
            </div>
          </div>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
