"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserForm } from "@/components/users/user-form";
import type { TenantUser } from "@/lib/api";
import { tenantAdminApi } from "@/lib/api";

export default function EditUserPage() {
  const params = useParams();
  const id = params.id as string;
  const [user, setUser] = useState<TenantUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUser() {
      setIsLoading(true);
      try {
        const response = await tenantAdminApi.users.getById(id);
        if (response.success && response.data) {
          setUser(response.data);
        } else {
          const errorMsg =
            typeof response.error === "object" && response.error?.message
              ? response.error.message
              : typeof response.error === "string"
                ? response.error
                : "Failed to load contact";
          setError(errorMsg);
        }
      } catch (_e) {
        setError("Failed to load user");
      } finally {
        setIsLoading(false);
      }
    }

    fetchUser();
  }, [id]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-[500px] w-full max-w-2xl" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/users">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Edit User</h1>
        </div>
        <Alert variant="destructive">
          <AlertDescription>
            {error || "User not found"}
            <Button variant="link" asChild className="ml-2">
              <Link href="/dashboard/users">Go back to users</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/users">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit User</h1>
          <p className="text-muted-foreground">
            Update information for {user.firstName} {user.lastName}
          </p>
        </div>
      </div>
      <UserForm user={user} />
    </div>
  );
}
