"use client";

import type { Project } from "@crm/types";
import { AlertCircle } from "lucide-react";
import { use } from "react";
import { ProjectForm } from "@/components/projects/project-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { projectsApi } from "@/lib/api";

interface EditProjectPageProps {
  params: Promise<{ id: string }>;
}

export default function EditProjectPage({ params }: EditProjectPageProps) {
  const { id } = use(params);

  const {
    data: project,
    isLoading,
    error,
  } = useApi<Project>(() => projectsApi.getById(id), { autoFetch: true });

  if (isLoading) {
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!project) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Project not found</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="max-w-3xl">
      <ProjectForm project={project} mode="edit" />
    </div>
  );
}
