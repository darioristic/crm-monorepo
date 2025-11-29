"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Project, User, Company, CreateProjectRequest, UpdateProjectRequest } from "@crm/types";
import { projectsApi, usersApi, companiesApi } from "@/lib/api";
import { useMutation, useApi } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
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
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, X } from "lucide-react";
import { toast } from "sonner";

const projectFormSchema = z.object({
  name: z.string().min(2, "Project name must be at least 2 characters"),
  description: z.string().optional(),
  clientId: z.string().optional(),
  managerId: z.string().min(1, "Project manager is required"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(["planning", "in_progress", "on_hold", "completed", "cancelled"]),
  budget: z.coerce.number().min(0).optional(),
  currency: z.string().default("USD"),
  tags: z.array(z.string()).default([]),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

interface ProjectFormProps {
  project?: Project;
  mode: "create" | "edit";
}

export function ProjectForm({ project, mode }: ProjectFormProps) {
  const router = useRouter();

  const { data: users, isLoading: usersLoading } = useApi<User[]>(
    () => usersApi.getAll(),
    { autoFetch: true }
  );

  const { data: companies, isLoading: companiesLoading } = useApi<Company[]>(
    () => companiesApi.getAll(),
    { autoFetch: true }
  );

  const createMutation = useMutation<Project, CreateProjectRequest>((data) =>
    projectsApi.create(data)
  );

  const updateMutation = useMutation<Project, UpdateProjectRequest>((data) =>
    projectsApi.update(project?.id || "", data)
  );

  const form = useForm<ProjectFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(projectFormSchema) as any,
    defaultValues: {
      name: project?.name || "",
      description: project?.description || "",
      clientId: project?.clientId || "",
      managerId: project?.managerId || "",
      startDate: project?.startDate?.split("T")[0] || "",
      endDate: project?.endDate?.split("T")[0] || "",
      status: project?.status || "planning",
      budget: project?.budget || undefined,
      currency: project?.currency || "USD",
      tags: project?.tags || [],
    },
  });

  useEffect(() => {
    if (project) {
      form.reset({
        name: project.name,
        description: project.description || "",
        clientId: project.clientId || "",
        managerId: project.managerId,
        startDate: project.startDate?.split("T")[0] || "",
        endDate: project.endDate?.split("T")[0] || "",
        status: project.status,
        budget: project.budget || undefined,
        currency: project.currency || "USD",
        tags: project.tags || [],
      });
    }
  }, [project, form]);

  const watchedTags = form.watch("tags");

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !watchedTags.includes(trimmedTag)) {
      form.setValue("tags", [...watchedTags, trimmedTag]);
    }
  };

  const removeTag = (tagToRemove: string) => {
    form.setValue("tags", watchedTags.filter((tag) => tag !== tagToRemove));
  };

  const onSubmit = async (values: ProjectFormValues) => {
    const data = {
      name: values.name,
      description: values.description || undefined,
      clientId: values.clientId || undefined,
      managerId: values.managerId,
      startDate: values.startDate ? new Date(values.startDate).toISOString() : undefined,
      endDate: values.endDate ? new Date(values.endDate).toISOString() : undefined,
      status: values.status,
      budget: values.budget || undefined,
      currency: values.currency,
      tags: values.tags,
      teamMembers: project?.teamMembers || [],
    };

    let result;
    if (mode === "create") {
      result = await createMutation.mutate(data as CreateProjectRequest);
    } else {
      result = await updateMutation.mutate(data as UpdateProjectRequest);
    }

    if (result.success) {
      toast.success(mode === "create" ? "Project created successfully" : "Project updated successfully");
      router.push("/dashboard/projects");
      router.refresh();
    } else {
      toast.error(result.error || "Failed to save project");
    }
  };

  const isLoading = createMutation.isLoading || updateMutation.isLoading;
  const error = createMutation.error || updateMutation.error;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{mode === "create" ? "Create Project" : "Edit Project"}</CardTitle>
          <CardDescription>
            {mode === "create"
              ? "Create a new project to track work and milestones"
              : `Editing project: ${project?.name}`}
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
              {/* Basic Info */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter project name" {...field} />
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
                        placeholder="Describe the project..."
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
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Company</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={companiesLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a company" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">No Company</SelectItem>
                          {companies?.map((company) => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Optional: Associate with a client company</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="managerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Manager *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={usersLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a manager" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {users?.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.firstName} {user.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
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
                          <SelectItem value="planning">Planning</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="on_hold">On Hold</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="budget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="GBP">GBP</SelectItem>
                          <SelectItem value="RSD">RSD</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Tags */}
              <FormField
                control={form.control}
                name="tags"
                render={() => (
                  <FormItem>
                    <FormLabel>Tags</FormLabel>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {watchedTags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="gap-1">
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <FormControl>
                      <Input
                        placeholder="Type a tag and press Enter"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addTag(e.currentTarget.value);
                            e.currentTarget.value = "";
                          }
                        }}
                      />
                    </FormControl>
                    <FormDescription>Press Enter to add tags</FormDescription>
                  </FormItem>
                )}
              />

              {/* Actions */}
              <div className="flex gap-4">
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {mode === "create" ? "Create Project" : "Update Project"}
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

