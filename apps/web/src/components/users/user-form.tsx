"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2 } from "lucide-react";
import type { Resolver } from "react-hook-form";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type TenantUser, tenantAdminApi } from "@/lib/api";

const formSchema = z.object({
  firstName: z.string().min(2, {
    message: "First name must be at least 2 characters.",
  }),
  lastName: z.string().min(2, {
    message: "Last name must be at least 2 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  password: z
    .string()
    .min(8, {
      message: "Password must be at least 8 characters.",
    })
    .optional()
    .or(z.literal("")),
  role: z.enum(["tenant_admin", "crm_user"]).default("crm_user"),
  phone: z.string().optional().or(z.literal("")),
  status: z.string().optional().or(z.literal("")),
});

type Props = {
  user?: TenantUser;
  onSuccess?: () => void;
};

export function UserForm({ user, onSuccess }: Props) {
  const isEdit = !!user;
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as Resolver<z.infer<typeof formSchema>>,
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      password: "",
      role: (user?.role === "tenant_admin" ? "tenant_admin" : "crm_user") as
        | "tenant_admin"
        | "crm_user",
      phone: user?.phone || "",
      status: user?.status || "active",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const result = await tenantAdminApi.users.create({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        password: values.password || undefined,
        role: values.role,
        phone: values.phone || undefined,
      });
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to create user");
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-admin", "users"] });
      toast.success("User created successfully");
      form.reset();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to create user");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user) throw new Error("User ID is required");
      const result = await tenantAdminApi.users.update(user.id, {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        role: values.role,
        phone: values.phone || undefined,
        status: values.status || undefined,
      });
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update user");
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-admin", "users"] });
      toast.success("User updated successfully");
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update user");
    },
  });

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    if (isEdit) {
      updateMutation.mutate(values);
    } else {
      // Password is required for new users
      if (!values.password) {
        form.setError("password", {
          message: "Password is required for new users",
        });
        return;
      }
      createMutation.mutate(values);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error
    ? createMutation.error instanceof Error
      ? createMutation.error.message
      : String(createMutation.error)
    : updateMutation.error
      ? updateMutation.error instanceof Error
        ? updateMutation.error.message
        : String(updateMutation.error)
      : undefined;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)}>
        <div className="h-[calc(100vh-180px)] scrollbar-hide overflow-auto">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-[#878787] font-normal">
                      First Name *
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        autoFocus
                        placeholder="John"
                        autoComplete="off"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-[#878787] font-normal">
                      Last Name *
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="Doe"
                        autoComplete="off"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-[#878787] font-normal">Email *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="john.doe@example.com"
                      type="email"
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isEdit && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-[#878787] font-normal">Password *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="••••••••"
                        type="password"
                        autoComplete="new-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-[#878787] font-normal">Role *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="crm_user">CRM User</SelectItem>
                        <SelectItem value="tenant_admin">Tenant Admin</SelectItem>
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
                    <FormLabel className="text-xs text-[#878787] font-normal">Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || "active"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-[#878787] font-normal">Phone</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="+381 11 123 4567"
                      type="tel"
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-background">
          <div className="flex justify-end mt-auto space-x-4">
            <Button variant="outline" onClick={() => onSuccess?.()} type="button">
              Cancel
            </Button>

            <Button type="submit" disabled={isSubmitting || !form.formState.isDirty}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
