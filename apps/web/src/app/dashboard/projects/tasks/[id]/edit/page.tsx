"use client";

import type { Task } from "@crm/types";
import { AlertCircle } from "lucide-react";
import { use } from "react";
import { TaskForm } from "@/components/projects/task-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { tasksApi } from "@/lib/api";

interface EditTaskPageProps {
  params: Promise<{ id: string }>;
}

export default function EditTaskPage({ params }: EditTaskPageProps) {
  const { id } = use(params);

  const {
    data: task,
    isLoading,
    error,
  } = useApi<Task>(() => tasksApi.getById(id), { autoFetch: true });

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
