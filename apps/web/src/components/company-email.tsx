"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
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
import { SubmitButton } from "@/components/ui/submit-button";
import { useTeamMutation, useTeamQuery } from "@/hooks/use-team";
import { useZodForm } from "@/hooks/use-zod-form";

const formSchema = z.object({
  email: z.string().email().optional().or(z.literal("")),
});

export function CompanyEmail() {
  const { data } = useTeamQuery();
  const updateTeamMutation = useTeamMutation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const form = useZodForm(formSchema, {
    defaultValues: {
      email: "",
    },
  });

  // Update form when data loads (only after mount)
  useEffect(() => {
    if (mounted && data?.email !== undefined) {
      form.reset({
        email: data.email ?? "",
      });
    }
  }, [mounted, data?.email, form]);

  const onSubmit = form.handleSubmit((data) => {
    updateTeamMutation.mutate(data);
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit}>
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium">Company Email</CardTitle>
            <CardDescription className="text-sm">
              The primary email address for your company communications.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="max-w-md">
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="company@example.com"
                      autoComplete="email"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex justify-end border-t pt-4">
            <SubmitButton
              isSubmitting={updateTeamMutation.isPending}
              disabled={updateTeamMutation.isPending || !form.formState.isDirty}
            >
              Save Changes
            </SubmitButton>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
