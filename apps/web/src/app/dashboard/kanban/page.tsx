"use client";

import { useEffect, useMemo, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Task, Project, User } from "@crm/types";
import { tasksApi, projectsApi, usersApi } from "@/lib/api";
import { useApi, useMutation } from "@/hooks/use-api";
import { 
  Kanban, 
  KanbanBoard, 
  KanbanColumn, 
  KanbanItem, 
  KanbanOverlay 
} from "@/components/ui/kanban";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar, User as UserIcon, ArrowLeft, GripVertical, ExternalLink } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import type { UniqueIdentifier } from "@dnd-kit/core";

type TaskWithRelations = Task & {
  assigneeName?: string;
};

type KanbanColumns = Record<string, TaskWithRelations[]>;

const COLUMNS = {
  todo: { id: "todo", title: "To Do" },
  in_progress: { id: "in_progress", title: "In Progress" },
  review: { id: "review", title: "Review" },
  done: { id: "done", title: "Done" }
};

const priorityColors = {
  low: "outline",
  medium: "secondary",
  high: "warning",
  urgent: "destructive"
} as const;

function TaskCard({ task, onTaskClick }: { task: TaskWithRelations; onTaskClick: (task: TaskWithRelations) => void }) {
  return (
    <Card 
      className="cursor-grab active:cursor-grabbing"
      onClick={() => onTaskClick(task)}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{task.title}</p>
            {task.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                {task.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant={priorityColors[task.priority]} className="text-xs">
                {task.priority}
              </Badge>
              {task.dueDate && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(task.dueDate)}
                </span>
              )}
            </div>
            {task.assigneeName && (
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <UserIcon className="h-3 w-3" />
                {task.assigneeName}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function KanbanContent() {
  const searchParams = useSearchParams();
  const projectIdParam = searchParams.get("projectId");
  
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectIdParam || "all");
  const [columns, setColumns] = useState<KanbanColumns>({
    todo: [],
    in_progress: [],
    review: [],
    done: []
  });
  const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);

  // Fetch projects
  const { data: projects, isLoading: projectsLoading } = useApi<Project[]>(
    () => projectsApi.getAll(),
    { autoFetch: true }
  );

  // Fetch users for assignee lookup
  const { data: users } = useApi<User[]>(
    () => usersApi.getAll(),
    { autoFetch: true }
  );

  // User map for assignee names
  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    users?.forEach((user) => {
      map.set(user.id, `${user.firstName} ${user.lastName}`);
    });
    return map;
  }, [users]);

  // Fetch tasks based on selected project
  const { data: tasks, isLoading: tasksLoading, refetch } = useApi<Task[]>(
    () => tasksApi.getAll(selectedProjectId !== "all" ? { projectId: selectedProjectId } : {}),
    { autoFetch: true }
  );

  // Update mutation
  const updateMutation = useMutation<Task, { id: string; status: Task["status"] }>((data) =>
    tasksApi.update(data.id, { status: data.status })
  );

  // Organize tasks into columns
  useEffect(() => {
    if (tasks) {
      const organized: KanbanColumns = {
        todo: [],
        in_progress: [],
        review: [],
        done: []
      };

      tasks.forEach((task) => {
        const taskWithRelations: TaskWithRelations = {
          ...task,
          assigneeName: task.assignedTo ? userMap.get(task.assignedTo) : undefined
        };
        if (organized[task.status]) {
          organized[task.status].push(taskWithRelations);
        }
      });

      setColumns(organized);
    }
  }, [tasks, userMap]);

  // Refetch when project changes
  useEffect(() => {
    refetch();
  }, [selectedProjectId, refetch]);

  // Handle column change
  const handleValueChange = useCallback(async (newColumns: KanbanColumns) => {
    // Find task that changed columns
    const previousColumns = columns;
    
    for (const [status, taskList] of Object.entries(newColumns)) {
      for (const task of taskList) {
        const previousStatus = Object.entries(previousColumns).find(([_, tasks]) =>
          tasks.some((t) => t.id === task.id)
        )?.[0];

        if (previousStatus && previousStatus !== status) {
          // Task moved to a new column - update on backend
          const result = await updateMutation.mutate({
            id: task.id,
            status: status as Task["status"]
          });

          if (!result.success) {
            toast.error("Failed to update task status");
            // Revert to previous state
            setColumns(previousColumns);
            return;
          }

          toast.success(`Task moved to ${COLUMNS[status as keyof typeof COLUMNS].title}`);
        }
      }
    }

    setColumns(newColumns);
  }, [columns, updateMutation]);

  const handleTaskClick = (task: TaskWithRelations) => {
    setSelectedTask(task);
    setTaskDialogOpen(true);
  };

  const getItemValue = useCallback((task: TaskWithRelations): UniqueIdentifier => task.id, []);

  const isLoading = projectsLoading || tasksLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[600px] w-[300px]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/projects">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Kanban Board</h1>
            <p className="text-muted-foreground">
              Drag and drop tasks between columns
            </p>
          </div>
        </div>

        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects?.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Kanban Board */}
      <div className="overflow-x-auto pb-4">
        <Kanban
          value={columns}
          onValueChange={handleValueChange}
          getItemValue={getItemValue}
        >
          <KanbanBoard className="min-w-max">
            {Object.entries(COLUMNS).map(([columnId, column]) => (
              <KanbanColumn 
                key={columnId} 
                value={columnId}
                className="w-[300px] bg-muted/50"
              >
                <Card className="border-0 shadow-none bg-transparent">
                  <CardHeader className="pb-2 px-2 pt-2">
                    <CardTitle className="text-sm font-medium flex items-center justify-between">
                      {column.title}
                      <Badge variant="secondary" className="ml-2">
                        {columns[columnId]?.length || 0}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 space-y-2 min-h-[500px]">
                    {columns[columnId]?.map((task) => (
                      <KanbanItem key={task.id} value={task.id} asHandle>
                        <TaskCard task={task} onTaskClick={handleTaskClick} />
                      </KanbanItem>
                    ))}
                  </CardContent>
                </Card>
              </KanbanColumn>
            ))}
          </KanbanBoard>
          <KanbanOverlay>
            {({ value }) => {
              const task = Object.values(columns)
                .flat()
                .find((t) => t.id === value);
              if (!task) return null;
              return <TaskCard task={task} onTaskClick={() => {}} />;
            }}
          </KanbanOverlay>
        </Kanban>
      </div>

      {/* Task Details Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTask?.title}
              <Badge variant={priorityColors[selectedTask?.priority || "medium"]} className="capitalize">
                {selectedTask?.priority}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              Task details and actions
            </DialogDescription>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              {selectedTask.description && (
                <div>
                  <p className="text-sm font-medium mb-1">Description</p>
                  <p className="text-sm text-muted-foreground">{selectedTask.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {selectedTask.assigneeName && (
                  <div>
                    <p className="text-sm font-medium mb-1">Assignee</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <UserIcon className="h-3 w-3" />
                      {selectedTask.assigneeName}
                    </p>
                  </div>
                )}

                {selectedTask.dueDate && (
                  <div>
                    <p className="text-sm font-medium mb-1">Due Date</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(selectedTask.dueDate)}
                    </p>
                  </div>
                )}

                {selectedTask.estimatedHours && (
                  <div>
                    <p className="text-sm font-medium mb-1">Estimated Hours</p>
                    <p className="text-sm text-muted-foreground">{selectedTask.estimatedHours}h</p>
                  </div>
                )}
              </div>

              {selectedTask.tags && selectedTask.tags.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedTask.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button asChild>
                  <Link href={`/dashboard/projects/tasks/${selectedTask.id}`}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Details
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function KanbanPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[600px] w-[300px]" />
          ))}
        </div>
      </div>
    }>
      <KanbanContent />
    </Suspense>
  );
}
