"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { getCurrentCompany, updateCompany } from "@/lib/companies";

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

export function CompanyEmail() {
  const queryClient = useQueryClient();

  const { data: companyResponse } = useQuery({
    queryKey: ["company", "current"],
    queryFn: getCurrentCompany,
  });

  const company = companyResponse?.data;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: company?.email || "",
    },
  });

  // Update form when company data loads
  useQuery({
    queryKey: ["company", "current"],
    queryFn: getCurrentCompany,
    onSuccess: (data) => {
      if (data.data) {
        form.reset({ email: data.data.email || "" });
      }
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      if (!company?.id) {
        throw new Error("No company selected");
      }
      const result = await updateCompany(company.id, {
        email: data.email || undefined,
      });
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update company email");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company"] });
      toast.success("Company email updated");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update company email");
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    updateCompanyMutation.mutate(data);
  });

  if (!company) {
    return null;
  }

  return (
    <Form {...form}>
      <form onSubmit={onSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Company Email</CardTitle>
            <CardDescription>
              This is the email address that will be used to receive emails and notifications.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="max-w-[300px]">
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="company@example.com"
                      disabled={updateCompanyMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>

          <CardFooter className="flex justify-end">
            <Button
              type="submit"
              disabled={updateCompanyMutation.isPending || !form.formState.isDirty}
            >
              {updateCompanyMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
