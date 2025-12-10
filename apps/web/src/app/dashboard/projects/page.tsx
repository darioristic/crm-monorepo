import { PlusCircledIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import { ProjectsDataTable } from "@/components/projects/projects-data-table";
import { Button } from "@/components/ui/button";
import { generateMeta } from "@/lib/utils";

export async function generateMetadata() {
  return generateMeta({
    title: "Projects",
    description: "Manage your projects",
    canonical: "/dashboard/projects",
  });
}

export default function ProjectsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">Manage and track your projects</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/projects/new">
            <PlusCircledIcon className="mr-2 h-4 w-4" />
            New Project
          </Link>
        </Button>
      </div>
      <ProjectsDataTable />
    </div>
  );
}
