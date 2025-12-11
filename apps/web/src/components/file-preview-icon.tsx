"use client";

import {
  MdDescription,
  MdFolderZip,
  MdInsertDriveFile,
  MdOutlineImage,
  MdOutlineTableChart,
  MdPictureAsPdf,
  MdSlideshow,
} from "react-icons/md";
import { cn } from "@/lib/utils";

type FileType =
  | "image"
  | "pdf"
  | "spreadsheet"
  | "document"
  | "presentation"
  | "archive"
  | "code"
  | "unknown";

interface FilePreviewIconProps {
  mimetype?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-5 w-5",
  md: "h-8 w-8",
  lg: "h-12 w-12",
};

export function getFileType(mimetype?: string | null): FileType {
  if (!mimetype) return "unknown";

  if (mimetype.startsWith("image/")) return "image";
  if (mimetype === "application/pdf") return "pdf";
  if (mimetype.includes("spreadsheet") || mimetype.includes("excel") || mimetype === "text/csv")
    return "spreadsheet";
  if (mimetype.includes("presentation") || mimetype.includes("powerpoint")) return "presentation";
  if (
    mimetype.includes("word") ||
    mimetype.includes("document") ||
    mimetype === "text/plain" ||
    mimetype === "text/markdown" ||
    mimetype === "application/rtf"
  )
    return "document";
  if (mimetype.includes("zip") || mimetype.includes("archive") || mimetype.includes("compressed"))
    return "archive";
  if (
    mimetype.includes("javascript") ||
    mimetype.includes("json") ||
    mimetype.includes("xml") ||
    mimetype.includes("html")
  )
    return "code";

  return "unknown";
}

export function getFileIcon(mimetype?: string | null) {
  const type = getFileType(mimetype);

  switch (type) {
    case "image":
      return MdOutlineImage;
    case "pdf":
      return MdPictureAsPdf;
    case "spreadsheet":
      return MdOutlineTableChart;
    case "presentation":
      return MdSlideshow;
    case "document":
      return MdDescription;
    case "archive":
      return MdFolderZip;
    case "code":
      return MdDescription;
    default:
      return MdInsertDriveFile;
  }
}

export function FilePreviewIcon({ mimetype, className, size = "md" }: FilePreviewIconProps) {
  const Icon = getFileIcon(mimetype);

  return <Icon className={cn("text-muted-foreground", sizeClasses[size], className)} />;
}
