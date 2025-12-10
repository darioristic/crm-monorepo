"use client";

import type { Project, Task, User } from "@crm/types";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  type RowSelectionState,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  CheckCircle,
  Eye,
  MoreHorizontal,
  Pencil,
  RefreshCwIcon,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApi, useMutation, usePaginatedApi } from "@/hooks/use-api";
import { projectsApi, tasksApi, usersApi } from "@/lib/api";
import { formatDate, getErrorMessage } from "@/lib/utils";

type TaskWithRelations = Task & {
  projectName?: string;
  assigneeName?: string;
};

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

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
];

const priorityOptions = [
  { value: "all", label: "All Priorities" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

interface TasksDataTableProps {
  projectId?: string;
}

export function TasksDataTable({ projectId }: TasksDataTableProps) {
  const [searchValue, setSearchValue] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [priorityFilter, setPriorityFilter] = React.useState("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedTask, setSelectedTask] = React.useState<TaskWithRelations | null>(null);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = React.useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false);

  // Fetch projects for lookup
  const { data: projects } = useApi<Project[]>(() => projectsApi.getAll(), { autoFetch: true });

  // Fetch users for assignee lookup
  const { data: users } = useApi<User[]>(() => usersApi.getAll(), { autoFetch: true });

  // Create lookup maps
  const projectMap = React.useMemo(() => {
    const map = new Map<string, string>();
    projects?.forEach((project) => {
      map.set(project.id, project.name);
    });
    return map;
  }, [projects]);

  const userMap = React.useMemo(() => {
    const map = new Map<string, string>();
    users?.forEach((user) => {
      map.set(user.id, `${user.firstName} ${user.lastName}`);
    });
    return map;
  }, [users]);

  // Fetch tasks with server-side pagination
  const {
    data: tasks,
    isLoading,
    error,
    refetch,
    page,
    pageSize,
    totalCount,
    totalPages,
    setPage,
    setFilters,
  } = usePaginatedApi<Task>((params) => tasksApi.getAll(params), {
    search: searchValue,
    status: statusFilter === "all" ? undefined : statusFilter,
    priority: priorityFilter === "all" ? undefined : priorityFilter,
    projectId: projectId,
  });

  // Delete mutation
  const deleteMutation = useMutation<void, string>((id) => tasksApi.delete(id));

  // Update mutation for marking done
  const updateMutation = useMutation<Task, { id: string; status: string }>((data) =>
    tasksApi.update(data.id, { status: data.status as Task["status"] })
  );

  // Enrich tasks with related data
  const enrichedTasks: TaskWithRelations[] = React.useMemo(() => {
    return (tasks || []).map((task) => ({
      ...task,
      projectName: projectMap.get(task.projectId) || "Unknown Project",
      assigneeName: task.assignedTo ? userMap.get(task.assignedTo) : undefined,
    }));
  }, [tasks, projectMap, userMap]);

  // Handle search with debounce
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setFilters({
        search: searchValue,
        status: statusFilter === "all" ? undefined : statusFilter,
        priority: priorityFilter === "all" ? undefined : priorityFilter,
        projectId: projectId,
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue, statusFilter, priorityFilter, projectId, setFilters]);

  // Handle delete
  const handleDelete = async () => {
    if (!selectedTask) return;

    const result = await deleteMutation.mutate(selectedTask.id);
    if (result.success) {
      toast.success("Task deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedTask(null);
      refetch();
    } else {
      toast.error(getErrorMessage(result.error, "Failed to delete task"));
    }
  };

  // Handle mark as done
  const handleMarkDone = async (task: TaskWithRelations) => {
    const result = await updateMutation.mutate({ id: task.id, status: "done" });
    if (result.success) {
      toast.success("Task marked as done");
      refetch();
    } else {
      toast.error(getErrorMessage(result.error, "Failed to update task"));
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    const selectedRows = Object.keys(rowSelection);
    if (selectedRows.length === 0) return;

    setIsBulkDeleting(true);
    let successCount = 0;
    let failCount = 0;

    for (const rowIndex of selectedRows) {
      const task = enrichedTasks[parseInt(rowIndex, 10)];
      if (task) {
        const result = await deleteMutation.mutate(task.id);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      }
    }

    setIsBulkDeleting(false);
    setBulkDeleteDialogOpen(false);
    setRowSelection({});

    if (successCount > 0) {
      toast.success(`Successfully deleted ${successCount} task(s)`);
    }
    if (failCount > 0) {
      toast.error(`Failed to delete ${failCount} task(s)`);
    }
    refetch();
  };

  const selectedCount = Object.keys(rowSelection).length;

  const columns: ColumnDef<TaskWithRelations>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "title",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Task
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <Link
          href={`/dashboard/projects/tasks/${row.original.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.title}
        </Link>
      ),
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
      ),
    },
    {
      accessorKey: "assigneeName",
      header: "Assignee",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.assigneeName || "Unassigned"}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={statusColors[row.original.status]} className="capitalize">
          {row.original.status.replace("_", " ")}
        </Badge>
      ),
    },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => (
        <Badge variant={priorityColors[row.original.priority]} className="capitalize">
          {row.original.priority}
        </Badge>
      ),
    },
    {
      accessorKey: "dueDate",
      header: "Due Date",
      cell: ({ row }) => {
        if (!row.original.dueDate) return "-";
        const dueDate = new Date(row.original.dueDate);
        const isOverdue = dueDate < new Date() && row.original.status !== "done";
        return (
          <span className={isOverdue ? "text-destructive font-medium" : ""}>
            {formatDate(row.original.dueDate)}
          </span>
        );
      },
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
              <Link href={`/dashboard/projects/tasks/${row.original.id}`}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/projects/tasks/${row.original.id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Task
              </Link>
            </DropdownMenuItem>
            {row.original.status !== "done" && (
              <DropdownMenuItem onClick={() => handleMarkDone(row.original)}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Mark as Done
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => {
                setSelectedTask(row.original);
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const table = useReactTable({
    data: enrichedTasks,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages,
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
    },
  });

  if (isLoading && !tasks?.length) {
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
      <div className="flex flex-wrap items-center gap-4 py-4">
        <Input
          placeholder="Search tasks..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            {priorityOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCwIcon className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
        {selectedCount > 0 && (
          <Button variant="destructive" size="sm" onClick={() => setBulkDeleteDialogOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete ({selectedCount})
          </Button>
        )}
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
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
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
                  No tasks found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between pt-4">
        <div className="text-sm text-muted-foreground">
          {selectedCount > 0 ? (
            <span>
              {selectedCount} of {totalCount} row(s) selected
            </span>
          ) : (
            <span>
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of{" "}
              {totalCount} tasks
            </span>
          )}
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
        title="Delete Task"
        description={`Are you sure you want to delete task "${selectedTask?.title}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        isLoading={deleteMutation.isLoading}
      />

      <DeleteDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        title="Delete Selected Tasks"
        description={`Are you sure you want to delete ${selectedCount} selected task(s)? This action cannot be undone.`}
        onConfirm={handleBulkDelete}
        isLoading={isBulkDeleting}
      />
    </div>
  );
}
