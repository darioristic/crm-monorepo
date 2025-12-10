import { PlusCircledIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import { MilestonesDataTable } from "@/components/projects/milestones-data-table";
import { Button } from "@/components/ui/button";
import { generateMeta } from "@/lib/utils";

export async function generateMetadata() {
  return generateMeta({
    title: "Milestones",
    description: "Manage project milestones",
    canonical: "/dashboard/projects/milestones",
  });
}

export default function MilestonesPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Milestones</h1>
          <p className="text-muted-foreground">View and manage project milestones</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/projects/milestones/new">
            <PlusCircledIcon className="mr-2 h-4 w-4" />
            New Milestone
          </Link>
        </Button>
      </div>
      <MilestonesDataTable />
    </div>
  );
}
