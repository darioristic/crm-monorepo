"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getCurrentCompany, updateCompany } from "@/lib/companies";
import { toast } from "sonner";

const formSchema = z.object({
	name: z.string().min(2, "Name must be at least 2 characters").max(100),
});

type FormValues = z.infer<typeof formSchema>;

export function CompanyName() {
	const queryClient = useQueryClient();

	const { data: companyResponse } = useQuery({
		queryKey: ["company", "current"],
		queryFn: getCurrentCompany,
	});

	const company = companyResponse?.data;

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: company?.name || "",
		},
	});

	// Update form when company data loads
	useQuery({
		queryKey: ["company", "current"],
		queryFn: getCurrentCompany,
		onSuccess: (data) => {
			if (data.data?.name) {
				form.reset({ name: data.data.name });
			}
		},
	});

	const updateCompanyMutation = useMutation({
		mutationFn: async (data: FormValues) => {
			if (!company?.id) {
				throw new Error("No company selected");
			}
			const result = await updateCompany(company.id, { name: data.name });
			if (!result.success) {
				throw new Error(result.error?.message || "Failed to update company name");
			}
			return result;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["company"] });
			queryClient.invalidateQueries({ queryKey: ["companies"] });
			toast.success("Company name updated");
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Failed to update company name");
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
						<CardTitle>Company Name</CardTitle>
						<CardDescription>
							This is your company's visible name. For example, the name of your
							company or department.
						</CardDescription>
					</CardHeader>

					<CardContent>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormControl>
										<Input
											{...field}
											className="max-w-[300px]"
											autoComplete="off"
											maxLength={100}
											disabled={updateCompanyMutation.isPending}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</CardContent>

					<CardFooter className="flex justify-between">
						<div className="text-sm text-muted-foreground">
							Please use 100 characters at maximum.
						</div>
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

