"use client";

import { Skeleton } from "@/components/ui/skeleton";
import dynamic from "next/dynamic";
import { FileIcon } from "lucide-react";

const DynamicImageViewer = dynamic(
	() => import("@/components/image-viewer").then((mod) => mod.ImageViewer),
	{ loading: () => <Skeleton className="h-full w-full" /> },
);

const DynamicPdfViewer = dynamic(
	() => import("@/components/pdf-viewer").then((mod) => mod.PdfViewer),
	{ loading: () => <Skeleton className="h-full w-full" /> },
);

type Props = {
	mimeType: string | null | undefined;
	url: string;
	maxWidth?: number;
};

function FilePreviewIcon({ mimetype }: { mimetype: string | null | undefined }) {
	return (
		<div className="flex flex-col items-center justify-center gap-2 text-muted-foreground p-8">
			<FileIcon className="size-16" />
			<span className="text-sm">
				{mimetype ? `Preview not available for ${mimetype}` : "No preview available"}
			</span>
		</div>
	);
}

export function FileViewer({ mimeType, url, maxWidth }: Props) {
	if (
		mimeType === "application/pdf" ||
		mimeType === "application/octet-stream"
	) {
		return <DynamicPdfViewer url={url} key={url} maxWidth={maxWidth} />;
	}

	if (mimeType?.startsWith("image/")) {
		return <DynamicImageViewer url={url} />;
	}

	return (
		<div className="size-full flex items-center justify-center">
			<FilePreviewIcon mimetype={mimeType} />
		</div>
	);
}

