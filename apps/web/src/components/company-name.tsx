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
  name: z.string().min(2).max(32),
});

export function CompanyName() {
  const { data } = useTeamQuery();
  const updateTeamMutation = useTeamMutation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const form = useZodForm(formSchema, {
    defaultValues: {
      name: "",
    },
  });

  // Update form when data loads (only after mount)
  useEffect(() => {
    if (mounted && data?.name) {
      form.reset({
        name: data.name,
      });
    }
  }, [mounted, data?.name, form]);

  const onSubmit = form.handleSubmit((data) => {
    updateTeamMutation.mutate(data);
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit}>
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium">Company Name</CardTitle>
            <CardDescription className="text-sm">
              This is your company's visible name across the platform.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      {...field}
                      className="max-w-md"
                      placeholder="Enter company name"
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck="false"
                      maxLength={32}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">Maximum 32 characters</p>
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
