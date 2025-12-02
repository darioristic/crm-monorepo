"use client";

import { useTeamMutation, useTeamQuery } from "@/hooks/use-team";
import { useZodForm } from "@/hooks/use-zod-form";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormMessage,
} from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { z } from "zod";
import { SelectFiscalMonth } from "@/components/select-fiscal-month";
import { useEffect } from "react";

const formSchema = z.object({
	fiscalYearStartMonth: z.number().int().min(1).max(12).nullable(),
});

export function CompanyFiscalYear() {
	const { data } = useTeamQuery();
	const updateTeamMutation = useTeamMutation();

	const form = useZodForm(formSchema, {
		defaultValues: {
			fiscalYearStartMonth: data?.fiscalYearStartMonth ?? null,
		},
	});

	// Update form when data loads
	useEffect(() => {
		if (data?.fiscalYearStartMonth !== undefined) {
			form.reset({
				fiscalYearStartMonth: data.fiscalYearStartMonth ?? null,
			});
		}
	}, [data?.fiscalYearStartMonth, form]);

	const onSubmit = form.handleSubmit((data) => {
		updateTeamMutation.mutate(data);
	});

	return (
		<Form {...form}>
			<form onSubmit={onSubmit}>
				<Card className="border-border/50">
					<CardHeader className="pb-4">
						<CardTitle className="text-base font-medium">Fiscal Year</CardTitle>
						<CardDescription className="text-sm">
							Set when your fiscal year begins. This determines the default date
							ranges for all reports and widgets throughout the application.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<FormField
							control={form.control}
							name="fiscalYearStartMonth"
							render={({ field }) => (
								<FormItem className="max-w-md">
									<FormControl>
										<SelectFiscalMonth {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</CardContent>
					<CardFooter className="flex justify-end border-t pt-4">
						<SubmitButton
							disabled={updateTeamMutation.isPending || !form.formState.isDirty}
							isSubmitting={updateTeamMutation.isPending}
						>
							Save Changes
						</SubmitButton>
					</CardFooter>
				</Card>
			</form>
		</Form>
	);
}

