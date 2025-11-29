import { generateMeta } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PlusCircledIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import { TasksDataTable } from "@/components/projects/tasks-data-table";

export async function generateMetadata() {
  return generateMeta({
    title: "Tasks",
    description: "Manage project tasks",
    canonical: "/dashboard/projects/tasks",
  });
}

export default function TasksPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">
            View and manage all project tasks
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/projects/tasks/new">
            <PlusCircledIcon className="mr-2 h-4 w-4" />
            New Task
          </Link>
        </Button>
      </div>
      <TasksDataTable />
    </div>
  );
}
