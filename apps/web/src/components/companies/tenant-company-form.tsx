"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2, AlertCircle } from "lucide-react";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { tenantAdminApi, type TenantCompany } from "@/lib/api";
import { CountrySelector } from "./country-selector";

const formSchema = z.object({
	name: z.string().min(2, {
		message: "Name must be at least 2 characters.",
	}),
	industry: z.string().min(1, {
		message: "Industry is required.",
	}),
	address: z.string().min(1, {
		message: "Address is required.",
	}),
	email: z.string().email().optional().or(z.literal("")),
	phone: z.string().optional(),
	website: z.string().optional(),
	contact: z.string().optional(),
	vatNumber: z.string().optional(),
	companyNumber: z.string().optional(),
	city: z.string().optional(),
	country: z.string().optional(),
	countryCode: z.string().optional(),
	zip: z.string().optional(),
	note: z.string().optional(),
	logoUrl: z.string().optional(),
});

type Props = {
	company?: TenantCompany;
	onSuccess?: () => void;
};

export function TenantCompanyForm({ company, onSuccess }: Props) {
	const isEdit = !!company;
	const queryClient = useQueryClient();

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: company?.name || "",
			industry: company?.industry || "",
			address: company?.address || "",
			email: company?.email || "",
			phone: company?.phone || "",
			website: company?.website || "",
			contact: company?.contact || "",
			vatNumber: company?.vatNumber || "",
			companyNumber: company?.companyNumber || "",
			city: company?.city || "",
			country: company?.country || "",
			countryCode: company?.countryCode || "",
			zip: company?.zip || "",
			note: company?.note || "",
			logoUrl: company?.logoUrl || "",
		},
	});

	const createMutation = useMutation({
		mutationFn: async (values: z.infer<typeof formSchema>) => {
			const result = await tenantAdminApi.companies.create({
				name: values.name,
				industry: values.industry || "Other",
				address: values.address,
				email: values.email || undefined,
				phone: values.phone || undefined,
				website: values.website || undefined,
				contact: values.contact || undefined,
				city: values.city || undefined,
				zip: values.zip || undefined,
				country: values.country || undefined,
				countryCode: values.countryCode || undefined,
				vatNumber: values.vatNumber || undefined,
				companyNumber: values.companyNumber || undefined,
				note: values.note || undefined,
				logoUrl: values.logoUrl || undefined,
			});
			if (!result.success) {
				throw new Error(result.error?.message || "Failed to create company");
			}
			return result.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["tenant-admin", "companies"] });
			toast.success("Company created successfully");
			form.reset();
			onSuccess?.();
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to create company"
			);
		},
	});

	const updateMutation = useMutation({
		mutationFn: async (values: z.infer<typeof formSchema>) => {
			if (!company) throw new Error("Company ID is required");
			const result = await tenantAdminApi.companies.update(company.id, {
				name: values.name,
				industry: values.industry || "Other",
				address: values.address,
				email: values.email || undefined,
				phone: values.phone || undefined,
				website: values.website || undefined,
				contact: values.contact || undefined,
				city: values.city || undefined,
				zip: values.zip || undefined,
				country: values.country || undefined,
				countryCode: values.countryCode || undefined,
				vatNumber: values.vatNumber || undefined,
				companyNumber: values.companyNumber || undefined,
				note: values.note || undefined,
				logoUrl: values.logoUrl || undefined,
			});
			if (!result.success) {
				throw new Error(result.error?.message || "Failed to update company");
			}
			return result.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["tenant-admin", "companies"] });
			toast.success("Company updated successfully");
			onSuccess?.();
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to update company"
			);
		},
	});

	const handleSubmit = async (values: z.infer<typeof formSchema>) => {
		if (isEdit) {
			updateMutation.mutate(values);
		} else {
			createMutation.mutate(values);
		}
	};

	const isSubmitting = createMutation.isPending || updateMutation.isPending;
	const error = createMutation.error
		? (createMutation.error instanceof Error
				? createMutation.error.message
				: String(createMutation.error))
		: updateMutation.error
			? (updateMutation.error instanceof Error
					? updateMutation.error.message
					: String(updateMutation.error))
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
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="text-xs text-[#878787] font-normal">
										Company Name *
									</FormLabel>
									<FormControl>
										<Input
											{...field}
											value={field.value ?? ""}
											autoFocus
											placeholder="Acme Inc"
											autoComplete="off"
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="industry"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="text-xs text-[#878787] font-normal">
										Industry *
									</FormLabel>
									<FormControl>
										<Input
											{...field}
											value={field.value ?? ""}
											placeholder="Technology, Healthcare, Finance..."
											autoComplete="off"
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="address"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="text-xs text-[#878787] font-normal">
										Address *
									</FormLabel>
									<FormControl>
										<Input
											{...field}
											value={field.value ?? ""}
											placeholder="123 Main Street, Suite 100"
											autoComplete="off"
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="grid grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="city"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-xs text-[#878787] font-normal">
											City
										</FormLabel>
										<FormControl>
											<Input
												{...field}
												value={field.value ?? ""}
												placeholder="Belgrade"
												autoComplete="off"
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="zip"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-xs text-[#878787] font-normal">
											ZIP / Postal Code
										</FormLabel>
										<FormControl>
											<Input
												{...field}
												value={field.value ?? ""}
												placeholder="11000"
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
							name="country"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="text-xs text-[#878787] font-normal">
										Country
									</FormLabel>
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

						<FormField
							control={form.control}
							name="email"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="text-xs text-[#878787] font-normal">
										Email
									</FormLabel>
									<FormControl>
										<Input
											{...field}
											value={field.value ?? ""}
											placeholder="contact@company.com"
											type="email"
											autoComplete="off"
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="phone"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="text-xs text-[#878787] font-normal">
										Phone
									</FormLabel>
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
						<Button
							variant="outline"
							onClick={() => onSuccess?.()}
							type="button"
						>
							Cancel
						</Button>

						<Button
							type="submit"
							disabled={isSubmitting || !form.formState.isDirty}
						>
							{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							{isEdit ? "Update" : "Create"}
						</Button>
					</div>
				</div>
			</form>
		</Form>
	);
}

