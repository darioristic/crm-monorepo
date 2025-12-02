"use client";

import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";

const formSchema = z.object({
	firstName: z.string().min(1, "First name is required").max(50),
	lastName: z.string().min(1, "Last name is required").max(50),
});

type FormValues = z.infer<typeof formSchema>;

export function DisplayName() {
	const queryClient = useQueryClient();
	const { user, refreshUser } = useAuth();

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			firstName: user?.firstName || "",
			lastName: user?.lastName || "",
		},
	});

	// Update form when user data changes
	React.useEffect(() => {
		if (user) {
			form.reset({
				firstName: user.firstName || "",
				lastName: user.lastName || "",
			});
		}
	}, [user, form]);

	const updateUserMutation = useMutation({
		mutationFn: async (data: FormValues) => {
			const response = await fetch("/api/v1/users/me", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					firstName: data.firstName,
					lastName: data.lastName,
				}),
				credentials: "include",
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error?.message || "Failed to update name");
			}

			return response.json();
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["user"] });
			await refreshUser();
			toast.success("Name updated");
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Failed to update name");
		},
	});

	const onSubmit = form.handleSubmit((data) => {
		updateUserMutation.mutate(data);
	});

	if (!user) {
		return null;
	}

	return (
		<Form {...form}>
			<form onSubmit={onSubmit}>
				<Card>
					<CardHeader>
						<CardTitle>Display Name</CardTitle>
						<CardDescription>
							Please enter your full name, or a display name you are comfortable
							with.
						</CardDescription>
					</CardHeader>

					<CardContent className="space-y-4">
						<FormField
							control={form.control}
							name="firstName"
							render={({ field }) => (
								<FormItem>
									<FormControl>
										<Input
											{...field}
											placeholder="First name"
											className="max-w-[300px]"
											disabled={updateUserMutation.isPending}
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
									<FormControl>
										<Input
											{...field}
											placeholder="Last name"
											className="max-w-[300px]"
											disabled={updateUserMutation.isPending}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</CardContent>

					<CardFooter className="flex justify-between">
						<div className="text-sm text-muted-foreground">
							Please use 50 characters at maximum for each field.
						</div>
						<Button
							type="submit"
							disabled={updateUserMutation.isPending || !form.formState.isDirty}
						>
							{updateUserMutation.isPending ? "Saving..." : "Save"}
						</Button>
					</CardFooter>
				</Card>
			</form>
		</Form>
	);
}

