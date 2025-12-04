import { generateMeta } from "@/lib/utils";
import { UserForm } from "@/components/users/user-form";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export async function generateMetadata() {
  return generateMeta({
    title: "Create User",
    description: "Add a new user",
    canonical: "/dashboard/users/new",
  });
}

export default function NewUserPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/users">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create User</h1>
          <p className="text-muted-foreground">Add a new user</p>
        </div>
      </div>
      <UserForm />
    </div>
  );
}
