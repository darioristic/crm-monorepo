"use client";

import { useSearchParams } from "next/navigation";
import { TaskForm } from "@/components/projects/task-form";

export default function NewTaskPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") || undefined;

  return (
    <div className="max-w-3xl">
      <TaskForm mode="create" defaultProjectId={projectId} />
    </div>
  );
}
