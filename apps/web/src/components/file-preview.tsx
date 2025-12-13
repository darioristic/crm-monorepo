"use client";

import Image from "next/image";
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

interface ErrorPreviewProps {
  mimetype?: string;
  small?: boolean;
}

function ErrorPreview({ mimetype, small }: ErrorPreviewProps) {
  // Show file type icon as fallback instead of broken image
  return (
    <div className="w-full h-full flex items-center justify-center">
      <FilePreviewIcon mimetype={mimetype} size={small ? "sm" : "md"} />
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
      const img = new window.Image();
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

  // Error loading preview - show file type icon as fallback
  if (isError) {
    return <ErrorPreview mimetype={mimetype} small={small} />;
  }

  // Show image/PDF thumbnail with loading state
  return (
    <div className={cn("w-full h-full relative", className)}>
      {isLoading && <Skeleton className="absolute inset-0 w-full h-full" />}
      <Image
        src={src}
        alt={name || "File Preview"}
        fill
        sizes="(max-width: 768px) 100vw, 50vw"
        className={cn(
          "object-contain border border-border dark:border-none",
          isLoading ? "opacity-0" : "opacity-100",
          "transition-opacity duration-100"
        )}
        onError={() => setIsError(true)}
      />
    </div>
  );
}
