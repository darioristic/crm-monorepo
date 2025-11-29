"use client";

import { useSearchParams } from "next/navigation";
import { MilestoneForm } from "@/components/projects/milestone-form";

export default function NewMilestonePage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") || undefined;

  return (
    <div className="max-w-3xl">
      <MilestoneForm mode="create" defaultProjectId={projectId} />
    </div>
  );
}

