"use client";

import { ImageOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { FilePreviewIcon, getFileType } from "./file-preview-icon";

interface FilePreviewProps {
  mimetype?: string;
  name?: string | null;
  filePath?: string[] | null;
  small?: boolean;
  className?: string;
}

function ErrorPreview() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-primary/10">
      <div className="flex flex-col items-center justify-center">
        <ImageOff className="size-4 text-muted-foreground" />
      </div>
    </div>
  );
}

export function FilePreview({ mimetype, name, filePath, small, className }: FilePreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const fileType = getFileType(mimetype);
  const isImage = fileType === "image";
  const isPdf = fileType === "pdf";

  // Determine the URL based on file type
  let src: string | null = null;

  if (filePath?.length) {
    const path = filePath.join("/");
    if (isImage) {
      // For images, use the download endpoint directly
      src = `/api/v1/documents/download/${path}`;
    } else if (isPdf) {
      // For PDFs, use the preview endpoint to get a thumbnail
      src = `/api/v1/documents/preview/${path}`;
    }
  }

  // Preload the image to handle loading/error states
  useEffect(() => {
    if (src) {
      setIsLoading(true);
      setIsError(false);
      const img = new Image();
      img.src = src;
      img.onload = () => {
        setIsLoading(false);
        setIsError(false);
      };
      img.onerror = () => {
        setIsLoading(false);
        setIsError(true);
      };
    }
  }, [src]);

  // No preview URL available - show icon
  if (!src) {
    return (
      <div className={cn("w-full h-full flex items-center justify-center", className)}>
        <FilePreviewIcon mimetype={mimetype} size={small ? "sm" : "md"} />
      </div>
    );
  }

  // Error loading preview
  if (isError) {
    return <ErrorPreview />;
  }

  // Show image/PDF thumbnail with loading state
  return (
    <div className={cn("w-full h-full relative", className)}>
      {isLoading && <Skeleton className="absolute inset-0 w-full h-full" />}
      <img
        src={src}
        alt={name || "File Preview"}
        className={cn(
          "w-full h-full object-contain border border-border dark:border-none",
          isLoading ? "opacity-0" : "opacity-100",
          "transition-opacity duration-100"
        )}
        onError={() => setIsError(true)}
      />
    </div>
  );
}
