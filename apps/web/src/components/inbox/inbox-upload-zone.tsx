"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Upload, X } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  onUploadComplete?: () => void;
};

type UploadingFile = {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "complete" | "error";
};

export function InboxUploadZone({ children, onUploadComplete }: Props) {
  const queryClient = useQueryClient();
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [showProgress, setShowProgress] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!acceptedFiles.length) return;

      setShowProgress(true);
      const newFiles: UploadingFile[] = acceptedFiles.map((file) => ({
        file,
        progress: 0,
        status: "pending" as const,
      }));

      setUploadingFiles(newFiles);

      // Set all files to uploading status
      setUploadingFiles((prev) =>
        prev.map((f) => ({ ...f, status: "uploading" as const, progress: 30 }))
      );

      try {
        // Create FormData with all files
        const formData = new FormData();
        for (const file of acceptedFiles) {
          formData.append("files", file);
        }

        // Upload files to the backend
        const response = await fetch("/api/v1/inbox/upload", {
          method: "POST",
          credentials: "include",
          body: formData,
        });

        // Update progress to 70%
        setUploadingFiles((prev) => prev.map((f) => ({ ...f, progress: 70 })));

        if (!response.ok) {
          throw new Error("Upload failed");
        }

        const result = await response.json();

        // Update progress to 100%
        setUploadingFiles((prev) => prev.map((f) => ({ ...f, progress: 100 })));

        const successCount = result.data?.report?.uploadedCount || 0;
        const errorCount = result.data?.report?.failedCount || 0;

        // Update file statuses based on result
        setUploadingFiles((prev) =>
          prev.map((f, i) => ({
            ...f,
            status: i < successCount ? ("complete" as const) : ("error" as const),
          }))
        );

        // Invalidate queries to refresh inbox list
        queryClient.invalidateQueries({ queryKey: ["inbox"] });
        queryClient.invalidateQueries({ queryKey: ["inbox-stats"] });

        // Show completion toast
        if (successCount > 0) {
          toast.success(`${successCount} file${successCount > 1 ? "s" : ""} uploaded successfully`);
        }
        if (errorCount > 0) {
          const failures = result.data?.report?.failures || [];
          const failureMessages = failures
            .map((f: { name: string; reason: string }) => f.reason)
            .join(", ");
          toast.error(`${errorCount} file${errorCount > 1 ? "s" : ""} failed: ${failureMessages}`);
        }
      } catch {
        // Mark all as failed
        setUploadingFiles((prev) =>
          prev.map((f) => ({ ...f, status: "error" as const, progress: 100 }))
        );
        toast.error("Failed to upload files. Please try again.");
      }

      // Clear after delay
      setTimeout(() => {
        setUploadingFiles([]);
        setShowProgress(false);
        onUploadComplete?.();
      }, 1500);
    },
    [queryClient, onUploadComplete]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    onDropRejected: (rejections) => {
      const errors = rejections.flatMap((r) => r.errors);
      if (errors.find((e) => e.code === "file-too-large")) {
        toast.error("File size too large. Maximum 5MB per file.");
      }
      if (errors.find((e) => e.code === "file-invalid-type")) {
        toast.error("File type not supported. Only images and PDFs are allowed.");
      }
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    maxFiles: 25,
    accept: {
      "image/*": [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"],
      "application/pdf": [".pdf"],
    },
    noClick: true,
    noKeyboard: true,
  });

  const totalProgress =
    uploadingFiles.length > 0
      ? Math.round(uploadingFiles.reduce((acc, f) => acc + f.progress, 0) / uploadingFiles.length)
      : 0;

  return (
    <div {...getRootProps()} className="relative h-full">
      <input {...getInputProps()} id="upload-inbox-files" />

      {/* Drag overlay */}
      <div
        className={cn(
          "absolute inset-0 z-50 pointer-events-none transition-opacity duration-200",
          isDragActive ? "opacity-100" : "opacity-0"
        )}
      >
        <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center p-8 border-2 border-dashed border-primary rounded-lg">
            <Upload className="h-12 w-12 mx-auto mb-4 text-primary" />
            <p className="text-lg font-medium">Drop files here</p>
            <p className="text-sm text-muted-foreground mt-1">Images and PDFs up to 5MB each</p>
            <p className="text-xs text-muted-foreground mt-2">Maximum 25 files at a time</p>
          </div>
        </div>
      </div>

      {/* Upload progress overlay */}
      {showProgress && uploadingFiles.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 w-80 bg-background border rounded-lg shadow-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">
              Uploading {uploadingFiles.length} file{uploadingFiles.length > 1 ? "s" : ""}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => {
                setUploadingFiles([]);
                setShowProgress(false);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Progress value={totalProgress} className="h-2 mb-2" />
          <p className="text-xs text-muted-foreground">{totalProgress}% complete</p>
          <div className="mt-3 max-h-32 overflow-auto space-y-1">
            {uploadingFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span
                  className={cn(
                    "w-2 h-2 rounded-full",
                    f.status === "complete" && "bg-green-500",
                    f.status === "uploading" && "bg-yellow-500",
                    f.status === "error" && "bg-red-500",
                    f.status === "pending" && "bg-gray-300"
                  )}
                />
                <span className="truncate flex-1">{f.file.name}</span>
                <span className="text-muted-foreground">{f.progress}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {children}
    </div>
  );
}

// Export a button trigger for manual upload
export function InboxUploadButton({ onUploadComplete }: { onUploadComplete?: () => void }) {
  const handleClick = () => {
    const input = document.getElementById("upload-inbox-files");
    if (input) {
      input.click();
    }
  };

  return (
    <Button onClick={handleClick}>
      <Upload className="mr-2 h-4 w-4" />
      Upload
    </Button>
  );
}
