"use client";

import { use } from "react";
import { TaskForm } from "@/components/projects/task-form";
import { tasksApi } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import type { Task } from "@crm/types";

interface EditTaskPageProps {
  params: Promise<{ id: string }>;
}

export default function EditTaskPage({ params }: EditTaskPageProps) {
  const { id } = use(params);

  const { data: task, isLoading, error } = useApi<Task>(
    () => tasksApi.getById(id),
    { autoFetch: true }
  );

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

  if (!task) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Task not found</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="max-w-3xl">
      <TaskForm task={task} mode="edit" />
    </div>
  );
}

