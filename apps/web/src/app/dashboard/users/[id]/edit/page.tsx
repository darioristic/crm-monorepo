"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2 } from "lucide-react";
import type { User } from "@crm/types";
import { usersApi } from "@/lib/api";
import { UserForm } from "@/components/users/user-form";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditUserPage() {
  const params = useParams();
  const id = params.id as string;
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUser() {
      setIsLoading(true);
      try {
        const response = await usersApi.getById(id);
        if (response.success && response.data) {
          setUser(response.data);
        } else {
          setError(response.error?.message || "Failed to load user");
        }
      } catch (e) {
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
      <UserForm mode="edit" user={user} />
    </div>
  );
}

