"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  FolderDotIcon,
  CheckCircle2Icon,
  ClockIcon,
  RefreshCwIcon,
  AlertTriangleIcon
} from "lucide-react";
import { analyticsApi, reportsApi } from "@/lib/api";
import { ReportFilters, ExportButton, projectStatusOptions, useReportFilters } from "@/components/reports/filters";
import {
  TaskCompletionChart,
  MilestoneStatusChart,
  TasksByPriorityChart,
  ChartSkeleton,
  ChartError,
  EmptyChartState
} from "@/components/reports/charts";
import type {
  ProjectSummary,
  ProjectReport,
  TaskStatPoint,
  MilestoneBreakdown,
  TaskPriorityStats,
  ProjectDurationStats
} from "@crm/types";
import type { ColumnDef } from "@/lib/export";
import { format } from "date-fns";

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  planning: "outline",
  in_progress: "default",
  on_hold: "secondary",
  completed: "default",
  cancelled: "destructive",
};

const statusLabels: Record<string, string> = {
  planning: "Planning",
  in_progress: "In Progress",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function ProjectReportsContent() {
  const { filters } = useReportFilters();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [projects, setProjects] = useState<ProjectReport[]>([]);
  const [taskStats, setTaskStats] = useState<TaskStatPoint[]>([]);
  const [milestoneBreakdown, setMilestoneBreakdown] = useState<MilestoneBreakdown[]>([]);
  const [tasksByPriority, setTasksByPriority] = useState<TaskPriorityStats[]>([]);
  const [durationStats, setDurationStats] = useState<ProjectDurationStats | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    const params = {
      from: filters.from,
      to: filters.to,
      projectId: filters.projectId,
    };

    try {
      const [
        summaryRes,
        projectsRes,
        taskStatsRes,
        milestoneRes,
        priorityRes,
        durationRes
      ] = await Promise.all([
        reportsApi.getProjectSummary(),
        reportsApi.getProjects({ status: filters.status, pageSize: 20 }),
        analyticsApi.getTaskStatsOverTime(params),
        analyticsApi.getMilestoneBreakdown(params),
        analyticsApi.getTasksByPriority(params),
        analyticsApi.getProjectDurationStats()
      ]);

      if (summaryRes.success && summaryRes.data) setSummary(summaryRes.data);
      if (projectsRes.success && projectsRes.data) setProjects(projectsRes.data);
      if (taskStatsRes.success && taskStatsRes.data) setTaskStats(taskStatsRes.data);
      if (milestoneRes.success && milestoneRes.data) setMilestoneBreakdown(milestoneRes.data);
      if (priorityRes.success && priorityRes.data) setTasksByPriority(priorityRes.data);
      if (durationRes.success && durationRes.data) setDurationStats(durationRes.data);
    } catch (err) {
      console.error("Failed to fetch project data:", err);
      setError("Failed to load project analytics");
    } finally {
      setLoading(false);
    }
  }, [filters.from, filters.to, filters.projectId, filters.status]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const dateRangeLabel = `${format(new Date(filters.from), "MMM d, yyyy")} - ${format(new Date(filters.to), "MMM d, yyyy")}`;

  const exportColumns: ColumnDef<ProjectReport>[] = [
    { key: "name", header: "Project Name" },
    { key: "status", header: "Status", format: (v) => statusLabels[v as string] || v },
    { key: "progressPercent", header: "Progress", format: (v) => `${v}%` },
    { key: "taskCount", header: "Total Tasks" },
    { key: "completedTaskCount", header: "Completed Tasks" },
    { key: "milestoneCount", header: "Milestones" },
    { key: "managerName", header: "Manager" },
  ];

  const taskCompletionRate = summary && summary.totalTasks > 0
    ? Math.round((summary.completedTasks / summary.totalTasks) * 100)
    : 0;

  return (
    <div className="space-y-6" id="project-report-content">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Project Reports</h1>
          <p className="text-muted-foreground">
            Track project progress and team performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            data={projects}
            filename={`project-report-${format(new Date(), "yyyy-MM-dd")}`}
            columns={exportColumns}
            elementId="project-report-content"
            pdfOptions={{
              title: "Project Report",
              dateRange: dateRangeLabel,
            }}
            disabled={loading}
          />
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCwIcon className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <ReportFilters
        showProjectFilter
        showStatusFilter
        statusOptions={projectStatusOptions}
        statusPlaceholder="Project Status"
      />

      {error && (
        <ChartError message={error} onRetry={fetchData} />
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <FolderDotIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{summary?.activeProjects || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {summary?.completedProjects || 0} completed, {summary?.totalProjects || 0} total
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tasks Completed</CardTitle>
            <CheckCircle2Icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{summary?.completedTasks || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {taskCompletionRate}% completion rate
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
            <AlertTriangleIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold text-amber-600">
                  {summary?.overdueTasks || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Require attention
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg. Duration</CardTitle>
            <ClockIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {durationStats?.avgDurationDays || 0} days
                </div>
                <p className="text-xs text-muted-foreground">
                  {durationStats?.onTimePercentage || 0}% on time
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts - Row 1 */}
      <div className="grid gap-4 md:grid-cols-2">
        {loading ? (
          <>
            <ChartSkeleton height={300} />
            <ChartSkeleton height={250} />
          </>
        ) : (
          <>
            {taskStats.length > 0 ? (
              <TaskCompletionChart data={taskStats} />
            ) : (
              <EmptyChartState title="No Task Data" message="No task statistics available for the selected period." />
            )}
            {milestoneBreakdown.length > 0 ? (
              <MilestoneStatusChart data={milestoneBreakdown} />
            ) : (
              <EmptyChartState title="No Milestone Data" message="No milestone data available." />
            )}
          </>
        )}
      </div>

      {/* Tasks by Priority */}
      {loading ? (
        <ChartSkeleton height={250} />
      ) : tasksByPriority.length > 0 ? (
        <TasksByPriorityChart data={tasksByPriority} />
      ) : (
        <EmptyChartState title="No Priority Data" message="No task priority data available." />
      )}

      {/* Active Projects Table */}
      <Card>
        <CardHeader>
          <CardTitle>Project Status Overview</CardTitle>
          <CardDescription>Current status of all projects</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No projects found for the selected filters.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="text-center">Tasks</TableHead>
                  <TableHead className="text-center">Milestones</TableHead>
                  <TableHead>Manager</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.slice(0, 10).map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">{project.name}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariants[project.status] || "outline"}>
                        {statusLabels[project.status] || project.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={project.progressPercent} className="h-2 w-20" />
                        <span className="text-sm text-muted-foreground">
                          {project.progressPercent}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {project.completedTaskCount}/{project.taskCount}
                    </TableCell>
                    <TableCell className="text-center">
                      {project.completedMilestoneCount}/{project.milestoneCount}
                    </TableCell>
                    <TableCell>{project.managerName || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

