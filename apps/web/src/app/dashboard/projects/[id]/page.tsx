"use client";

import { use } from "react";
import Link from "next/link";
import { projectsApi, tasksApi, milestonesApi, usersApi, companiesApi } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Calendar, User, Building2, LayoutGrid, Pencil, ArrowLeft } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { TasksDataTable } from "@/components/projects/tasks-data-table";
import { MilestonesDataTable } from "@/components/projects/milestones-data-table";
import type { Project, Task, Milestone, User as UserType, Company } from "@crm/types";

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>;
}

const statusColors = {
  planning: "secondary",
  in_progress: "default",
  on_hold: "warning",
  completed: "success",
  cancelled: "destructive"
} as const;

export default function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { id } = use(params);

  const { data: project, isLoading: projectLoading, error: projectError } = useApi<Project>(
    () => projectsApi.getById(id),
    { autoFetch: true }
  );

  const { data: tasks } = useApi<Task[]>(
    () => tasksApi.getAll({ projectId: id }),
    { autoFetch: true }
  );

  const { data: milestones } = useApi<Milestone[]>(
    () => milestonesApi.getAll({ projectId: id }),
    { autoFetch: true }
  );

  const { data: users } = useApi<UserType[]>(
    () => usersApi.getAll(),
    { autoFetch: true }
  );

  const { data: companies } = useApi<Company[]>(
    () => companiesApi.getAll(),
    { autoFetch: true }
  );

  // Calculate progress based on tasks
  const completedTasks = tasks?.filter((t) => t.status === "done").length || 0;
  const totalTasks = tasks?.length || 0;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Get manager and company names
  const managerName = users?.find((u) => u.id === project?.managerId);
  const companyName = companies?.find((c) => c.id === project?.clientId);

  if (projectLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (projectError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{projectError}</AlertDescription>
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard/projects">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            <Badge variant={statusColors[project.status]} className="capitalize">
              {project.status.replace("_", " ")}
            </Badge>
          </div>
          {project.description && (
            <p className="text-muted-foreground max-w-2xl">{project.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/dashboard/kanban?projectId=${id}`}>
              <LayoutGrid className="mr-2 h-4 w-4" />
              Kanban Board
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/dashboard/projects/${id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Project
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{progress}%</div>
            <Progress value={progress} className="h-2 mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {completedTasks} of {totalTasks} tasks complete
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Manager</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-medium">
              {managerName ? `${managerName.firstName} ${managerName.lastName}` : "-"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Client</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-medium">{companyName?.name || "-"}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Timeline</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              <div>{project.startDate ? formatDate(project.startDate) : "-"}</div>
              <div className="text-muted-foreground">to</div>
              <div>{project.endDate ? formatDate(project.endDate) : "-"}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget info if available */}
      {project.budget && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(project.budget, project.currency)}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tags */}
      {project.tags && project.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {project.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Tabs for Tasks and Milestones */}
      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tasks">
            Tasks ({tasks?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="milestones">
            Milestones ({milestones?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Project Tasks</h2>
              <p className="text-sm text-muted-foreground">
                All tasks associated with this project
              </p>
            </div>
            <Button asChild>
              <Link href={`/dashboard/projects/tasks/new?projectId=${id}`}>
                Add Task
              </Link>
            </Button>
          </div>
          <TasksDataTable projectId={id} />
        </TabsContent>

        <TabsContent value="milestones" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Project Milestones</h2>
              <p className="text-sm text-muted-foreground">
                Key milestones for this project
              </p>
            </div>
            <Button asChild>
              <Link href={`/dashboard/projects/milestones/new?projectId=${id}`}>
                Add Milestone
              </Link>
            </Button>
          </div>
          <MilestonesDataTable projectId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

