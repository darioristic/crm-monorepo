"use client";

import * as React from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  RefreshCw,
  Calendar,
  ChevronDown,
  LayoutGrid,
  Smartphone,
  Globe,
  Layers,
  Grid3X3,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Project, User, Task } from "@crm/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { ProjectCard, type ProjectWithRelations } from "./project-card";
import { projectsApi, usersApi, tasksApi } from "@/lib/api";
import { usePaginatedApi, useMutation, useApi } from "@/hooks/use-api";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";

type CategoryFilter = "all" | "saas" | "website" | "mobile";
type DateFilter = "all" | "today" | "week" | "month";
type PriorityFilter = "all" | "high" | "medium" | "low";

const categoryTabs = [
  { id: "all" as const, label: "All Project", icon: Grid3X3 },
  { id: "saas" as const, label: "Saas Project", icon: Layers },
  { id: "website" as const, label: "Website", icon: Globe },
  { id: "mobile" as const, label: "Mobile App", icon: Smartphone },
];

const dateOptions = [
  { value: "all" as const, label: "All Date" },
  { value: "today" as const, label: "Today" },
  { value: "week" as const, label: "This Week" },
  { value: "month" as const, label: "This Month" },
];

const priorityOptions = [
  { value: "all" as const, label: "All Priority" },
  { value: "high" as const, label: "High Priority" },
  { value: "medium" as const, label: "Medium Priority" },
  { value: "low" as const, label: "Low Priority" },
];

function filterByCategory(project: Project, category: CategoryFilter): boolean {
  if (category === "all") return true;

  const tags = project.tags?.map((t) => t.toLowerCase()) || [];

  switch (category) {
    case "saas":
      return tags.some((t) => t.includes("saas"));
    case "website":
      return tags.some((t) => t.includes("website") || t.includes("web"));
    case "mobile":
      return tags.some((t) => t.includes("mobile") || t.includes("app"));
    default:
      return true;
  }
}

function filterByDate(project: Project, dateFilter: DateFilter): boolean {
  if (dateFilter === "all") return true;

  const createdAt = new Date(project.createdAt);
  const now = new Date();

  switch (dateFilter) {
    case "today":
      return createdAt.toDateString() === now.toDateString();
    case "week": {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return createdAt >= weekAgo;
    }
    case "month": {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return createdAt >= monthAgo;
    }
    default:
      return true;
  }
}

function filterByPriority(project: Project, priority: PriorityFilter): boolean {
  if (priority === "all") return true;

  const tags = project.tags?.map((t) => t.toLowerCase()) || [];

  switch (priority) {
    case "high":
      return tags.includes("high") || tags.includes("urgent");
    case "medium":
      return tags.includes("medium");
    case "low":
      return tags.includes("low");
    default:
      return true;
  }
}

const ITEMS_PER_PAGE = 9;

export function ProjectsBoardView() {
  const [searchValue, setSearchValue] = React.useState("");
  const [categoryFilter, setCategoryFilter] =
    React.useState<CategoryFilter>("all");
  const [dateFilter, setDateFilter] = React.useState<DateFilter>("all");
  const [priorityFilter, setPriorityFilter] =
    React.useState<PriorityFilter>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedProject, setSelectedProject] =
    React.useState<ProjectWithRelations | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);

  // Fetch users for member lookup
  const { data: users } = useApi<User[]>(() => usersApi.getAll(), {
    autoFetch: true,
  });

  // Fetch tasks for task count
  const { data: tasks } = useApi<Task[]>(
    () => tasksApi.getAll({ pageSize: 1000 }),
    { autoFetch: true }
  );

  // Create user lookup map
  const userMap = React.useMemo(() => {
    const map = new Map<string, User>();
    users?.forEach((user) => {
      map.set(user.id, user);
    });
    return map;
  }, [users]);

  // Create task count map
  const taskCountMap = React.useMemo(() => {
    const map = new Map<string, number>();
    tasks?.forEach((task) => {
      const count = map.get(task.projectId) || 0;
      map.set(task.projectId, count + 1);
    });
    return map;
  }, [tasks]);

  // Fetch projects
  const {
    data: projects,
    isLoading,
    error,
    refetch,
  } = usePaginatedApi<Project>(
    (params) => projectsApi.getAll({ ...params, pageSize: 100 }),
    { search: searchValue }
  );

  // Delete mutation
  const deleteMutation = useMutation<void, string>((id) =>
    projectsApi.delete(id)
  );

  // Enrich and filter projects
  const enrichedProjects: ProjectWithRelations[] = React.useMemo(() => {
    if (!projects) return [];

    return projects
      .map((project) => ({
        ...project,
        ownerName: userMap.get(project.managerId)
          ? `${userMap.get(project.managerId)!.firstName} ${
              userMap.get(project.managerId)!.lastName
            }`
          : "Unknown",
        taskCount: taskCountMap.get(project.id) || 0,
        teamMemberUsers: (project.teamMembers || [])
          .map((id) => userMap.get(id))
          .filter((u): u is User => !!u),
      }))
      .filter((project) => filterByCategory(project, categoryFilter))
      .filter((project) => filterByDate(project, dateFilter))
      .filter((project) => filterByPriority(project, priorityFilter));
  }, [
    projects,
    userMap,
    taskCountMap,
    categoryFilter,
    dateFilter,
    priorityFilter,
  ]);

  // Pagination calculations
  const totalItems = enrichedProjects.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedProjects = enrichedProjects.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, dateFilter, priorityFilter, searchValue]);

  // Handle delete
  const handleDelete = async () => {
    if (!selectedProject) return;

    const result = await deleteMutation.mutate(selectedProject.id);
    if (result.success) {
      toast.success("Project deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedProject(null);
      refetch();
    } else {
      toast.error(getErrorMessage(result.error, "Failed to delete project"));
    }
  };

  const openDeleteDialog = (project: ProjectWithRelations) => {
    setSelectedProject(project);
    setDeleteDialogOpen(true);
  };

  if (isLoading && !projects?.length) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 flex-1 max-w-sm" />
          <Skeleton className="h-10 w-40" />
        </div>
        <Skeleton className="h-10 w-96" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-[320px] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={() => refetch()}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Today Button */}
        <Button
          variant={dateFilter === "today" ? "default" : "outline"}
          size="sm"
          onClick={() =>
            setDateFilter(dateFilter === "today" ? "all" : "today")
          }
          className="gap-2"
        >
          <Calendar className="h-4 w-4" />
          Today
        </Button>

        {/* Date Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              {dateOptions.find((o) => o.value === dateFilter)?.label ||
                "All Date"}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {dateOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => setDateFilter(option.value)}
                className={dateFilter === option.value ? "bg-accent" : ""}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Priority Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              {priorityOptions.find((o) => o.value === priorityFilter)?.label ||
                "All Priority"}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {priorityOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => setPriorityFilter(option.value)}
                className={priorityFilter === option.value ? "bg-accent" : ""}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Refresh */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refetch()}
          disabled={isLoading}
          className="h-9 w-9"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>

        {/* Create New Project */}
        <Button asChild size="sm" className="gap-2 ml-auto">
          <Link href="/dashboard/projects/new">
            <Plus className="h-4 w-4" />
            Create New Project
          </Link>
        </Button>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1 border-b">
        {categoryTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = categoryFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setCategoryFilter(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors
                border-b-2 -mb-[1px]
                ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }
              `}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Projects Grid */}
      {enrichedProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <LayoutGrid className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No projects found</h3>
          <p className="text-muted-foreground mb-4">
            {searchValue ||
            categoryFilter !== "all" ||
            dateFilter !== "all" ||
            priorityFilter !== "all"
              ? "Try adjusting your filters"
              : "Get started by creating your first project"}
          </p>
          <Button asChild>
            <Link href="/dashboard/projects/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Project
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onDelete={openDeleteDialog}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-6 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of{" "}
                {totalItems} projects
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => {
                      // Show first page, last page, current page, and pages around current
                      const showPage =
                        page === 1 ||
                        page === totalPages ||
                        Math.abs(page - currentPage) <= 1;

                      const showEllipsis =
                        (page === 2 && currentPage > 3) ||
                        (page === totalPages - 1 &&
                          currentPage < totalPages - 2);

                      if (showEllipsis && !showPage) {
                        return (
                          <span
                            key={page}
                            className="px-2 text-muted-foreground"
                          >
                            ...
                          </span>
                        );
                      }

                      if (!showPage) return null;

                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className="w-9 h-9 p-0"
                        >
                          {page}
                        </Button>
                      );
                    }
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="gap-1"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Dialog */}
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Project"
        description={`Are you sure you want to delete project "${selectedProject?.name}"? This will also delete all associated tasks and milestones. This action cannot be undone.`}
        onConfirm={handleDelete}
        isLoading={deleteMutation.isLoading}
      />
    </div>
  );
}
