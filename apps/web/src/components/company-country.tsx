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
import { CountrySelector } from "@/components/companies/country-selector";
import { useEffect } from "react";

const formSchema = z.object({
	countryCode: z.string().min(2).max(32),
});

export function CompanyCountry() {
	const { data } = useTeamQuery();
	const updateTeamMutation = useTeamMutation();

	const form = useZodForm(formSchema, {
		defaultValues: {
			countryCode: data?.countryCode ?? "",
		},
	});

	// Update form when data loads
	useEffect(() => {
		if (data?.countryCode !== undefined) {
			form.reset({
				countryCode: data.countryCode ?? "",
			});
		}
	}, [data?.countryCode, form]);

	const onSubmit = form.handleSubmit((data) => {
		updateTeamMutation.mutate(data);
	});

	return (
		<Form {...form}>
			<form onSubmit={onSubmit}>
				<Card className="border-border/50">
					<CardHeader className="pb-4">
						<CardTitle className="text-base font-medium">Country</CardTitle>
						<CardDescription className="text-sm">
							Select your company's country of origin.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<FormField
							control={form.control}
							name="countryCode"
							render={({ field }) => (
								<FormItem className="max-w-md">
									<FormControl>
										<CountrySelector
											defaultValue={field.value ?? ""}
											onSelect={(code, name) => {
												field.onChange(name);
												form.setValue("countryCode", code);
											}}
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

