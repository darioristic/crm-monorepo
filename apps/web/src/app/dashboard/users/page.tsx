import { generateMeta } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PlusCircledIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import { UsersDataTable } from "@/components/users/users-data-table";

export async function generateMetadata() {
  return generateMeta({
    title: "Contacts",
    description: "Manage individual contacts who are customers or employees in companies",
    canonical: "/dashboard/users"
  });
}

export default function UsersPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground">
            Manage individual contacts who are customers or employees in companies
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/users/new">
            <PlusCircledIcon className="mr-2 h-4 w-4" />
            Add Contact
          </Link>
        </Button>
      </div>
      <UsersDataTable />
    </div>
  );
}

