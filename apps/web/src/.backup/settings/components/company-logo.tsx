"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCurrentCompany, updateCompany } from "@/lib/companies";
import { toast } from "sonner";

export function CompanyLogo() {
	const inputRef = useRef<HTMLInputElement>(null);
	const queryClient = useQueryClient();
	const [isUploading, setIsUploading] = useState(false);

	const { data: companyResponse } = useQuery({
		queryKey: ["company", "current"],
		queryFn: getCurrentCompany,
	});

	const company = companyResponse?.data;

	const updateCompanyMutation = useMutation({
		mutationFn: async (file: File) => {
			if (!company?.id) {
				throw new Error("No company selected");
			}

			// Use FormData to upload file
			const formData = new FormData();
			formData.append("file", file);

			const response = await fetch(`/api/v1/companies/${company.id}/logo`, {
				method: "POST",
				body: formData,
				credentials: "include",
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error?.message || "Failed to upload logo");
			}

			const result = await response.json();
			if (!result.success) {
				throw new Error(result.error?.message || "Failed to update logo");
			}

			return result;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["company"] });
			queryClient.invalidateQueries({ queryKey: ["companies"] });
			toast.success("Company logo updated");
			setIsUploading(false);
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Failed to update logo");
			setIsUploading(false);
		},
	});

	const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		// Validate file type
		if (!file.type.startsWith("image/")) {
			toast.error("Please select an image file");
			return;
		}

		// Validate file size (max 5MB)
		if (file.size > 5 * 1024 * 1024) {
			toast.error("Image size must be less than 5MB");
			return;
		}

		setIsUploading(true);
		updateCompanyMutation.mutate(file);
	};

	if (!company) {
		return null;
	}

	return (
		<Card>
			<div className="flex justify-between items-center pr-6">
				<CardHeader>
					<CardTitle>Company Logo</CardTitle>
					<CardDescription>
						This is your company's logo. Click on the logo to upload a custom
						one from your files.
					</CardDescription>
				</CardHeader>

				<Avatar
					className="w-16 h-16 rounded-md cursor-pointer border-2 border-border hover:border-primary transition-colors"
					onClick={() => inputRef.current?.click()}
				>
					{isUploading || updateCompanyMutation.isPending ? (
						<div className="flex items-center justify-center w-full h-full">
							<Loader2 className="h-6 w-6 animate-spin" />
						</div>
					) : (
						<>
							{company.logoUrl && (
								<AvatarImage 
									src={company.logoUrl.startsWith("http") || company.logoUrl.startsWith("data:") 
										? company.logoUrl 
										: `${typeof window === "undefined" ? (process.env.API_URL || "http://localhost:3001") : ""}${company.logoUrl}`} 
									alt={company.name} 
								/>
							)}
							<AvatarFallback className="bg-muted text-lg font-medium rounded-md">
								{company.name?.charAt(0)?.toUpperCase()}
								{company.name?.charAt(1)?.toUpperCase()}
							</AvatarFallback>
						</>
					)}

					<input
						ref={inputRef}
						type="file"
						style={{ display: "none" }}
						accept="image/*"
						onChange={handleFileSelect}
						disabled={isUploading || updateCompanyMutation.isPending}
					/>
				</Avatar>
			</div>
			<CardFooter>An avatar is optional but strongly recommended.</CardFooter>
		</Card>
	);
}

