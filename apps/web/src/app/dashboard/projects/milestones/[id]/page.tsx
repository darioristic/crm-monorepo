"use client";

import type { Milestone, Project } from "@crm/types";
import { AlertCircle, ArrowLeft, Calendar, CheckCircle, Folder, Pencil } from "lucide-react";
import Link from "next/link";
import { use } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { milestonesApi, projectsApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface MilestoneDetailPageProps {
  params: Promise<{ id: string }>;
}

const statusColors = {
  pending: "secondary",
  in_progress: "default",
  completed: "success",
  delayed: "destructive",
} as const;

export default function MilestoneDetailPage({ params }: MilestoneDetailPageProps) {
  const { id } = use(params);

  const {
    data: milestone,
    isLoading,
    error,
  } = useApi<Milestone>(() => milestonesApi.getById(id), { autoFetch: true });

  const { data: projects } = useApi<Project[]>(() => projectsApi.getAll(), { autoFetch: true });

  const project = projects?.find((p) => p.id === milestone?.projectId);

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

  if (!milestone) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Milestone not found</AlertDescription>
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
              <Link href="/dashboard/projects/milestones">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">{milestone.name}</h1>
            <Badge variant={statusColors[milestone.status]} className="capitalize">
              {milestone.status.replace("_", " ")}
            </Badge>
          </div>
        </div>
        <Button asChild>
          <Link href={`/dashboard/projects/milestones/${id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit Milestone
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
              {milestone.description || "No description provided"}
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
                    href={`/dashboard/projects/${milestone.projectId}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {project?.name || "Unknown"}
                  </Link>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Due Date</p>
                  <p className="text-sm font-medium">{formatDate(milestone.dueDate)}</p>
                </div>
              </div>

              {milestone.completedDate && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Completed</p>
                    <p className="text-sm font-medium">{formatDate(milestone.completedDate)}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-sm font-medium">{formatDate(milestone.createdAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
