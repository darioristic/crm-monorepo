import { Suspense } from "react";
import { ChartSkeleton } from "@/components/reports/charts";
import { generateMeta } from "@/lib/utils";
import { ProjectReportsContent } from "./project-reports-content";

export async function generateMetadata() {
  return generateMeta({
    title: "Project Reports",
    description: "Project analytics and reporting",
    canonical: "/dashboard/reports/projects",
  });
}

export default function ProjectReportsPage() {
  return (
    <Suspense fallback={<ProjectReportsSkeleton />}>
      <ProjectReportsContent />
    </Suspense>
  );
}

function ProjectReportsSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-4 w-64 bg-muted rounded mt-2 animate-pulse" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-muted rounded animate-pulse" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ChartSkeleton height={300} />
        <ChartSkeleton height={300} />
      </div>
    </div>
  );
}
