"use client";

import type { Project, Task, User as UserType } from "@crm/types";
import { AlertCircle, ArrowLeft, Calendar, Clock, Folder, Pencil, User } from "lucide-react";
import Link from "next/link";
import { use } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { projectsApi, tasksApi, usersApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface TaskDetailPageProps {
  params: Promise<{ id: string }>;
}

const statusColors = {
  todo: "secondary",
  in_progress: "default",
  review: "warning",
  done: "success",
} as const;

const priorityColors = {
  low: "outline",
  medium: "secondary",
  high: "warning",
  urgent: "destructive",
} as const;

export default function TaskDetailPage({ params }: TaskDetailPageProps) {
  const { id } = use(params);

  const {
    data: task,
    isLoading,
    error,
  } = useApi<Task>(() => tasksApi.getById(id), { autoFetch: true });

  const { data: projects } = useApi<Project[]>(() => projectsApi.getAll(), { autoFetch: true });

  const { data: users } = useApi<UserType[]>(() => usersApi.getAll(), { autoFetch: true });

  const project = projects?.find((p) => p.id === task?.projectId);
  const assignee = users?.find((u) => u.id === task?.assignedTo);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px]" />
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard/projects/tasks">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">{task.title}</h1>
            <Badge variant={statusColors[task.status]} className="capitalize">
              {task.status.replace("_", " ")}
            </Badge>
            <Badge variant={priorityColors[task.priority]} className="capitalize">
              {task.priority}
            </Badge>
          </div>
        </div>
        <Button asChild>
          <Link href={`/dashboard/projects/tasks/${id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit Task
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">
              {task.description || "No description provided"}
            </p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Project</p>
                  <Link
                    href={`/dashboard/projects/${task.projectId}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {project?.name || "Unknown"}
                  </Link>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Assignee</p>
                  <p className="text-sm font-medium">
                    {assignee ? `${assignee.firstName} ${assignee.lastName}` : "Unassigned"}
                  </p>
                </div>
              </div>

              {task.dueDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Due Date</p>
                    <p className="text-sm font-medium">{formatDate(task.dueDate)}</p>
                  </div>
                </div>
              )}

              {task.estimatedHours && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Estimated Hours</p>
                    <p className="text-sm font-medium">{task.estimatedHours}h</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {task.tags && task.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {task.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
