"use client";

import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { type ReactNode, useRef } from "react";
import { type FileRejection, useDropzone } from "react-dropzone";
import { documentsApi } from "@/lib/api";
import { useUploadProgressStore } from "@/store/vault-store";
import { useQueryClient } from "@tanstack/react-query";

type Props = {
  children: ReactNode;
  onUpload?: (
    results: {
      file_path: string[];
      mimetype: string;
      size: number;
    }[]
  ) => void;
};

export function VaultUploadZone({ onUpload, children }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const uploadProgress = useRef<number[]>([]);
  const { startUpload, finishUpload } = useUploadProgressStore();
  const uploadInputId = "vault-upload-input";

  const onDrop = async (files: File[]) => {
    if (!files.length) {
      return;
    }

    // Set default progress
    uploadProgress.current = files.map(() => 0);
    startUpload(files.length);

    toast({
      title: `Uploading ${files.length} file(s)`,
      description: "Please do not close browser until completed",
    });

    try {
      const response = await documentsApi.upload(files);

      if (response.success && response.data) {
        // Process documents
        const processPayload = response.data.map((doc) => ({
          filePath: doc.pathTokens,
          mimetype: doc.metadata?.mimetype || "application/octet-stream",
          size: doc.metadata?.size || 0,
        }));

        await documentsApi.process(processPayload);

        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: ["documents"] });

        toast({
          title: "Upload successful",
          description: `${files.length} file(s) uploaded successfully`,
        });

        onUpload?.(processPayload);
      } else {
        toast({
          title: "Upload failed",
          description: response.error?.message || "Something went wrong",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Upload failed",
        description: "Something went wrong please try again.",
        variant: "destructive",
      });
    } finally {
      uploadProgress.current = [];
      finishUpload();
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: ([reject]: FileRejection[]) => {
      if (reject?.errors.find(({ code }) => code === "file-too-large")) {
        toast({
          title: "File size too large",
          description: "Maximum file size is 5MB",
          variant: "destructive",
        });
      }

      if (reject?.errors.find(({ code }) => code === "file-invalid-type")) {
        toast({
          title: "File type not supported",
          description: "Please upload a supported file type",
          variant: "destructive",
        });
      }
    },
    maxSize: 5000000, // 5MB
    maxFiles: 25,
    accept: {
      "image/*": [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".avif"],
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "application/vnd.oasis.opendocument.text": [".odt"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.oasis.opendocument.spreadsheet": [".ods"],
      "application/vnd.ms-powerpoint": [".ppt"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        [".pptx"],
      "application/vnd.oasis.opendocument.presentation": [".odp"],
      "text/plain": [".txt"],
      "text/csv": [".csv"],
      "text/markdown": [".md"],
      "application/rtf": [".rtf"],
      "application/zip": [".zip"],
    },
  });

  return (
    <div
      className="relative h-full"
      {...getRootProps({ onClick: (evt) => evt.stopPropagation() })}
    >
      <div className="absolute top-0 right-0 left-0 z-[51] w-full pointer-events-none h-[calc(100vh-150px)]">
        <div
          className={cn(
            "bg-background h-full w-full flex items-center justify-center text-center rounded-lg border-2 border-dashed border-primary/50",
            isDragActive ? "visible opacity-100" : "invisible opacity-0",
            "transition-all duration-200"
          )}
        >
          <input {...getInputProps()} id={uploadInputId} />

          <div className="flex flex-col items-center justify-center gap-2">
            <p className="text-sm">
              Drop your documents and files here.
              <br />
              Maximum of 25 files at a time.
            </p>

            <span className="text-xs text-muted-foreground">
              Max file size 5MB
            </span>
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}
