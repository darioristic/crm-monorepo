"use client";

import * as React from "react";
import Link from "next/link";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable
} from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, RefreshCwIcon, Pencil, Trash2, Eye, CheckCircle } from "lucide-react";
import type { Milestone, Project } from "@crm/types";

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
import { formatDate } from "@/lib/utils";
import { milestonesApi, projectsApi } from "@/lib/api";
import { usePaginatedApi, useMutation, useApi } from "@/hooks/use-api";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";

type MilestoneWithRelations = Milestone & {
  projectName?: string;
};

const statusColors = {
  pending: "secondary",
  in_progress: "default",
  completed: "success",
  delayed: "destructive"
} as const;

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "delayed", label: "Delayed" }
];

interface MilestonesDataTableProps {
  projectId?: string;
}

export function MilestonesDataTable({ projectId }: MilestonesDataTableProps) {
  const [searchValue, setSearchValue] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedMilestone, setSelectedMilestone] = React.useState<MilestoneWithRelations | null>(null);

  // Fetch projects for lookup
  const { data: projects } = useApi<Project[]>(
    () => projectsApi.getAll(),
    { autoFetch: true }
  );

  // Create lookup map
  const projectMap = React.useMemo(() => {
    const map = new Map<string, string>();
    projects?.forEach((project) => {
      map.set(project.id, project.name);
    });
    return map;
  }, [projects]);

  // Fetch milestones with server-side pagination
  const {
    data: milestones,
    isLoading,
    error,
    refetch,
    page,
    pageSize,
    totalCount,
    totalPages,
    setPage,
    setFilters
  } = usePaginatedApi<Milestone>(
    (params) => milestonesApi.getAll(params),
    {
      search: searchValue,
      status: statusFilter === "all" ? undefined : statusFilter,
      projectId: projectId
    }
  );

  // Delete mutation
  const deleteMutation = useMutation<void, string>((id) => milestonesApi.delete(id));

  // Update mutation for marking complete
  const updateMutation = useMutation<Milestone, { id: string; status: string; completedDate?: string }>((data) =>
    milestonesApi.update(data.id, {
      status: data.status as Milestone["status"],
      completedDate: data.completedDate
    })
  );

  // Enrich milestones with related data
  const enrichedMilestones: MilestoneWithRelations[] = React.useMemo(() => {
    return (milestones || []).map((milestone) => ({
      ...milestone,
      projectName: projectMap.get(milestone.projectId) || "Unknown Project"
    }));
  }, [milestones, projectMap]);

  // Handle search with debounce
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setFilters({
        search: searchValue,
        status: statusFilter === "all" ? undefined : statusFilter,
        projectId: projectId
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue, statusFilter, projectId, setFilters]);

  // Handle delete
  const handleDelete = async () => {
    if (!selectedMilestone) return;

    const result = await deleteMutation.mutate(selectedMilestone.id);
    if (result.success) {
      toast.success("Milestone deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedMilestone(null);
      refetch();
    } else {
      toast.error(getErrorMessage(result.error, "Failed to delete milestone"));
    }
  };

  // Handle mark as complete
  const handleMarkComplete = async (milestone: MilestoneWithRelations) => {
    const result = await updateMutation.mutate({
      id: milestone.id,
      status: "completed",
      completedDate: new Date().toISOString()
    });
    if (result.success) {
      toast.success("Milestone marked as complete");
      refetch();
    } else {
      toast.error(getErrorMessage(result.error, "Failed to update milestone"));
    }
  };

  const columns: ColumnDef<MilestoneWithRelations>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Milestone
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
      cell: ({ row }) => (
        <Link
          href={`/dashboard/projects/milestones/${row.original.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.name}
        </Link>
      )
    },
    {
      accessorKey: "projectName",
      header: "Project",
      cell: ({ row }) => (
        <Link
          href={`/dashboard/projects/${row.original.projectId}`}
          className="text-muted-foreground hover:text-primary hover:underline"
        >
          {row.original.projectName}
        </Link>
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
    accessorKey: "dueDate",
    header: "Due Date",
      cell: ({ row }) => {
        const dueDate = new Date(row.original.dueDate);
        const isOverdue = dueDate < new Date() && row.original.status !== "completed";
        return (
          <span className={isOverdue ? "text-destructive font-medium" : ""}>
            {formatDate(row.original.dueDate)}
          </span>
        );
      }
  },
    {
      accessorKey: "completedDate",
    header: "Completed",
      cell: ({ row }) => row.original.completedDate ? formatDate(row.original.completedDate) : "-"
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => formatDate(row.original.createdAt)
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
              <Link href={`/dashboard/projects/milestones/${row.original.id}`}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/projects/milestones/${row.original.id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Milestone
              </Link>
            </DropdownMenuItem>
            {row.original.status !== "completed" && (
              <DropdownMenuItem onClick={() => handleMarkComplete(row.original)}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Mark as Complete
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => {
                setSelectedMilestone(row.original);
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
    data: enrichedMilestones,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages
  });

  if (isLoading && !milestones?.length) {
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
          placeholder="Search milestones..."
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
                  No milestones found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between pt-4">
        <div className="text-sm text-muted-foreground">
          Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} milestones
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
        title="Delete Milestone"
        description={`Are you sure you want to delete milestone "${selectedMilestone?.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        isLoading={deleteMutation.isLoading}
      />
    </div>
  );
}
