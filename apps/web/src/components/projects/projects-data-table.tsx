"use client";

import * as React from "react";
import Link from "next/link";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable
} from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, RefreshCwIcon, Pencil, Trash2, Eye, LayoutGrid } from "lucide-react";
import type { Project, User, Company } from "@crm/types";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatDate } from "@/lib/utils";
import { projectsApi, usersApi, companiesApi } from "@/lib/api";
import { usePaginatedApi, useMutation, useApi } from "@/hooks/use-api";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";

type ProjectWithRelations = Project & {
  ownerName?: string;
  companyName?: string;
  progress?: number;
};

const statusColors = {
  planning: "secondary",
  in_progress: "default",
  on_hold: "warning",
  completed: "success",
  cancelled: "destructive"
} as const;

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "planning", label: "Planning" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" }
];

export function ProjectsDataTable() {
  const [searchValue, setSearchValue] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedProject, setSelectedProject] = React.useState<ProjectWithRelations | null>(null);

  // Fetch users for owner lookup
  const { data: users } = useApi<User[]>(
    () => usersApi.getAll(),
    { autoFetch: true }
  );

  // Fetch companies for company lookup
  const { data: companies } = useApi<Company[]>(
    () => companiesApi.getAll(),
    { autoFetch: true }
  );

  // Create lookup maps
  const userMap = React.useMemo(() => {
    const map = new Map<string, string>();
    users?.forEach((user) => {
      map.set(user.id, `${user.firstName} ${user.lastName}`);
    });
    return map;
  }, [users]);

  const companyMap = React.useMemo(() => {
    const map = new Map<string, string>();
    companies?.forEach((company) => {
      map.set(company.id, company.name);
    });
    return map;
  }, [companies]);

  // Fetch projects with server-side pagination
  const {
    data: projects,
    isLoading,
    error,
    refetch,
    page,
    pageSize,
    totalCount,
    totalPages,
    setPage,
    setFilters
  } = usePaginatedApi<Project>(
    (params) => projectsApi.getAll(params),
    { search: searchValue, status: statusFilter === "all" ? undefined : statusFilter }
  );

  // Delete mutation
  const deleteMutation = useMutation<void, string>((id) => projectsApi.delete(id));

  // Enrich projects with related data
  const enrichedProjects: ProjectWithRelations[] = React.useMemo(() => {
    return (projects || []).map((project) => ({
      ...project,
      ownerName: userMap.get(project.managerId) || "Unknown",
      companyName: project.clientId ? companyMap.get(project.clientId) : undefined,
      progress: 0 // Would be calculated from tasks
    }));
  }, [projects, userMap, companyMap]);

  // Handle search with debounce
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setFilters({
        search: searchValue,
        status: statusFilter === "all" ? undefined : statusFilter
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue, statusFilter, setFilters]);

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

  const columns: ColumnDef<ProjectWithRelations>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Project Name
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
      cell: ({ row }) => (
        <Link
          href={`/dashboard/projects/${row.original.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.name}
        </Link>
      )
    },
    {
      accessorKey: "companyName",
      header: "Company",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.companyName || "-"}</span>
      )
    },
    {
      accessorKey: "ownerName",
      header: "Owner",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.ownerName}</span>
      )
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={statusColors[row.original.status]} className="capitalize">
        {row.original.status.replace("_", " ")}
      </Badge>
    )
  },
  {
    accessorKey: "progress",
    header: "Progress",
    cell: ({ row }) => (
      <div className="flex items-center gap-2 w-32">
          <Progress value={row.original.progress || 0} className="h-2" />
          <span className="text-sm text-muted-foreground">{row.original.progress || 0}%</span>
      </div>
    )
  },
  {
    accessorKey: "startDate",
    header: "Start Date",
      cell: ({ row }) => row.original.startDate ? formatDate(row.original.startDate) : "-"
  },
  {
    accessorKey: "endDate",
      header: "Due Date",
      cell: ({ row }) => {
        if (!row.original.endDate) return "-";
        const dueDate = new Date(row.original.endDate);
        const isOverdue = dueDate < new Date() && row.original.status !== "completed";
        return (
          <span className={isOverdue ? "text-destructive font-medium" : ""}>
            {formatDate(row.original.endDate)}
          </span>
        );
      }
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/projects/${row.original.id}`}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/projects/${row.original.id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Project
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/kanban?projectId=${row.original.id}`}>
                <LayoutGrid className="mr-2 h-4 w-4" />
                Kanban Board
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => {
                setSelectedProject(row.original);
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }
];

  const table = useReactTable({
    data: enrichedProjects,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages
  });

  if (isLoading && !projects?.length) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px] w-full" />
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
    <div className="w-full">
      <div className="flex items-center gap-4 py-4">
        <Input
          placeholder="Search projects..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCwIcon className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No projects found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between pt-4">
        <div className="text-sm text-muted-foreground">
          Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} projects
        </div>
        <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
            onClick={() => setPage(page - 1)}
            disabled={page <= 1}
          >
          Previous
        </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages || 1}
          </span>
        <Button
          variant="outline"
          size="sm"
            onClick={() => setPage(page + 1)}
            disabled={page >= totalPages}
          >
          Next
        </Button>
      </div>
      </div>

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
