"use client";

import { useState } from "react";
import { getCurrentCompany } from "@/lib/companies";

interface UploadParams {
	file: File;
	path: string[];
	bucket: string;
}

interface UploadResult {
	url: string;
	path: string[];
}

// Use empty string for client-side requests (will use proxy via rewrites)
const API_URL = typeof window === "undefined"
	? (process.env.API_URL || "http://localhost:3001")
	: "";

export function useUpload() {
	const [isLoading, setLoading] = useState<boolean>(false);

	const uploadFile = async ({
		file,
		path,
		bucket,
	}: UploadParams): Promise<UploadResult> => {
		setLoading(true);

		try {
			// Get current company first
			const companyResult = await getCurrentCompany();
			if (!companyResult.success || !companyResult.data) {
				throw new Error("No company selected");
			}

			// Create FormData for file upload
			const formData = new FormData();
			formData.append("file", file);

			// Upload to company logo endpoint
			const response = await fetch(
				`${API_URL}/api/v1/companies/${companyResult.data.id}/logo`,
				{
					method: "POST",
					body: formData,
					credentials: "include",
				}
			);

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error?.message || "Failed to upload file");
			}

			const result = await response.json();
			if (!result.success || !result.data?.logoUrl) {
				throw new Error(result.error?.message || "Failed to upload file");
			}

			return {
				url: result.data.logoUrl,
				path,
			};
		} catch (error) {
			throw error;
		} finally {
			setLoading(false);
		}
	};

	return {
		uploadFile,
		isLoading,
	};
}

