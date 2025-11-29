import { generateMeta } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PlusCircledIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import { UsersDataTable } from "@/components/users/users-data-table";

export async function generateMetadata() {
  return generateMeta({
    title: "Users",
    description: "Manage users in your CRM system",
    canonical: "/dashboard/users"
  });
}

export default function UsersPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            Manage your CRM users and their permissions
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/users/new">
            <PlusCircledIcon className="mr-2 h-4 w-4" />
            Add User
          </Link>
        </Button>
      </div>
      <UsersDataTable />
    </div>
  );
}

