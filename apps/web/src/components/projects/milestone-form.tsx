"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Milestone, Project, CreateMilestoneRequest, UpdateMilestoneRequest } from "@crm/types";
import { milestonesApi, projectsApi } from "@/lib/api";
import { useMutation, useApi } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const milestoneFormSchema = z.object({
  name: z.string().min(2, "Milestone name must be at least 2 characters"),
  description: z.string().optional(),
  projectId: z.string().min(1, "Project is required"),
  dueDate: z.string().min(1, "Due date is required"),
  status: z.enum(["pending", "in_progress", "completed", "delayed"]),
});

type MilestoneFormValues = z.infer<typeof milestoneFormSchema>;

interface MilestoneFormProps {
  milestone?: Milestone;
  mode: "create" | "edit";
  defaultProjectId?: string;
}

export function MilestoneForm({ milestone, mode, defaultProjectId }: MilestoneFormProps) {
  const router = useRouter();

  const { data: projects, isLoading: projectsLoading } = useApi<Project[]>(
    () => projectsApi.getAll(),
    { autoFetch: true }
  );

  const createMutation = useMutation<Milestone, CreateMilestoneRequest>((data) =>
    milestonesApi.create(data)
  );

  const updateMutation = useMutation<Milestone, UpdateMilestoneRequest>((data) =>
    milestonesApi.update(milestone?.id || "", data)
  );

  const form = useForm<MilestoneFormValues>({
    resolver: zodResolver(milestoneFormSchema) as any,
    defaultValues: {
      name: milestone?.name || "",
      description: milestone?.description || "",
      projectId: milestone?.projectId || defaultProjectId || "",
      dueDate: milestone?.dueDate?.split("T")[0] || "",
      status: milestone?.status || "pending",
    },
  });

  useEffect(() => {
    if (milestone) {
      form.reset({
        name: milestone.name,
        description: milestone.description || "",
        projectId: milestone.projectId,
        dueDate: milestone.dueDate?.split("T")[0] || "",
        status: milestone.status,
      });
    }
  }, [milestone, form]);

  const onSubmit = async (values: MilestoneFormValues) => {
    const data = {
      name: values.name,
      description: values.description || undefined,
      projectId: values.projectId,
      dueDate: new Date(values.dueDate).toISOString(),
      status: values.status,
      completedDate: values.status === "completed" ? new Date().toISOString() : undefined,
      order: milestone?.order || 0,
    };

    let result;
    if (mode === "create") {
      result = await createMutation.mutate(data as CreateMilestoneRequest);
    } else {
      result = await updateMutation.mutate(data as UpdateMilestoneRequest);
    }

    if (result.success) {
      toast.success(mode === "create" ? "Milestone created successfully" : "Milestone updated successfully");
      router.push("/dashboard/projects/milestones");
      router.refresh();
    } else {
      toast.error(result.error || "Failed to save milestone");
    }
  };

  const isLoading = createMutation.isLoading || updateMutation.isLoading;
  const error = createMutation.error || updateMutation.error;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{mode === "create" ? "Create Milestone" : "Edit Milestone"}</CardTitle>
          <CardDescription>
            {mode === "create"
              ? "Create a new milestone to track project progress"
              : `Editing milestone: ${milestone?.name}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Milestone Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter milestone name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the milestone..."
                        className="resize-none"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="projectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={projectsLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a project" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projects?.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="delayed">Delayed</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="max-w-[250px]">
                    <FormLabel>Due Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Actions */}
              <div className="flex gap-4">
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {mode === "create" ? "Create Milestone" : "Update Milestone"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

