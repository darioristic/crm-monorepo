"use client";

import { cn } from "@/lib/utils";
import { FilePreviewIcon, getFileType } from "./file-preview-icon";
import Image from "next/image";

interface FilePreviewProps {
	mimetype?: string;
	name?: string | null;
	filePath?: string[] | null;
	small?: boolean;
	className?: string;
}

export function FilePreview({
	mimetype,
	name,
	filePath,
	small,
	className,
}: FilePreviewProps) {
	const fileType = getFileType(mimetype);
	const isImage = fileType === "image";
	const isPdf = fileType === "pdf";

	// Build the proxy URL for images
	const getImageUrl = () => {
		if (!filePath?.length) return null;
		const path = filePath.join("/");
		return `/api/proxy?filePath=${encodeURIComponent(path)}`;
	};

	// Build the preview URL for PDFs (generates thumbnail)
	const getPdfPreviewUrl = () => {
		if (!filePath?.length) return null;
		const path = filePath.join("/");
		return `/api/preview?filePath=${encodeURIComponent(path)}`;
	};

	// For images, show the actual image
	if (isImage) {
		const imageUrl = getImageUrl();
		if (imageUrl) {
			return (
				<div
					className={cn(
						"relative w-full h-full bg-muted overflow-hidden",
						className
					)}
				>
					<Image
						src={imageUrl}
						alt={name || "Document preview"}
						fill
						className="object-cover"
						sizes={small ? "45px" : "60px"}
						unoptimized
					/>
				</div>
			);
		}
	}

	// For PDFs, show the generated thumbnail
	if (isPdf) {
		const previewUrl = getPdfPreviewUrl();
		if (previewUrl) {
			return (
				<div
					className={cn(
						"relative w-full h-full bg-muted overflow-hidden",
						className
					)}
				>
					<Image
						src={previewUrl}
						alt={name || "PDF preview"}
						fill
						className="object-cover"
						sizes={small ? "45px" : "60px"}
						unoptimized
						onError={(e) => {
							// Fallback to icon if preview fails
							e.currentTarget.style.display = "none";
							e.currentTarget.parentElement?.classList.add("preview-fallback");
						}}
					/>
					{/* Fallback icon shown via CSS when image fails */}
					<div className="hidden preview-fallback:flex absolute inset-0 items-center justify-center">
						<FilePreviewIcon
							mimetype={mimetype}
							size={small ? "sm" : "md"}
						/>
					</div>
				</div>
			);
		}
	}

	// For other file types, show the icon
	return (
		<div
			className={cn(
				"w-full h-full flex items-center justify-center bg-muted rounded",
				className
			)}
		>
			<FilePreviewIcon mimetype={mimetype} size={small ? "sm" : "md"} />
		</div>
	);
}

