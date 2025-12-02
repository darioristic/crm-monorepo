"use client";

import { useZodForm } from "@/hooks/use-zod-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFieldArray } from "react-hook-form";
import { z } from "zod";
import { getCurrentCompany } from "@/lib/companies";

const formSchema = z.object({
	invites: z.array(
		z.object({
			email: z.string().email(),
			role: z.enum(["owner", "member", "admin"]),
		}),
	),
});

type InviteFormProps = {
	onSuccess?: () => void;
	skippable?: boolean;
};

export function InviteForm({ onSuccess, skippable = true }: InviteFormProps) {
	const queryClient = useQueryClient();

	const inviteMutation = useMutation({
		mutationFn: async (invites: Array<{ email: string; role: "owner" | "member" | "admin" }>) => {
			// Get current company
			const companyResult = await getCurrentCompany();
			if (!companyResult.success || !companyResult.data) {
				throw new Error("No company selected");
			}

			// TODO: Implement actual invite API call
			// For now, just simulate success
			return { sent: invites.length, skipped: 0 };
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["company", "invites"] });

			// Show appropriate feedback based on results
			if (data.sent > 0 && data.skipped === 0) {
				toast.success(`${data.sent} invite${data.sent > 1 ? "s" : ""} sent successfully`);
			} else if (data.sent > 0 && data.skipped > 0) {
				toast.info(`${data.sent} invite${data.sent > 1 ? "s" : ""} sent, ${data.skipped} skipped (already members or invited)`);
			} else if (data.sent === 0 && data.skipped > 0) {
				toast.warning(`All ${data.skipped} invite${data.skipped > 1 ? "s" : ""} were skipped (already members or invited)`);
			}

			onSuccess?.();
		},
		onError: () => {
			toast.error("Failed to send invites");
		},
	});

	const form = useZodForm(formSchema, {
		defaultValues: {
			invites: [
				{
					email: "",
					role: "member",
				},
			],
		},
	});

	const onSubmit = form.handleSubmit((data) => {
		inviteMutation.mutate(data.invites.filter((invite) => invite.email !== ""));
	});

	const { fields, append } = useFieldArray({
		name: "invites",
		control: form.control,
	});

	return (
		<Form {...form}>
			<form onSubmit={onSubmit}>
				{fields.map((field, index) => (
					<div
						className="flex items-center justify-between mt-3 space-x-4"
						key={index.toString()}
					>
						<FormField
							control={form.control}
							key={field.id}
							name={`invites.${index}.email`}
							render={({ field }) => (
								<FormItem className="flex-1">
									<FormControl>
										<Input
											placeholder="jane@example.com"
											type="email"
											autoComplete="off"
											autoCapitalize="none"
											autoCorrect="off"
											spellCheck="false"
											{...field}
										/>
									</FormControl>
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name={`invites.${index}.role`}
							render={({ field }) => (
								<FormItem>
									<Select
										onValueChange={field.onChange}
										defaultValue={field.value}
									>
										<FormControl>
											<SelectTrigger className="min-w-[120px]">
												<SelectValue placeholder="Select role" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											<SelectItem value="owner">Owner</SelectItem>
											<SelectItem value="member">Member</SelectItem>
											<SelectItem value="admin">Admin</SelectItem>
										</SelectContent>
									</Select>
								</FormItem>
							)}
						/>
					</div>
				))}

				<Button
					variant="outline"
					type="button"
					className="mt-4 border-none bg-[#F2F1EF] text-[11px] dark:bg-[#1D1D1D]"
					onClick={() => append({ email: "", role: "member" })}
				>
					Add more
				</Button>

				<div className="border-t-[1px] pt-4 mt-8 items-center justify-between">
					<div>
						{Object.values(form.formState.errors).length > 0 && (
							<span className="text-sm text-destructive">
								Please complete the fields above.
							</span>
						)}
					</div>

					<div className="flex items-center justify-between">
						{skippable ? (
							<div />
						) : (
							<div />
						)}

						<SubmitButton
							type="submit"
							isSubmitting={inviteMutation.isPending}
							disabled={inviteMutation.isPending}
						>
							Send invites
						</SubmitButton>
					</div>
				</div>
			</form>
		</Form>
	);
}

