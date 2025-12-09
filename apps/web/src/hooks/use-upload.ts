"use client";

import { useState } from "react";
import { getCurrentCompany } from "@/lib/companies";

interface UploadParams {
  file: File;
  path: string[];
  bucket: string;
  companyId?: string;
}

interface UploadResult {
  url: string;
  path: string[];
}

// Use empty string for client-side requests (will use proxy via rewrites)
const API_URL = typeof window === "undefined" ? process.env.API_URL || "http://localhost:3001" : "";

export function useUpload() {
  const [isLoading, setLoading] = useState<boolean>(false);

  const uploadFile = async ({
    file,
    path,
    bucket,
    companyId,
  }: UploadParams): Promise<UploadResult> => {
    setLoading(true);

    try {
      // Resolve companyId: prefer explicit, fallback to current active company
      let targetCompanyId = companyId;
      if (!targetCompanyId) {
        const companyResult = await getCurrentCompany();
        if (!companyResult.success || !companyResult.data) {
          throw new Error("No company selected");
        }
        targetCompanyId = companyResult.data.id;
      }

      // Fetch CSRF token for POST
      let csrfToken: string | null = null;
      try {
        const resp = await fetch(`${API_URL}/api/v1/auth/csrf-token`, {
          method: "GET",
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        const text = await resp.text();
        const data = JSON.parse(text) as { success: boolean; data?: { csrfToken: string } };
        csrfToken = data?.data?.csrfToken || null;
      } catch {}

      // Create FormData for file upload
      const formData = new FormData();
      formData.append("file", file);

      // Upload to company logo endpoint
      const response = await fetch(`${API_URL}/api/v1/companies/${targetCompanyId}/logo`, {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: csrfToken ? { "X-CSRF-Token": csrfToken } : undefined,
      });

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
    } finally {
      setLoading(false);
    }
  };

  return {
    uploadFile,
    isLoading,
  };
}
