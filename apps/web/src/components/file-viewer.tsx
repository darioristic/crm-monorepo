"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { FilePreviewIcon } from "./file-preview-icon";

const DynamicImageViewer = dynamic(
  () => import("@/components/image-viewer").then((mod) => mod.ImageViewer),
  { loading: () => <Skeleton className="h-full w-full" /> }
);

const DynamicPdfViewer = dynamic(
  () => import("@/components/pdf-viewer").then((mod) => mod.PdfViewer),
  { loading: () => <Skeleton className="h-full w-full" /> }
);

type Props = {
  mimeType: string | null | undefined;
  url: string;
  maxWidth?: number;
};

export function FileViewer({ mimeType, url, maxWidth }: Props) {
  if (mimeType === "application/pdf" || mimeType === "application/octet-stream") {
    return <DynamicPdfViewer url={url} key={url} maxWidth={maxWidth} />;
  }

  if (mimeType?.startsWith("image/")) {
    return <DynamicImageViewer url={url} />;
  }

  return (
    <div className="size-16">
      <FilePreviewIcon mimetype={mimeType} />
    </div>
  );
}
